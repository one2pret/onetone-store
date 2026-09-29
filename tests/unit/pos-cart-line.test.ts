import { describe, expect, it } from 'vitest';
import { buildPosCartLine } from '@/lib/pos-cart-line';

const product = {
  id: 7,
  name: 'Bolero Sportswear',
  posName: 'Bolero',
  price: '110000',
  stock: 10,
  image: '/product.webp',
  regularPrice: 110000,
  finalPrice: 99000,
  discountPercent: 10,
  isOnSale: true,
};

describe('buildPosCartLine', () => {
  it('uses the selected variant image and keeps variants as separate cart lines', () => {
    const medium = buildPosCartLine(product, {
      id: 21,
      size: 'M',
      color: 'Black',
      stock: 3,
      priceModifier: '0',
      posLabel: null,
      image: '/m-black.webp',
      regularPrice: 110000,
      finalPrice: 99000,
      discountPercent: 10,
      isOnSale: true,
    });
    const small = buildPosCartLine(product, {
      id: 22,
      size: 'S',
      color: 'Black',
      stock: 4,
      priceModifier: '0',
      posLabel: null,
      image: '/s-black.webp',
      regularPrice: 110000,
      finalPrice: 100000,
      discountPercent: 9,
      isOnSale: true,
    });

    expect(medium).toMatchObject({ key: '7-21', image: '/m-black.webp', variantLabel: 'M / Black' });
    expect(small).toMatchObject({ key: '7-22', image: '/s-black.webp', variantLabel: 'S / Black' });
  });

  it('falls back to the product image when a variant has no image', () => {
    const line = buildPosCartLine(product, {
      id: 23,
      size: 'L',
      color: 'Olive',
      stock: 2,
      priceModifier: '5000',
      posLabel: 'L Olive',
      image: null,
      regularPrice: 115000,
      finalPrice: 115000,
      discountPercent: 0,
      isOnSale: false,
    });

    expect(line).toMatchObject({ image: '/product.webp', unitPrice: 115000 });
  });

  it('uses the selected variant promotional price in the cart snapshot', () => {
    const line = buildPosCartLine(product, {
      id: 24,
      size: 'M',
      color: 'Olive',
      stock: 2,
      priceModifier: '0',
      posLabel: null,
      image: null,
      regularPrice: 110000,
      finalPrice: 88000,
      discountPercent: 20,
      isOnSale: true,
    });

    expect(line).toMatchObject({ unitPrice: 88000, regularUnitPrice: 110000, automaticDiscountAmount: 22000 });
  });
});
