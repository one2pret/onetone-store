import { describe, expect, it } from 'vitest';
import { resolveProductPrice } from '@/lib/product-pricing';

const now = new Date('2026-09-23T08:00:00.000Z');

describe('resolveProductPrice', () => {
  it('uses scheduled product promo while active', () => {
    expect(resolveProductPrice({
      price: 100_000,
      salePrice: 75_000,
      saleStartsAt: '2026-09-22T00:00:00.000Z',
      saleEndsAt: '2026-09-24T00:00:00.000Z',
    }, now)).toMatchObject({
      regularPrice: 100_000,
      finalPrice: 75_000,
      discountAmount: 25_000,
      discountPercent: 25,
      isOnSale: true,
    });
  });

  it('ignores a promo outside its schedule', () => {
    expect(resolveProductPrice({
      price: 100_000,
      salePrice: 75_000,
      saleStartsAt: '2026-09-24T00:00:00.000Z',
    }, now).finalPrice).toBe(100_000);
  });

  it('uses variant override as its final promo price', () => {
    expect(resolveProductPrice({
      price: 100_000,
      priceModifier: 10_000,
      salePrice: 80_000,
      variantSalePriceOverride: 85_000,
    }, now)).toMatchObject({ regularPrice: 110_000, finalPrice: 85_000, isOnSale: true });
  });

  it('keeps the base price when a variant has no price difference', () => {
    expect(resolveProductPrice({ price: 110_000, priceModifier: 0 }, now))
      .toMatchObject({ regularPrice: 110_000, finalPrice: 110_000, isOnSale: false });
  });

  it('rejects a promotional candidate that is not lower than regular price', () => {
    expect(resolveProductPrice({ price: 100_000, salePrice: 100_000 }, now))
      .toMatchObject({ finalPrice: 100_000, isOnSale: false });
  });

  it('does not activate a variant override without a product promotion', () => {
    expect(resolveProductPrice({ price: 100_000, variantSalePriceOverride: 70_000 }, now))
      .toMatchObject({ finalPrice: 100_000, isOnSale: false });
  });
});
