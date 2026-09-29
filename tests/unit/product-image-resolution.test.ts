import { describe, expect, it } from 'vitest';
import { preferredProductImageKey, selectProductImage, type ProductImageCandidate } from '@/lib/product-image-resolution';

function image(overrides: Partial<ProductImageCandidate> = {}): ProductImageCandidate {
  return {
    id: 1,
    variantId: null,
    variantColor: null,
    isPrimary: false,
    sortOrder: 0,
    objectKey: 'products/main.webp',
    objectKeyThumb: 'products/thumb.webp',
    ...overrides,
  };
}

describe('selectProductImage', () => {
  it('prefers an exact variantId over a legacy color and primary image', () => {
    const selected = selectProductImage([
      image({ id: 1, isPrimary: true }),
      image({ id: 2, variantColor: 'Black', sortOrder: 1 }),
      image({ id: 3, variantId: 21, sortOrder: 2, objectKeyThumb: 'variants/m-black.webp' }),
    ], { id: 21, color: 'Black' });

    expect(selected?.id).toBe(3);
    expect(preferredProductImageKey(selected)).toBe('variants/m-black.webp');
  });

  it('falls back through legacy color, primary, first image, and main object key', () => {
    const legacy = image({ id: 2, variantColor: ' black ', objectKeyThumb: null, objectKey: 'legacy.webp' });
    expect(selectProductImage([image({ id: 1, isPrimary: true }), legacy], { id: 99, color: 'Black' })?.id).toBe(2);
    expect(preferredProductImageKey(legacy)).toBe('legacy.webp');
    expect(selectProductImage([image({ id: 4, sortOrder: 2 }), image({ id: 5, sortOrder: 1, isPrimary: true })])?.id).toBe(5);
    expect(selectProductImage([image({ id: 4, sortOrder: 2 }), image({ id: 5, sortOrder: 1 })])?.id).toBe(5);
    expect(selectProductImage([])).toBeNull();
  });
});
