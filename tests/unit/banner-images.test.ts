import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUrl: vi.fn((key: string) => `https://cdn.example.com/${key}`),
}));

vi.mock('@/lib/storage', () => ({
  storage: { getUrl: mocks.getUrl },
}));

import { isAllowedExternalBannerUrl, resolveBannerImageUrl, withResolvedBannerImage } from '@/lib/banner-images';

describe('banner image helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_CDN_URL', 'https://cdn.example.com');
  });

  it('prefers an R2 object key over a legacy URL', () => {
    const image = resolveBannerImageUrl({ image: 'https://images.unsplash.com/old.jpg', imageObjectKey: 'banners/new.webp' });
    expect(image).toBe('https://cdn.example.com/banners/new.webp');
  });

  it('keeps a legacy URL when no object key exists', () => {
    expect(resolveBannerImageUrl({ image: 'https://images.unsplash.com/legacy.jpg', imageObjectKey: null }))
      .toBe('https://images.unsplash.com/legacy.jpg');
  });

  it('allows only supported HTTPS image hosts', () => {
    expect(isAllowedExternalBannerUrl('https://images.unsplash.com/banner.jpg')).toBe(true);
    expect(isAllowedExternalBannerUrl('https://cdn.example.com/banner.jpg')).toBe(true);
    expect(isAllowedExternalBannerUrl('http://images.unsplash.com/banner.jpg')).toBe(false);
    expect(isAllowedExternalBannerUrl('https://example.org/banner.jpg')).toBe(false);
  });

  it('resolves the image while preserving the banner shape', () => {
    const banner = { id: 1, image: '', imageObjectKey: 'banners/a.webp', title: 'Promo' };
    expect(withResolvedBannerImage(banner)).toEqual({
      id: 1,
      image: 'https://cdn.example.com/banners/a.webp',
      imageObjectKey: 'banners/a.webp',
      title: 'Promo',
    });
  });
});
