import { describe, expect, it } from 'vitest';
import {
  isPaymentAttemptTerminal, mayClaimProviderRequest,
  mustReconcileBeforeNewProviderCall, nextPaymentAttemptState,
} from './payment-attempt-policy';

describe('payment attempt state machine (pure; no provider calls)', () => {
  it('allows only the initial durable claim to contact Xendit', () => {
    expect(mayClaimProviderRequest('reserved')).toBe(true);
    for (const state of ['requesting', 'needs_reconciliation', 'ready',
      'paid', 'expired', 'failed'] as const) {
      expect(mayClaimProviderRequest(state)).toBe(false);
    }
    expect(nextPaymentAttemptState('reserved', 'claim_request')).toBe('requesting');
    expect(nextPaymentAttemptState('requesting', 'claim_request')).toBeNull();
  });

  it('moves timeout/ambiguous outcome into reconciliation, not retry', () => {
    expect(nextPaymentAttemptState('requesting', 'provider_unknown')).toBe('needs_reconciliation');
    expect(mustReconcileBeforeNewProviderCall('requesting')).toBe(true);
    expect(mustReconcileBeforeNewProviderCall('needs_reconciliation')).toBe(true);
    expect(nextPaymentAttemptState('needs_reconciliation', 'claim_request')).toBeNull();
  });

  it('only permits a failed state when the provider conclusively rejected creation', () => {
    expect(nextPaymentAttemptState('requesting', 'confirmed_not_created')).toBe('failed');
    expect(nextPaymentAttemptState('needs_reconciliation', 'confirmed_not_created')).toBe('failed');
    expect(nextPaymentAttemptState('ready', 'confirmed_not_created')).toBeNull();
    expect(nextPaymentAttemptState('reserved', 'confirmed_not_created')).toBeNull();
  });

  it('supports provider reconciliation for pending/paid/expired results', () => {
    expect(nextPaymentAttemptState('requesting', 'provider_ready')).toBe('ready');
    expect(nextPaymentAttemptState('needs_reconciliation', 'reconciled_ready')).toBe('ready');
    expect(nextPaymentAttemptState('needs_reconciliation', 'reconciled_paid')).toBe('paid');
    expect(nextPaymentAttemptState('needs_reconciliation', 'reconciled_expired')).toBe('expired');
    expect(nextPaymentAttemptState('ready', 'confirmed_paid')).toBe('paid');
    expect(nextPaymentAttemptState('ready', 'confirmed_expired')).toBe('expired');
  });

  it('keeps all final provider outcomes terminal and non-replayable', () => {
    for (const state of ['paid', 'expired', 'failed'] as const) {
      expect(isPaymentAttemptTerminal(state)).toBe(true);
      for (const event of ['claim_request', 'provider_unknown', 'provider_ready',
        'confirmed_not_created', 'confirmed_paid', 'confirmed_expired',
        'reconciled_paid', 'reconciled_expired'] as const) {
        expect(nextPaymentAttemptState(state, event)).toBeNull();
      }
    }
    expect(isPaymentAttemptTerminal('needs_reconciliation')).toBe(false);
    expect(isPaymentAttemptTerminal('ready')).toBe(false);
  });
});
