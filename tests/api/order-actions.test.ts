import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sampleOrder, sampleInvoice, sampleShipping } from '../helpers/fixtures';

const mockSelectReturn = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => {
      const chain = {
        from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(),
        then: (resolve: (value: unknown) => unknown) => resolve(mockSelectReturn()),
        catch: () => chain,
      };
      chain.from.mockReturnValue(chain);
      chain.where.mockReturnValue(chain);
      chain.orderBy.mockReturnValue(chain);
      chain.limit.mockReturnValue(chain);
      return chain;
    }),
    insert: vi.fn(() => {
      const chain = {
        values: vi.fn(),
        then: (resolve: (value: unknown) => unknown) => resolve([{ insertId: 1 }]),
        catch: () => chain,
      };
      chain.values.mockReturnValue(chain);
      return chain;
    }),
    update: vi.fn(() => {
      const chain = {
        set: vi.fn(), where: vi.fn(),
        then: (resolve: (value: unknown) => unknown) => resolve(undefined),
        catch: () => chain,
      };
      chain.set.mockReturnValue(chain);
      chain.where.mockReturnValue(chain);
      return chain;
    }),
  },
}));

vi.mock('@/lib/api-auth', () => ({
  getApiUser: vi.fn(() =>
    Promise.resolve({ id: 2, name: 'John', email: 'john@example.com', role: 'customer', phone: null })
  ),
}));

vi.mock('@/lib/stock', () => ({
  restoreStock: vi.fn(() => Promise.resolve()),
  deductStock: vi.fn(() => Promise.resolve()),
  validateStock: vi.fn(() => Promise.resolve({ valid: true, errors: [] })),
}));

vi.mock('@/lib/xendit', () => ({
  expireInvoice: vi.fn(() => Promise.resolve()),
  createInvoice: vi.fn(() => Promise.resolve({
    id: 'inv_new',
    invoiceUrl: 'https://xendit.co/inv_new',
    expiryDate: '2026-01-02T00:00:00Z',
  })),
}));

import { createInvoice, expireInvoice } from '@/lib/xendit';
import { restoreStock } from '@/lib/stock';
import { POST as cancel } from '@/app/api/orders/[id]/cancel/route';
import { POST as repay } from '@/app/api/orders/[id]/repay/route';
import { GET as tracking } from '@/app/api/orders/[id]/tracking/route';

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('Order Action APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
  });

  describe('POST /api/orders/[id]/cancel', () => {
    it('cancels waiting_payment order', async () => {
      mockSelectReturn
        .mockReturnValueOnce([sampleOrder]) // order
        .mockReturnValueOnce([sampleInvoice]); // invoice

      const response = await cancel(
        makeRequest('http://localhost/api/orders/1/cancel', { method: 'POST' }),
        makeParams('1'),
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it('keeps sandbox voucher cancellation out of the legacy route', async () => {
      mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, orderNumber: 'SBX-voucher', voucherId: 42 }]);

      const response = await cancel(
        makeRequest('http://localhost/api/orders/1/cancel', { method: 'POST' }),
        makeParams('1'),
      );

      expect(response.status).toBe(404);
      expect(expireInvoice).not.toHaveBeenCalled();
      expect(restoreStock).not.toHaveBeenCalled();
    });

    it('rejects cancellation for packing order', async () => {
      mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'packing' }]);

      const response = await cancel(
        makeRequest('http://localhost/api/orders/1/cancel', { method: 'POST' }),
        makeParams('1'),
      );

      expect(response.status).toBe(400);
    });

    it('returns 404 for another users order', async () => {
      mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, userId: 999 }]);

      const response = await cancel(
        makeRequest('http://localhost/api/orders/1/cancel', { method: 'POST' }),
        makeParams('1'),
      );

      expect(response.status).toBe(404);
    });

    it('returns 401 when not authenticated', async () => {
      const { getApiUser } = await import('@/lib/api-auth');
      vi.mocked(getApiUser).mockResolvedValueOnce(null);

      const response = await cancel(
        makeRequest('http://localhost/api/orders/1/cancel', { method: 'POST' }),
        makeParams('1'),
      );

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/orders/[id]/repay', () => {
    it('blocks repayment for a sandbox voucher order before calling the provider', async () => {
      mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder,
        orderNumber: 'SBX-voucher', voucherId: 42, status: 'expired',
      }]);

      const response = await repay(
        makeRequest('http://localhost/api/orders/1/repay', { method: 'POST' }),
        makeParams('1'),
      );

      expect(response.status).toBe(409);
      expect(createInvoice).not.toHaveBeenCalled();
    });

    it('creates new invoice for expired order', async () => {
      mockSelectReturn
        .mockReturnValueOnce([{ ...sampleOrder, status: 'expired', orderNumber: 'ORD001', total: '1000000' }])
        .mockReturnValueOnce([{ id: 1, orderId: 1, productId: 1, quantity: 1, productName: 'Test' }]); // items

      const response = await repay(
        makeRequest('http://localhost/api/orders/1/repay', { method: 'POST' }),
        makeParams('1'),
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.paymentUrl).toBe('https://xendit.co/inv_new');
    });

    it('returns existing invoice for waiting_payment with invoice', async () => {
      mockSelectReturn
        .mockReturnValueOnce([{ ...sampleOrder, status: 'waiting_payment' }])
        .mockReturnValueOnce([sampleInvoice]); // existing invoice

      const response = await repay(
        makeRequest('http://localhost/api/orders/1/repay', { method: 'POST' }),
        makeParams('1'),
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.paymentUrl).toBe(sampleInvoice.invoiceUrl);
    });

    it('rejects repay for packing order', async () => {
      mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, status: 'packing' }]);

      const response = await repay(
        makeRequest('http://localhost/api/orders/1/repay', { method: 'POST' }),
        makeParams('1'),
      );

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/orders/[id]/tracking', () => {
    it('returns shipping and tracking histories', async () => {
      mockSelectReturn
        .mockReturnValueOnce([sampleOrder]) // order
        .mockReturnValueOnce([sampleShipping]) // shipping
        .mockReturnValueOnce([
          { id: 1, shippingId: 1, status: 'picked', note: null, updatedAt: new Date() },
        ]); // histories

      const response = await tracking(
        makeRequest('http://localhost/api/orders/1/tracking'),
        makeParams('1'),
      );
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.shipping).toBeTruthy();
      expect(json.data.histories).toHaveLength(1);
    });

    it('returns null shipping when none exists', async () => {
      mockSelectReturn
        .mockReturnValueOnce([sampleOrder])
        .mockReturnValueOnce([]); // no shipping

      const response = await tracking(
        makeRequest('http://localhost/api/orders/1/tracking'),
        makeParams('1'),
      );
      const json = await response.json();

      expect(json.data.shipping).toBeNull();
      expect(json.data.histories).toHaveLength(0);
    });

    it('returns 403 for another users order', async () => {
      mockSelectReturn.mockReturnValueOnce([{ ...sampleOrder, userId: 999 }]);

      const response = await tracking(
        makeRequest('http://localhost/api/orders/1/tracking'),
        makeParams('1'),
      );

      expect(response.status).toBe(403);
    });
  });
});
