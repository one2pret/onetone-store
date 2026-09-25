import { describe, expect, it } from 'vitest';
import { calculateCartSubtotal, getEffectiveUnitPrice } from '@/lib/cart-pricing';

describe('cart pricing', () => {
  it('adds the variant price modifier to the base price', () => {
    expect(getEffectiveUnitPrice('3000', '1500')).toBe(4500);
  });

  it('uses an active product promotion before calculating subtotal', () => {
    expect(calculateCartSubtotal([{
      quantity: 2,
      product: { price: '3000', salePrice: '2500' },
      variant: null,
    }])).toBe(5000);
  });

  it('calculates subtotal with quantities and variant modifiers', () => {
    expect(calculateCartSubtotal([
      {
        quantity: 2,
        product: { price: '3000' },
        variant: { priceModifier: '500' },
      },
      {
        quantity: 1,
        product: { price: '10000' },
        variant: null,
      },
    ])).toBe(17000);
  });
});
