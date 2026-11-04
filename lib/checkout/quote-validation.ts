/** Pure validation only. Not yet wired into POST /api/orders. */
export type CourierSelection = {
  courierCompany: string;
  courierType: string;
  courierPrice: number;
};
export type ServerCourierRate = {
  courierCompany: string;
  courierType: string;
  price: number;
};

export function selectTrustedCourierRate(
  selected: CourierSelection,
  rates: readonly ServerCourierRate[],
): ServerCourierRate | null {
  if (!selected.courierCompany.trim() || !selected.courierType.trim()) return null;
  if (!Number.isSafeInteger(selected.courierPrice) || selected.courierPrice < 0) return null;
  const match = rates.find(rate =>
    rate.courierCompany.toLowerCase() === selected.courierCompany.toLowerCase() &&
    rate.courierType.toLowerCase() === selected.courierType.toLowerCase() &&
    Number.isSafeInteger(rate.price) &&
    rate.price >= 0
  );
  if (!match || selected.courierPrice !== match.price) return null;
  return match;
}
