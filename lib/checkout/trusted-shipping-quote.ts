import type { BitshipRate } from '@/lib/bitship';
import { validateBiteshipSelection } from './biteship-selection';

export type CheckoutCourierRequest = {
  courierCompany: string;
  courierType: string;
  courierPrice: number;
};

export type TrustedShippingQuote = {
  courierCompany: string;
  courierType: string;
  courierName: string;
  courierServiceName: string;
  price: number;
};

/**
 * Pure contract for a fresh server quote. This does not call Biteship.
 * A caller must first load the user's owned address, current cart, active
 * couriers, and a fresh Biteship response. Never use cached client prices.
 */
export function resolveTrustedShippingQuote(
  request: CheckoutCourierRequest,
  freshRates: readonly BitshipRate[],
): TrustedShippingQuote | null {
  const rate = validateBiteshipSelection(request, freshRates);
  if (!rate) return null;
  return {
    courierCompany: rate.courier_code,
    courierType: rate.courier_service_code,
    courierName: rate.courier_name,
    courierServiceName: rate.courier_service_name,
    price: rate.price,
  };
}
