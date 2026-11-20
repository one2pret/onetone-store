import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reserve: vi.fn(),
  persist: vi.fn(),
  unknown: vi.fn(),
  createInvoice: vi.fn(),
}));

vi.mock('@/lib/checkout/sandbox-payment-attempt-store', () => ({
  reserveAndClaimSandboxAttempt: mocks.reserve,
  persistReadySandboxInvoice: mocks.persist,
  markSandboxAttemptNeedsReconciliation: mocks.unknown,
}));
vi.mock('@/lib/xendit', () => ({ createInvoice: mocks.createInvoice }));

import {
  createSandboxTestInvoiceWithLedger,
  sandboxPaymentLedgerEnabled,
  sandboxPaymentRequestHash,
} from './sandbox-payment-invoice-service';

const valid = {
  userId: 4, orderId: 20,
  orderNumber: 'SBX-' + 'a'.repeat(36),
  total: 1599000, payerEmail: 'test@example.invalid',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('APP_ENV', 'staging');
  vi.stubEnv('XENDIT_SECRET_KEY', 'xnd_development_FAKE_FOR_TEST');
  vi.stubEnv('CHECKOUT_SANDBOX_PAYMENT_LEDGER_ENABLED', 'true');
  mocks.reserve.mockResolvedValue({ kind: 'claimed', attemptId: 50 });
  mocks.persist.mockResolvedValue(undefined);
  mocks.unknown.mockResolvedValue(undefined);
  mocks.createInvoice.mockResolvedValue({
    id: 'inv_TEST_20', invoiceUrl: 'https://test.example.invalid/invoice',
    expiryDate: new Date(Date.now() + 86400000).toISOString(),
  });
});
afterEach(() => vi.unstubAllEnvs());

describe('Xendit TEST payment ledger service (no network/database)', () => {
  it('is OFF by default, production environment or production credentials', async () => {
    expect(sandboxPaymentLedgerEnabled(undefined, 'staging', 'xnd_development_x')).toBe(false);
    expect(sandboxPaymentLedgerEnabled('true', 'production', 'xnd_development_x')).toBe(false);
    expect(sandboxPaymentLedgerEnabled('true', 'staging', 'xnd_production_x')).toBe(false);
    expect(sandboxPaymentLedgerEnabled('true', 'staging', 'xnd_development_x')).toBe(true);
    vi.stubEnv('APP_ENV', 'production');
    expect(await createSandboxTestInvoiceWithLedger(valid)).toEqual({ kind: 'pending' });
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.createInvoice).not.toHaveBeenCalled();
  });

  it('uses deterministic request evidence tied to order, amount and payer', () => {
    const evidence = {
      userId: valid.userId,
      orderNumber: valid.orderNumber,
      amount: valid.total,
      payerEmail: valid.payerEmail,
    };
    const hash = sandboxPaymentRequestHash(evidence);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(sandboxPaymentRequestHash({ ...evidence }));
    expect(hash).not.toBe(sandboxPaymentRequestHash({ ...evidence, amount: evidence.amount + 1 }));
    expect(hash).not.toBe(sandboxPaymentRequestHash({ ...evidence, userId: 5 }));
  });

  it('reserves and claims BEFORE Xendit TEST and persists invoice result', async () => {
    const result = await createSandboxTestInvoiceWithLedger(valid);
    expect(result).toEqual({ kind: 'ready', paymentUrl: 'https://test.example.invalid/invoice' });
    expect(mocks.reserve).toHaveBeenCalledOnce();
    expect(mocks.reserve).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 20, userId: 4, amount: 1599000, orderNumber: valid.orderNumber,
      requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    }));
    expect(mocks.createInvoice).toHaveBeenCalledOnce();
    expect(mocks.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      externalId: valid.orderNumber,
      amount: valid.total,
      successRedirectUrl: 'https://onetone.kanuraga.web.id/payment/sandbox-return',
      failureRedirectUrl: 'https://onetone.kanuraga.web.id/payment/sandbox-return',
    }));
    expect(mocks.persist).toHaveBeenCalledOnce();
    expect(mocks.persist).toHaveBeenCalledWith(expect.objectContaining({
      attemptId: 50, orderId: 20, xenditId: 'inv_TEST_20',
    }));
    expect(mocks.unknown).not.toHaveBeenCalled();
    // The claim must resolve before the network operation is initiated.
    expect(mocks.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createInvoice.mock.invocationCallOrder[0]);
  });

  it('never contacts Xendit if reservation already exists', async () => {
    mocks.reserve.mockResolvedValueOnce({ kind: 'pending' });
    expect(await createSandboxTestInvoiceWithLedger(valid)).toEqual({ kind: 'pending' });
    expect(mocks.createInvoice).not.toHaveBeenCalled();
  });

  it('never contacts Xendit when DB reservation fails', async () => {
    mocks.reserve.mockRejectedValueOnce(new Error('DB connection closed'));
    expect(await createSandboxTestInvoiceWithLedger(valid)).toEqual({ kind: 'pending' });
    expect(mocks.createInvoice).not.toHaveBeenCalled();
  });

  it('does not blindly repeat provider calls after timeout', async () => {
    mocks.createInvoice.mockRejectedValueOnce(new Error('timeout: unknown remote result'));
    expect(await createSandboxTestInvoiceWithLedger(valid)).toEqual({ kind: 'pending' });
    expect(mocks.createInvoice).toHaveBeenCalledTimes(1);
    expect(mocks.unknown).toHaveBeenCalledExactlyOnceWith(50);
  });

  it('requires reconciliation after provider succeeded but DB invoice storage failed', async () => {
    mocks.persist.mockRejectedValueOnce(new Error('database unavailable'));
    expect(await createSandboxTestInvoiceWithLedger(valid)).toEqual({ kind: 'pending' });
    expect(mocks.createInvoice).toHaveBeenCalledTimes(1);
    expect(mocks.unknown).toHaveBeenCalledExactlyOnceWith(50);
  });

  it('fails closed even if persisting reconciliation also fails', async () => {
    mocks.createInvoice.mockRejectedValueOnce(new Error('unknown response'));
    mocks.unknown.mockRejectedValueOnce(new Error('database unavailable'));
    expect(await createSandboxTestInvoiceWithLedger(valid)).toEqual({ kind: 'pending' });
    expect(mocks.createInvoice).toHaveBeenCalledTimes(1);
  });
});
