import { createHash } from 'node:crypto';

/** Fail closed unless an operator opts in AND the Xendit key is non-live. */
export function sandboxOrderEnabled(flag?: string, xenditKey?: string): boolean {
  return flag === 'true' && typeof xenditKey === 'string' &&
    xenditKey.startsWith('xnd_development_');
}

/** Stable, unique order number per user + client-generated UUID retry key. */
export function sandboxOrderNumber(userId: number, idempotencyKey: string): string {
  const digest = createHash('sha256')
    .update(String(userId) + ':' + idempotencyKey.toLowerCase())
    .digest('hex')
    .slice(0, 36);
  return 'SBX-' + digest;
}
