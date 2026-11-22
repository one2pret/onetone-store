import { and, eq, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { checkoutPaymentAttempts, invoices, orders, orderStatusLogs, users, userVouchers } from '@/lib/db/schema';
import { getSandboxInvoice } from '@/lib/xendit';
import { nextPaymentAttemptState } from './payment-attempt-policy';
import { sandboxVoucherEnabled } from './sandbox-voucher-gate';

type RecoveryRequest = {
  actorId: number;
  orderId: number;
  ownerId: number;
  attemptId: number;
  invoiceId: string;
  approvalRef: string;
};

export class SandboxInvoiceRecoveryRejected extends Error {
  constructor() { super('Sandbox invoice recovery requires operator reconciliation'); }
}

function isOperator(actor: Pick<typeof users.$inferSelect, 'role' | 'deletedAt'> | undefined) {
  return actor?.role === 'admin' && actor.deletedAt === null;
}

/** Internal operator tool. The caller must authenticate the operator and independently
 * confirm that there is exactly one matching invoice in the TEST provider account. */
export async function recoverSandboxVoucherInvoice(request: RecoveryRequest) {
  const { actorId, orderId, ownerId, attemptId, invoiceId, approvalRef } = request;
  if (!sandboxVoucherEnabled() ||
      ![actorId, orderId, ownerId, attemptId].every(id => Number.isSafeInteger(id) && id > 0) ||
      !/^[A-Za-z0-9_-]{1,255}$/.test(invoiceId) || !/^[A-Za-z0-9_-]{3,64}$/.test(approvalRef)) {
    throw new SandboxInvoiceRecoveryRejected();
  }
  const [actor] = await db.select({ role: users.role, deletedAt: users.deletedAt })
    .from(users).where(eq(users.id, actorId)).limit(1);
  if (!isOperator(actor)) throw new SandboxInvoiceRecoveryRejected();

  const checkedAt = Date.now();
  let remote: Awaited<ReturnType<typeof getSandboxInvoice>>;
  try {
    remote = await getSandboxInvoice(invoiceId);
  } catch {
    throw new SandboxInvoiceRecoveryRejected();
  }
  const expiresAt = new Date(remote.expiryDate);
  const url = URL.canParse(remote.invoiceUrl) ? new URL(remote.invoiceUrl) : null;
  if (remote.id !== invoiceId || remote.status !== 'PENDING' ||
      (remote.currency != null && remote.currency !== 'IDR') ||
      !Number.isSafeInteger(remote.amount) || remote.amount <= 0 ||
      !url || url.origin !== 'https://checkout-staging.xendit.co' || url.username || url.password ||
      !Number.isFinite(expiresAt.getTime())) {
    throw new SandboxInvoiceRecoveryRejected();
  }

  return db.transaction(async tx => {
    const [lockedActor] = await tx.select({ role: users.role, deletedAt: users.deletedAt })
      .from(users).where(eq(users.id, actorId)).for('update').limit(1);
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update').limit(1);
    if (!isOperator(lockedActor) || !order || order.userId !== ownerId || order.voucherId === null ||
        order.channel !== 'online' || order.status !== 'waiting_payment' ||
        !/^SBX-[a-f0-9]{36}$/.test(order.orderNumber) || order.orderNumber !== remote.externalId ||
        Number(order.total) !== remote.amount) {
      throw new SandboxInvoiceRecoveryRejected();
    }

    const attempts = await tx.select().from(checkoutPaymentAttempts)
      .where(eq(checkoutPaymentAttempts.orderId, orderId)).for('update').limit(2);
    const [attempt] = attempts;
    const existing = await tx.select().from(invoices).where(or(
      eq(invoices.orderId, orderId), eq(invoices.xenditId, invoiceId),
    )).for('update').limit(2);

    if (attempts.length !== 1 || attempt.id !== attemptId || attempt.attemptNo !== 1 ||
        attempt.mode !== 'sandbox' || attempt.externalId !== order.orderNumber ||
        Number(attempt.amount) !== remote.amount) {
      throw new SandboxInvoiceRecoveryRejected();
    }
    const [grant] = await tx.select().from(userVouchers).where(and(
      eq(userVouchers.userId, ownerId), eq(userVouchers.voucherId, order.voucherId),
    )).for('update').limit(1);
    const now = Date.now();
    if (!grant || grant.status !== 'reserved' || grant.reservedOrderId !== orderId ||
        !grant.reservedAt || grant.redeemedOrderId !== null || grant.redeemedAt !== null ||
        now < checkedAt || now - checkedAt > 30_000 || expiresAt.getTime() <= now) {
      throw new SandboxInvoiceRecoveryRejected();
    }

    if (attempt.status === 'ready' && attempt.xenditId === invoiceId &&
        existing.length === 1 && existing[0].orderId === orderId &&
        existing[0].xenditId === invoiceId && existing[0].status === 'pending' &&
        Number(existing[0].amount) === remote.amount) {
      return { outcome: 'already_recovered' as const, orderId, attemptId };
    }
    if (attempt.xenditId !== null || existing.length !== 0 ||
        nextPaymentAttemptState(attempt.status, 'reconciled_ready') !== 'ready') {
      throw new SandboxInvoiceRecoveryRejected();
    }

    await tx.insert(invoices).values({
      orderId, xenditId: invoiceId, invoiceUrl: url.href, amount: String(remote.amount),
      status: 'pending', expiredAt: expiresAt,
    });
    const [updated] = await tx.update(checkoutPaymentAttempts).set({
      status: 'ready', xenditId: invoiceId, invoiceUrl: url.href, resolvedAt: new Date(), lastErrorCode: null,
    }).where(and(eq(checkoutPaymentAttempts.id, attemptId), eq(checkoutPaymentAttempts.status, 'needs_reconciliation')));
    if (updated.affectedRows !== 1) throw new SandboxInvoiceRecoveryRejected();

    await tx.insert(orderStatusLogs).values({
      orderId, fromStatus: 'waiting_payment', toStatus: 'waiting_payment',
      changedBy: `admin:${actorId}`, note: `sandbox_invoice_recovered attempt=${attemptId} approval=${approvalRef}`,
    });
    return { outcome: 'recovered' as const, orderId, attemptId };
  });
}
