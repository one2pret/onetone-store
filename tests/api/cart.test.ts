import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelectReturn = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => {
      const chain: any = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.leftJoin = vi.fn().mockReturnValue(chain);
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
    delete: vi.fn(() => {
      const chain: any = {};
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

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: '2', name: 'John', email: 'john@example.com', role: 'customer' },
    })
  ),
}));

import { GET, POST } from '@/app/api/cart/route';

function makeRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

describe('Cart API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
  });

  describe('GET /api/cart', () => {
    it('returns cart items', async () => {
      mockSelectReturn.mockReturnValue([
        {
          cart_items: { id: 1, userId: 2, productId: 1, quantity: 2 },
          products: { id: 1, name: 'Test', price: '100000' },
        },
      ]);

      const response = await GET(makeRequest('http://localhost/api/cart'));
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
    });

    it('returns 401 when not authenticated', async () => {
      const { getApiUser } = await import('@/lib/api-auth');
      (getApiUser as any).mockResolvedValueOnce(null);

      const response = await GET(makeRequest('http://localhost/api/cart'));
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/cart', () => {
    it('adds item to cart', async () => {
      // Product exists & active
      mockSelectReturn
        .mockReturnValueOnce([{ id: 1, name: 'Test', stock: 10, price: '100000', isActive: true }])
        .mockReturnValueOnce([]); // no existing cart item

      const response = await POST(
        makeRequest('http://localhost/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: 1, quantity: 1 }),
        })
      );
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
    });

    it('returns 404 for non-existent product', async () => {
      mockSelectReturn.mockReturnValueOnce([]); // product not found

      const response = await POST(
        makeRequest('http://localhost/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: 999, quantity: 1 }),
        })
      );
      expect(response.status).toBe(404);
    });

    it('returns 400 for insufficient stock', async () => {
      mockSelectReturn
        .mockReturnValueOnce([{ id: 1, name: 'Test', stock: 2, price: '100000', isActive: true }])
        .mockReturnValueOnce([]); // no existing

      const response = await POST(
        makeRequest('http://localhost/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: 1, quantity: 5 }),
        })
      );
      expect(response.status).toBe(400);
    });
  });
});
