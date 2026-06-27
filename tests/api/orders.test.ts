import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelectReturn = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => {
      const chain: any = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.leftJoin = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: any) => resolve(mockSelectReturn());
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

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: '2', name: 'John', email: 'john@example.com', role: 'customer' },
    })
  ),
}));

import { GET } from '@/app/api/orders/route';

function makeRequest(url: string) {
  return new Request(url);
}

describe('Orders API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
  });

  describe('GET /api/orders', () => {
    it('returns user orders with items, invoice, shipping', async () => {
      mockSelectReturn
        .mockReturnValueOnce([
          { id: 1, userId: 2, orderNumber: 'ORD001', status: 'waiting_payment', total: '100000', createdAt: new Date() },
        ])
        .mockReturnValueOnce([{ id: 1, orderId: 1, productName: 'Test', quantity: 1, price: '100000', subtotal: '100000' }]) // items
        .mockReturnValueOnce([{ id: 1, orderId: 1, xenditId: 'inv_123', invoiceUrl: 'https://xendit.co/inv', status: 'pending' }]) // invoices
        .mockReturnValueOnce([{ id: 1, orderId: 1, courierName: 'JNE REG' }]); // shippings

      const response = await GET(makeRequest('http://localhost/api/orders'));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].items).toHaveLength(1);
      expect(json.data[0].invoice).toBeTruthy();
      expect(json.data[0].shipping).toBeTruthy();
    });

    it('returns empty when no orders', async () => {
      const response = await GET(makeRequest('http://localhost/api/orders'));
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(0);
    });

    it('returns 401 when not authenticated', async () => {
      const { getApiUser } = await import('@/lib/api-auth');
      (getApiUser as any).mockResolvedValueOnce(null);

      const response = await GET(makeRequest('http://localhost/api/orders'));
      expect(response.status).toBe(401);
    });
  });
});
