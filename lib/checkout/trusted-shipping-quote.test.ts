import { describe, expect, it } from 'vitest';
import { resolveTrustedShippingQuote } from './trusted-shipping-quote';
import type { BitshipRate } from '@/lib/bitship';

const rates: BitshipRate[] = [{
  courier_name: 'AnterAja', courier_code: 'anteraja',
  courier_service_name: 'Reguler', courier_service_code: 'reg',
  type: 'regular', price: 7300, duration: '2-3',
}];

describe('trusted shipping quote contract', () => {
  it('returns server-owned courier identity and amount', () => {
    expect(resolveTrustedShippingQuote({
      courierCompany: 'anteraja', courierType: 'reg', courierPrice: 7300,
    }, rates)).toEqual({
      courierCompany: 'anteraja', courierType: 'reg',
      courierName: 'AnterAja', courierServiceName: 'Reguler', price: 7300,
    });
  });
  it('rejects manipulated amount', () => {
    expect(resolveTrustedShippingQuote({
      courierCompany: 'anteraja', courierType: 'reg', courierPrice: 100,
    }, rates)).toBeNull();
  });
  it('rejects missing or expired rate', () => {
    expect(resolveTrustedShippingQuote({
      courierCompany: 'anteraja', courierType: 'reg', courierPrice: 7300,
    }, [])).toBeNull();
  });
});
