import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelectReturn = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => {
      type QueryChain = {
        from: ReturnType<typeof vi.fn>;
        where: ReturnType<typeof vi.fn>;
        orderBy: ReturnType<typeof vi.fn>;
        then: (resolve: (value: unknown) => unknown) => unknown;
        catch: () => QueryChain;
      };
      const chain = {} as QueryChain;
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.orderBy = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: (value: unknown) => unknown) => resolve(mockSelectReturn());
      chain.catch = () => chain;
      return chain;
    }),
  },
}));

vi.mock('@/lib/storage', () => ({
  storage: { getUrl: (key: string) => `https://cdn.example.com/${key}` },
}));

import { GET } from '@/app/api/banners/route';

describe('Banners API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
  });

  it('returns active banners', async () => {
    mockSelectReturn.mockReturnValue([
      { id: 1, title: 'Promo', subtitle: 'Diskon 50%', image: 'https://images.unsplash.com/banner1.jpg', imageObjectKey: null, isActive: true, sortOrder: 0, link: null },
      { id: 2, title: 'New', subtitle: 'Produk baru', image: 'https://images.unsplash.com/banner2.jpg', imageObjectKey: null, isActive: true, sortOrder: 1, link: null },
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

  it('resolves an R2 object key without exposing internal storage metadata', async () => {
    mockSelectReturn.mockReturnValue([{
      id: 3,
      title: 'R2 banner',
      subtitle: null,
      image: '',
      imageObjectKey: 'banners/hero.webp',
      imageObjectKeyOriginal: 'banners/original/hero.png',
      imageObjectKeyThumb: 'banners/thumb/hero.webp',
      isActive: true,
      sortOrder: 0,
      link: null,
    }]);

    const response = await GET();
    const json = await response.json();

    expect(json.data[0].image).toBe('https://cdn.example.com/banners/hero.webp');
    expect(json.data[0]).not.toHaveProperty('imageObjectKey');
    expect(json.data[0]).not.toHaveProperty('imageObjectKeyOriginal');
  });
});
