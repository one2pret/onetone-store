import { createHash } from 'node:crypto';
import { createInvoice } from '@/lib/xendit';
import { sandboxPaymentReturnUrl } from './sandbox-order-policy';
import {
  markSandboxAttemptNeedsReconciliation,
  persistReadySandboxInvoice,
  reserveAndClaimSandboxAttempt,
} from './sandbox-payment-attempt-store';

/** A separate, opt-in staging-only switch, never exposed to production. */
export function sandboxPaymentLedgerEnabled(
  flag?: string,
  appEnv?: string,
  key?: string,
): boolean {
  return flag === 'true' && appEnv === 'staging' &&
    typeof key === 'string' && key.startsWith('xnd_development_');
}

export function sandboxPaymentRequestHash(args: {
  userId: number; orderNumber: string; amount: number; payerEmail: string;
}): string {
  return createHash('sha256').update(JSON.stringify({
    version: 1, mode: 'sandbox', userId: args.userId,
    externalId: args.orderNumber, amount: args.amount,
    payerEmail: args.payerEmail,
    redirect: sandboxPaymentReturnUrl(),
    invoiceDuration: 86400,
  })).digest('hex');
}

/**
 * One-shot provider contact only after a durable claim commits.
 * All failures (including DB failures AFTER the provider succeeded) require
 * reconciliation. A retry of the same sandbox order must not create an
 * additional external invoice. This does NOT update order/webhook status.
 */
export async function createSandboxTestInvoiceWithLedger(args: {
  userId: number;
  orderId: number;
  orderNumber: string;
  total: number;
  payerEmail: string;
}): Promise<{ kind: 'ready'; paymentUrl: string } | { kind: 'pending' }> {
  if (!sandboxPaymentLedgerEnabled(
    process.env.CHECKOUT_SANDBOX_PAYMENT_LEDGER_ENABLED,
    process.env.APP_ENV,
    process.env.XENDIT_SECRET_KEY,
  )) {
    // If miscalled, fail CLOSED and do not fall through to an ungated
    // Xendit request. Route must call only when the flag is enabled.
    return { kind: 'pending' };
  }

  let attemptId: number;
  try {
    const claim = await reserveAndClaimSandboxAttempt({
      orderId: args.orderId, userId: args.userId,
      orderNumber: args.orderNumber, amount: args.total,
      requestHash: sandboxPaymentRequestHash({
        userId: args.userId, orderNumber: args.orderNumber,
        amount: args.total, payerEmail: args.payerEmail,
      }),
    });
    if (claim.kind === 'pending') return { kind: 'pending' };
    attemptId = claim.attemptId;
  } catch {
    // Order may already be committed. Returning 202 is safer than reporting
    // an unqualified checkout failure and inviting a new idempotency key.
    console.error('sandbox_invoice_setup', { orderId: args.orderId, outcome: 'claim_unavailable' });
    return { kind: 'pending' };
  }

  try {
    const payment = await createInvoice({
      externalId: args.orderNumber,
      amount: args.total,
      payerEmail: args.payerEmail,
      description: 'Pembayaran staging order ' + args.orderNumber,
      orderId: args.orderId,
      successRedirectUrl: sandboxPaymentReturnUrl(),
      failureRedirectUrl: sandboxPaymentReturnUrl(),
    });
    await persistReadySandboxInvoice({
      attemptId, orderId: args.orderId, externalId: args.orderNumber,
      amount: args.total, xenditId: payment.id,
      invoiceUrl: payment.invoiceUrl, expiredAt: new Date(payment.expiryDate),
    });
    return { kind: 'ready', paymentUrl: payment.invoiceUrl };
  } catch {
    // Cannot infer Xendit did not create an invoice on timeout/crash.
    // NEVER retry createInvoice automatically for this attempt.
    try {
      await markSandboxAttemptNeedsReconciliation(attemptId);
      console.error('sandbox_invoice_setup', { orderId: args.orderId, attemptId, outcome: 'needs_reconciliation' });
    } catch {
      // Remaining 'requesting' is also non-replayable; an operator must
      // look up the attempt before further contact with Xendit.
      console.error('sandbox_invoice_setup', { orderId: args.orderId, attemptId, outcome: 'reconciliation_write_failed' });
    }
    return { kind: 'pending' };
  }
}
