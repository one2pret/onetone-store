import { createHash } from 'node:crypto';

/** Fail closed unless an operator opts in AND the Xendit key is non-live. */
export function sandboxOrderEnabled(flag?: string, xenditKey?: string): boolean {
  return flag === 'true' && typeof xenditKey === 'string' &&
    xenditKey.startsWith('xnd_development_');
}

/**
 * Android TEST invoices should never redirect a browser into a customer's
 * order detail. Chrome has an independent login session from the APK and can
 * already be signed in as an admin or a different customer.
 *
 * This is a fixed public STAGING landing page with no order ID, token,
 * payment status, or PII. Both success and failure go to the same neutral
 * page; only the authenticated app/backend determines payment outcome.
 */
export function sandboxPaymentReturnUrl(): string {
  return 'https://onetone.kanuraga.web.id/payment/sandbox-return';
}

/** Stable, unique order number per user + client-generated UUID retry key. */
export function sandboxOrderNumber(userId: number, idempotencyKey: string): string {
  const digest = createHash('sha256')
    .update(String(userId) + ':' + idempotencyKey.toLowerCase())
    .digest('hex')
    .slice(0, 36);
  return 'SBX-' + digest;
}
