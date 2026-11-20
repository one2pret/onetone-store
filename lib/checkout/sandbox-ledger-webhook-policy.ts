import { nextPaymentAttemptState, type PaymentAttemptState } from './payment-attempt-policy';

/**
 * A signed and invoice-identity-matched sandbox callback is trusted evidence
 * only AFTER the caller verifies the stored invoice, order, amount and ledger
 * provider ID under the same database transaction.
 */
export function sandboxLedgerWebhookTransition(
  current: PaymentAttemptState,
  event: 'PAID' | 'EXPIRED',
): 'already' | 'conflict' | 'paid' | 'expired' {
  const target = event === 'PAID' ? 'paid' : 'expired';
  if (current === target) return 'already';

  const policyEvent = current === 'needs_reconciliation'
    ? event === 'PAID' ? 'reconciled_paid' : 'reconciled_expired'
    : event === 'PAID' ? 'confirmed_paid' : 'confirmed_expired';
  return nextPaymentAttemptState(current, policyEvent) === target
    ? target : 'conflict';
}
