import { describe, expect, it } from 'vitest';
import {
  parseSandboxInvoiceEvent,
  sandboxPaymentDecision,
  validCallbackToken,
} from './sandbox-xendit-webhook';

const base = {
  id: 'inv_123',
  external_id: 'SBX-' + 'a'.repeat(36),
  status: 'PAID',
  currency: 'IDR',
  amount: 65300,
  paid_amount: 65300,
  payment_method: 'BANK_TRANSFER',
};

describe('Xendit sandbox webhook authentication', () => {
  it('requires a configured secret and an exact callback token', () => {
    expect(validCallbackToken('token-123', 'token-123')).toBe(true);
    expect(validCallbackToken('token-123', 'token-124')).toBe(false);
    expect(validCallbackToken('token', 'token-123')).toBe(false);
    expect(validCallbackToken(null, 'token-123')).toBe(false);
    expect(validCallbackToken('token-123', undefined)).toBe(false);
  });
});

describe('sandbox callback payload', () => {
  it('accepts only legacy invoice event tied to a staging order', () => {
    const parsed = parseSandboxInvoiceEvent(base);
    expect(parsed.kind).toBe('event');
    if (parsed.kind === 'event') {
      expect(parsed.event.orderNumber).toBe(base.external_id);
      expect(parsed.event.amount).toBe(65300);
    }
  });
  it('rejects a regular web order, currency mismatch, and underpayment', () => {
    expect(parseSandboxInvoiceEvent({ ...base, external_id: 'ORD-123' }).kind).toBe('invalid');
    expect(parseSandboxInvoiceEvent({ ...base, currency: 'USD' }).kind).toBe('invalid');
    expect(parseSandboxInvoiceEvent({ ...base, paid_amount: 1 }).kind).toBe('invalid');
    expect(parseSandboxInvoiceEvent({ ...base, amount: '65300' }).kind).toBe('invalid');
  });
  it('accepts expired event and ignores CREATED or PENDING', () => {
    expect(parseSandboxInvoiceEvent({ ...base, status: 'EXPIRED', paid_amount: null }).kind).toBe('event');
    expect(parseSandboxInvoiceEvent({ ...base, status: 'PENDING' }).kind).toBe('ignored');
  });
  it('rejects the new API payment.capture structure', () => {
    expect(parseSandboxInvoiceEvent({
      event: 'payment.capture', data: { payment_id: 'abc' },
    }).kind).toBe('invalid');
  });
});

describe('sandbox webhook terminal state machine', () => {
  it('accepts only a pending invoice on waiting_payment order', () => {
    expect(sandboxPaymentDecision('PAID', 'pending', 'waiting_payment')).toBe('pay');
    expect(sandboxPaymentDecision('EXPIRED', 'pending', 'waiting_payment')).toBe('expire');
  });
  it('makes identical repeated callbacks harmless', () => {
    expect(sandboxPaymentDecision('PAID', 'paid', 'packing')).toBe('duplicate');
    expect(sandboxPaymentDecision('PAID', 'paid', 'shipping')).toBe('duplicate');
    expect(sandboxPaymentDecision('EXPIRED', 'expired', 'expired')).toBe('duplicate');
  });
  it('does not expire paid orders or fulfill expired ones', () => {
    expect(sandboxPaymentDecision('EXPIRED', 'paid', 'packing')).toBe('conflict');
    expect(sandboxPaymentDecision('PAID', 'expired', 'expired')).toBe('conflict');
    expect(sandboxPaymentDecision('PAID', 'pending', 'cancelled')).toBe('conflict');
  });
});
