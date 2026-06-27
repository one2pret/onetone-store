import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock xendit-node SDK
const mockCreateInvoice = vi.fn();
const mockExpireInvoice = vi.fn();

vi.mock('xendit-node', () => ({
  default: class Xendit {
    constructor() {}
    Invoice = {
      createInvoice: mockCreateInvoice,
      expireInvoice: mockExpireInvoice,
    };
  },
}));

beforeEach(() => {
  vi.stubEnv('XENDIT_SECRET_KEY', 'xnd_test_secret_key');
  vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'http://localhost:3000');
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

import { createInvoice, expireInvoice } from '@/lib/xendit';

describe('Xendit API Client', () => {
  describe('createInvoice', () => {
    it('creates invoice with correct params', async () => {
      mockCreateInvoice.mockResolvedValue({
        id: 'inv_xendit_123',
        invoiceUrl: 'https://checkout.xendit.co/inv_123',
        expiryDate: '2025-01-02T00:00:00.000Z',
      });

      const result = await createInvoice({
        externalId: 'ORD250101ABCD',
        amount: 1163000,
        payerEmail: 'john@example.com',
        description: 'Order ORD250101ABCD',
      });

      expect(mockCreateInvoice).toHaveBeenCalledWith({
        data: expect.objectContaining({
          externalId: 'ORD250101ABCD',
          amount: 1163000,
          payerEmail: 'john@example.com',
          description: 'Order ORD250101ABCD',
          successRedirectUrl: 'http://localhost:3000/orders',
          failureRedirectUrl: 'http://localhost:3000/orders',
          invoiceDuration: 86400,
        }),
      });

      expect(result.id).toBe('inv_xendit_123');
      expect(result.invoiceUrl).toBe('https://checkout.xendit.co/inv_123');
    });

    it('uses custom successRedirectUrl and failureRedirectUrl', async () => {
      mockCreateInvoice.mockResolvedValue({
        id: 'inv_123',
        invoiceUrl: 'https://checkout.xendit.co/inv_123',
        expiryDate: '2025-01-02T00:00:00.000Z',
      });

      await createInvoice({
        externalId: 'ORD001',
        amount: 100000,
        payerEmail: 'test@test.com',
        description: 'Test',
        successRedirectUrl: 'http://localhost:3000/success',
        failureRedirectUrl: 'http://localhost:3000/fail',
      });

      expect(mockCreateInvoice).toHaveBeenCalledWith({
        data: expect.objectContaining({
          successRedirectUrl: 'http://localhost:3000/success',
          failureRedirectUrl: 'http://localhost:3000/fail',
        }),
      });
    });

    it('uses default 24h duration', async () => {
      mockCreateInvoice.mockResolvedValue({
        id: 'inv_123',
        invoiceUrl: 'https://checkout.xendit.co/inv_123',
        expiryDate: '2025-01-02T00:00:00.000Z',
      });

      await createInvoice({
        externalId: 'ORD001',
        amount: 100000,
        payerEmail: 'test@test.com',
        description: 'Test',
      });

      expect(mockCreateInvoice).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceDuration: 86400,
        }),
      });
    });

    it('uses custom duration', async () => {
      mockCreateInvoice.mockResolvedValue({
        id: 'inv_123',
        invoiceUrl: 'https://checkout.xendit.co/inv_123',
        expiryDate: '2025-01-02T00:00:00.000Z',
      });

      await createInvoice({
        externalId: 'ORD001',
        amount: 100000,
        payerEmail: 'test@test.com',
        description: 'Test',
        invoiceDuration: 3600,
      });

      expect(mockCreateInvoice).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceDuration: 3600,
        }),
      });
    });

    it('throws on Xendit API error', async () => {
      mockCreateInvoice.mockRejectedValue(new Error('Xendit: Invalid API key'));

      await expect(
        createInvoice({
          externalId: 'ORD001',
          amount: 100000,
          payerEmail: 'test@test.com',
          description: 'Test',
        }),
      ).rejects.toThrow('Xendit: Invalid API key');
    });

    it('throws on missing XENDIT_SECRET_KEY', async () => {
      vi.stubEnv('XENDIT_SECRET_KEY', '');

      await expect(
        createInvoice({
          externalId: 'ORD001',
          amount: 100000,
          payerEmail: 'test@test.com',
          description: 'Test',
        }),
      ).rejects.toThrow('XENDIT_SECRET_KEY');
    });
  });

  describe('expireInvoice', () => {
    it('expires invoice successfully', async () => {
      mockExpireInvoice.mockResolvedValue({ id: 'inv_123', status: 'EXPIRED' });

      await expect(expireInvoice('inv_123')).resolves.not.toThrow();

      expect(mockExpireInvoice).toHaveBeenCalledWith({
        invoiceId: 'inv_123',
      });
    });

    it('treats already-expired as success', async () => {
      mockExpireInvoice.mockRejectedValue(
        Object.assign(new Error('INVOICE_ALREADY_EXPIRED'), { status: 404 }),
      );

      await expect(expireInvoice('inv_123')).resolves.not.toThrow();
    });

    it('throws on other errors', async () => {
      mockExpireInvoice.mockRejectedValue(new Error('Server error'));

      await expect(expireInvoice('inv_123')).rejects.toThrow('Server error');
    });
  });
});
