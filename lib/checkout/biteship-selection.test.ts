import { describe, expect, it } from 'vitest';
import { validateBiteshipSelection } from './biteship-selection';
import type { BitshipRate } from '@/lib/bitship';
const rates: BitshipRate[] = [{ courier_name: 'AnterAja', courier_code: 'anteraja', courier_service_name: 'Reguler', courier_service_code: 'reg', type: 'regular', price: 7300, duration: '2-3' }];
describe('Biteship selection', () => {
  it('accepts matching service and price', () => expect(validateBiteshipSelection({courierCompany:'anteraja',courierType:'reg',courierPrice:7300},rates)?.price).toBe(7300));
  it('rejects changed price', () => expect(validateBiteshipSelection({courierCompany:'anteraja',courierType:'reg',courierPrice:1},rates)).toBeNull());
  it('rejects absent quote', () => expect(validateBiteshipSelection({courierCompany:'anteraja',courierType:'reg',courierPrice:7300},[])).toBeNull());
});
