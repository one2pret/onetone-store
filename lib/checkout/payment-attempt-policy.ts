/**
 * Pure policy for durable checkout payment provider attempts.
 *
 * This file never calls a provider, never reads/writes DB and cannot enable
 * production checkout. Provider timeouts are UNKNOWN, not safe to retry.
 */

export type PaymentAttemptState =
  | 'reserved'
  | 'requesting'
  | 'needs_reconciliation'
  | 'ready'
  | 'paid'
  | 'expired'
  | 'failed';

export type PaymentAttemptEvent =
  | 'claim_request'
  | 'provider_unknown'
  | 'provider_ready'
  | 'confirmed_not_created'
  | 'reconciled_ready'
  | 'reconciled_paid'
  | 'reconciled_expired'
  | 'confirmed_paid'
  | 'confirmed_expired';

const transitions: Readonly<Record<PaymentAttemptState, Readonly<Partial<Record<
  PaymentAttemptEvent, PaymentAttemptState
>>>>> = {
  reserved: { claim_request: 'requesting' },
  requesting: {
    provider_unknown: 'needs_reconciliation',
    provider_ready: 'ready',
    // Only a conclusive provider response guarantees that no invoice was created.
    confirmed_not_created: 'failed',
  },
  needs_reconciliation: {
    reconciled_ready: 'ready',
    reconciled_paid: 'paid',
    reconciled_expired: 'expired',
    confirmed_not_created: 'failed',
  },
  ready: { confirmed_paid: 'paid', confirmed_expired: 'expired' },
  paid: {},
  expired: {},
  failed: {},
};

/**
 * A null result means the transition is prohibited.
 * Callers must persist transitions with a conditional WHERE status=expected
 * and affectedRows=1 inside a transaction. Never rely on this function alone
 * to handle concurrency or exactly-once effects.
 */
export function nextPaymentAttemptState(
  state: PaymentAttemptState,
  event: PaymentAttemptEvent,
): PaymentAttemptState | null {
  return transitions[state][event] ?? null;
}

/** True ONLY before an external provider request has ever been claimed. */
export function mayClaimProviderRequest(state: PaymentAttemptState): boolean {
  return state === 'reserved';
}

/** Timeout/crash is ambiguous: do not blindly issue another create request. */
export function mustReconcileBeforeNewProviderCall(state: PaymentAttemptState): boolean {
  return state === 'requesting' || state === 'needs_reconciliation';
}

export function isPaymentAttemptTerminal(state: PaymentAttemptState): boolean {
  return state === 'paid' || state === 'expired' || state === 'failed';
}
