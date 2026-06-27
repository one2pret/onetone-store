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

import { GET } from '@/app/api/banners/route';

describe('Banners API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
  });

  it('returns active banners', async () => {
    mockSelectReturn.mockReturnValue([
      { id: 1, title: 'Promo', subtitle: 'Diskon 50%', image: '/banner1.jpg', isActive: true, sortOrder: 0 },
      { id: 2, title: 'New', subtitle: 'Produk baru', image: '/banner2.jpg', isActive: true, sortOrder: 1 },
    ]);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(2);
    expect(json.data[0].title).toBe('Promo');
  });

  it('returns empty array when no banners', async () => {
    const response = await GET();
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(0);
  });
});
