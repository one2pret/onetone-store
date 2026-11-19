import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { checkoutPaymentAttempts, invoices, orders } from '@/lib/db/schema';
import { nextPaymentAttemptState } from './payment-attempt-policy';

/**
 * Only for Xendit TEST sandbox order number (SBX-...) and an existing
 * committed order. No provider calls in these transactions.
 *
 * Locking the parent order serializes competing payment reservations, while
 * the unique keys protect against other code paths or concurrent workers.
 * Never claim a second attempt automatically, even if the first appears to
 * be stuck in 'requesting'; the provider outcome may be unknown.
 */
export async function reserveAndClaimSandboxAttempt(args: {
  orderId: number;
  userId: number;
  orderNumber: string;
  amount: number;
  requestHash: string;
}): Promise<{ kind: 'claimed'; attemptId: number } | { kind: 'pending' }> {
  if (!/^SBX-[a-f0-9]{36}$/.test(args.orderNumber) ||
      !Number.isSafeInteger(args.orderId) || args.orderId <= 0 ||
      !Number.isSafeInteger(args.userId) || args.userId <= 0 ||
      !Number.isSafeInteger(args.amount) || args.amount <= 0 ||
      !/^[a-f0-9]{64}$/.test(args.requestHash)) {
    throw new Error('Invalid sandbox payment reservation');
  }

  return db.transaction(async (tx) => {
    const [order] = await tx.select({
      id: orders.id, userId: orders.userId,
      orderNumber: orders.orderNumber, total: orders.total,
      channel: orders.channel, status: orders.status,
    }).from(orders).where(eq(orders.id, args.orderId)).for('update').limit(1);

    if (!order || order.userId !== args.userId ||
        order.orderNumber !== args.orderNumber ||
        order.channel !== 'online' || order.status !== 'waiting_payment' ||
        Number(order.total) !== args.amount) {
      throw new Error('Sandbox order is not eligible for Xendit invoice');
    }

    const [existing] = await tx.select({ id: checkoutPaymentAttempts.id })
      .from(checkoutPaymentAttempts)
      .where(eq(checkoutPaymentAttempts.orderId, args.orderId))
      .limit(1);
    if (existing) return { kind: 'pending' as const };

    // No ledger entry yet does not mean that an earlier untracked provider
    // call did not succeed. Reject any order with a legacy invoice record.
    const [previousInvoice] = await tx.select({ id: invoices.id }).from(invoices)
      .where(eq(invoices.orderId, args.orderId)).limit(1);
    if (previousInvoice) return { kind: 'pending' as const };

    const [inserted] = await tx.insert(checkoutPaymentAttempts).values({
      orderId: args.orderId,
      attemptNo: 1,
      mode: 'sandbox',
      externalId: args.orderNumber,
      requestHash: args.requestHash,
      amount: String(args.amount),
      status: 'reserved',
    });
    const attemptId = Number(inserted.insertId);
    if (!Number.isSafeInteger(attemptId) || attemptId <= 0 ||
        nextPaymentAttemptState('reserved', 'claim_request') !== 'requesting') {
      throw new Error('Could not reserve sandbox payment attempt');
    }

    const [claimed] = await tx.update(checkoutPaymentAttempts)
      .set({ status: 'requesting', requestedAt: new Date() })
      .where(and(
        eq(checkoutPaymentAttempts.id, attemptId),
        eq(checkoutPaymentAttempts.status, 'reserved'),
      ));
    if (claimed.affectedRows !== 1) {
      throw new Error('Sandbox payment attempt could not be claimed');
    }

    // Transaction commits BEFORE the caller may contact Xendit.
    return { kind: 'claimed' as const, attemptId };
  });
}

export async function markSandboxAttemptNeedsReconciliation(attemptId: number) {
  if (nextPaymentAttemptState('requesting', 'provider_unknown') !== 'needs_reconciliation') {
    throw new Error('Invalid payment transition');
  }
  await db.update(checkoutPaymentAttempts)
    .set({ status: 'needs_reconciliation', lastErrorCode: 'unknown_provider_outcome' })
    .where(and(
      eq(checkoutPaymentAttempts.id, attemptId),
      eq(checkoutPaymentAttempts.mode, 'sandbox'),
      eq(checkoutPaymentAttempts.status, 'requesting'),
    ));
}

/**
 * Commit the ready invoice and the ledger outcome atomically. If either write
 * fails, both roll back. The previously claimed attempt remains ambiguous and
 * the caller must mark it for reconciliation, never automatically retry Xendit.
 */
export async function persistReadySandboxInvoice(args: {
  attemptId: number;
  orderId: number;
  externalId: string;
  amount: number;
  xenditId: string;
  invoiceUrl: string;
  expiredAt: Date;
}): Promise<void> {
  if (!args.xenditId || !args.invoiceUrl ||
      args.expiredAt.getTime() <= Date.now() ||
      !Number.isSafeInteger(args.amount) || args.amount <= 0) {
    throw new Error('Invalid Xendit TEST invoice response');
  }
  await db.transaction(async tx => {
    const [attempt] = await tx.select().from(checkoutPaymentAttempts)
      .where(eq(checkoutPaymentAttempts.id, args.attemptId)).for('update').limit(1);
    if (!attempt || attempt.status !== 'requesting' ||
        attempt.mode !== 'sandbox' || attempt.orderId !== args.orderId ||
        attempt.externalId !== args.externalId ||
        Number(attempt.amount) !== args.amount ||
        nextPaymentAttemptState('requesting', 'provider_ready') !== 'ready') {
      throw new Error('Invoice result does not match claimed TEST attempt');
    }
    const [alreadyStored] = await tx.select({ id: invoices.id }).from(invoices)
      .where(eq(invoices.orderId, args.orderId)).limit(1);
    if (alreadyStored) throw new Error('An invoice already exists for this order');

    await tx.insert(invoices).values({
      orderId: args.orderId, xenditId: args.xenditId,
      invoiceUrl: args.invoiceUrl, amount: String(args.amount),
      status: 'pending', expiredAt: args.expiredAt,
    });
    const [updated] = await tx.update(checkoutPaymentAttempts).set({
      status: 'ready', xenditId: args.xenditId,
      invoiceUrl: args.invoiceUrl, resolvedAt: new Date(),
    }).where(and(
      eq(checkoutPaymentAttempts.id, args.attemptId),
      eq(checkoutPaymentAttempts.mode, 'sandbox'),
      eq(checkoutPaymentAttempts.status, 'requesting'),
    ));
    if (updated.affectedRows !== 1) throw new Error('Unable to persist invoice result');
  });
}
