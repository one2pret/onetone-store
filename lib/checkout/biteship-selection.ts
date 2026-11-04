import type { BitshipRate } from '@/lib/bitship';
import { selectTrustedCourierRate } from './quote-validation';

export type SelectedCourier = {
  courierCompany: string;
  courierType: string;
  courierPrice: number;
};

/**
 * Normalize Biteship's actual courier/service codes, never its display labels.
 * This is a pure helper; caller must fetch a fresh quote for the owned address
 * and current cart before invoking it.
 */
export function validateBiteshipSelection(
  selection: SelectedCourier,
  freshRates: readonly BitshipRate[],
): BitshipRate | null {
  const trusted = selectTrustedCourierRate(selection, freshRates.map(rate => ({
    courierCompany: rate.courier_code,
    courierType: rate.courier_service_code,
    price: rate.price,
  })));
  if (!trusted) return null;
  return freshRates.find(rate =>
    rate.courier_code.toLowerCase() === trusted.courierCompany.toLowerCase() &&
    rate.courier_service_code.toLowerCase() === trusted.courierType.toLowerCase() &&
    rate.price === trusted.price
  ) ?? null;
}
