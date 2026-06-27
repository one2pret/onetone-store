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
  },
}));

import { GET } from '@/app/api/products/[id]/route';

describe('GET /api/products/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns product when found', async () => {
    mockSelectReturn.mockReturnValue([
      {
        products: { id: 1, name: 'Test', slug: 'test', price: '100000', isActive: true },
        categories: { id: 1, name: 'Elektronik', slug: 'elektronik' },
      },
    ]);

    const response = await GET(
      new Request('http://localhost/api/products/1'),
      { params: Promise.resolve({ id: '1' }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.name).toBe('Test');
    expect(json.data.category).toBeDefined();
  });

  it('returns 404 when not found', async () => {
    mockSelectReturn.mockReturnValue([]);

    const response = await GET(
      new Request('http://localhost/api/products/999'),
      { params: Promise.resolve({ id: '999' }) }
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
  });
});
