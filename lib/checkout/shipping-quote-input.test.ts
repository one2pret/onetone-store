import { describe, expect, it } from 'vitest';
import { buildShippingQuoteInput } from './shipping-quote-input';

const valid = {
  originLatitude: '-6.9', originLongitude: '107.6',
  destinationLatitude: '-6.8', destinationLongitude: '107.5',
  courierCodes: ['jne', 'JNE', 'anteraja'],
  cart: [{ name: 'Produk A', unitWeight: 1000, quantity: 2, unitPrice: 150000 }],
};

describe('server shipping quote input', () => {
  it('builds weighted, priced request and deduplicates couriers', () => {
    const result = buildShippingQuoteInput(valid);
    expect(result?.couriers).toBe('jne,anteraja');
    expect(result?.items).toEqual([{ name: 'Produk A', weight: 2000, quantity: 2, value: 300000 }]);
  });
  it('rejects zero or invalid destination coordinates', () => {
    expect(buildShippingQuoteInput({ ...valid, destinationLatitude: '0' })).toBeNull();
    expect(buildShippingQuoteInput({ ...valid, destinationLongitude: '181' })).toBeNull();
  });
  it('rejects missing or invalid cart and couriers', () => {
    expect(buildShippingQuoteInput({ ...valid, cart: [] })).toBeNull();
    expect(buildShippingQuoteInput({ ...valid, courierCodes: [] })).toBeNull();
    expect(buildShippingQuoteInput({ ...valid, cart: [{ ...valid.cart[0], unitWeight: 0 }] })).toBeNull();
    expect(buildShippingQuoteInput({ ...valid, cart: [{ ...valid.cart[0], quantity: -1 }] })).toBeNull();
  });
});
