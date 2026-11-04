import { describe, expect, it } from 'vitest';
import { selectTrustedCourierRate } from './quote-validation';

const rates = [
  { courierCompany: 'jne', courierType: 'reg', price: 9000 },
  { courierCompany: 'sicepat', courierType: 'best', price: 14000 },
];

describe('trusted shipping rate selection', () => {
  it('accepts a matching courier, service and server price', () => {
    expect(selectTrustedCourierRate(
      { courierCompany: 'JNE', courierType: 'REG', courierPrice: 9000 }, rates,
    )?.price).toBe(9000);
  });
  it('rejects manipulated client prices', () => {
    expect(selectTrustedCourierRate(
      { courierCompany: 'jne', courierType: 'reg', courierPrice: 1 }, rates,
    )).toBeNull();
  });
  it('rejects unknown courier or service', () => {
    expect(selectTrustedCourierRate(
      { courierCompany: 'jne', courierType: 'express', courierPrice: 9000 }, rates,
    )).toBeNull();
  });
  it('rejects invalid, negative and fractional prices', () => {
    for (const price of [-1, NaN, Infinity, 1000.5]) {
      expect(selectTrustedCourierRate(
        { courierCompany: 'jne', courierType: 'reg', courierPrice: price }, rates,
      )).toBeNull();
    }
  });
});
