import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelectReturn = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => {
      const chain: any = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: any) => resolve(mockSelectReturn());
      chain.catch = () => chain;
      return chain;
    }),
  },
}));

import { GET } from '@/app/api/categories/route';

describe('GET /api/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all categories', async () => {
    mockSelectReturn.mockReturnValue([
      { id: 1, name: 'Elektronik', slug: 'elektronik' },
      { id: 2, name: 'Fashion', slug: 'fashion' },
    ]);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(2);
  });

  it('returns empty array when no categories', async () => {
    mockSelectReturn.mockReturnValue([]);

    const response = await GET();
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(0);
  });
});
