import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sampleOrder, sampleInvoice, sampleShipping } from '../helpers/fixtures';

const mockSelectReturn = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => {
      const chain: any = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: any) => resolve(mockSelectReturn());
      chain.catch = () => chain;
      return chain;
    }),
    insert: vi.fn(() => {
      const chain: any = {};
      chain.values = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: any) => resolve([{ insertId: 1 }]);
      chain.catch = () => chain;
      return chain;
    }),
    update: vi.fn(() => {
      const chain: any = {};
      chain.set = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: any) => resolve(undefined);
      chain.catch = () => chain;
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
      (getApiUser as any).mockResolvedValueOnce(null);

      const response = await cancel(
        makeRequest('http://localhost/api/orders/1/cancel', { method: 'POST' }),
        makeParams('1'),
      );

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/orders/[id]/repay', () => {
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
