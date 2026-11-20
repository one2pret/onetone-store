import { describe, expect, it } from 'vitest';
import { sandboxLedgerWebhookTransition } from './sandbox-ledger-webhook-policy';

describe('Xendit TEST ledger webhook transitions (pure policy)', () => {
  it('settles an invoice with authenticated provider evidence', () => {
    expect(sandboxLedgerWebhookTransition('ready', 'PAID')).toBe('paid');
    expect(sandboxLedgerWebhookTransition('ready', 'EXPIRED')).toBe('expired');
    expect(sandboxLedgerWebhookTransition('needs_reconciliation', 'PAID')).toBe('paid');
    expect(sandboxLedgerWebhookTransition('needs_reconciliation', 'EXPIRED')).toBe('expired');
  });

  it('keeps identical webhook replay idempotent', () => {
    expect(sandboxLedgerWebhookTransition('paid', 'PAID')).toBe('already');
    expect(sandboxLedgerWebhookTransition('expired', 'EXPIRED')).toBe('already');
  });

  it('rejects reverse terminal, unknown, unclaimed and failed states', () => {
    expect(sandboxLedgerWebhookTransition('paid', 'EXPIRED')).toBe('conflict');
    expect(sandboxLedgerWebhookTransition('expired', 'PAID')).toBe('conflict');
    expect(sandboxLedgerWebhookTransition('reserved', 'PAID')).toBe('conflict');
    expect(sandboxLedgerWebhookTransition('requesting', 'PAID')).toBe('conflict');
    expect(sandboxLedgerWebhookTransition('failed', 'PAID')).toBe('conflict');
    expect(sandboxLedgerWebhookTransition('failed', 'EXPIRED')).toBe('conflict');
  });
});
