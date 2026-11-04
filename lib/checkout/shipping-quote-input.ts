import type { BitshipRateRequest } from '@/lib/bitship';

export type CheckoutCartItem = {
  name: string;
  unitWeight: number;
  quantity: number;
  unitPrice: number;
};

function validCoordinate(value: string, limit: number): boolean {
  const number = Number(value);
  return value.trim() !== '' && Number.isFinite(number) &&
    number !== 0 && Math.abs(number) <= limit;
}

/**
 * Build a Biteship quote request from server-owned origin, owned destination,
 * active couriers and current cart. Reject invalid inputs before network calls.
 * Never accept product weight/value or origin from the mobile client.
 */
export function buildShippingQuoteInput(input: {
  originLatitude: string;
  originLongitude: string;
  destinationLatitude: string;
  destinationLongitude: string;
  courierCodes: string[];
  cart: CheckoutCartItem[];
}): BitshipRateRequest | null {
  if (!validCoordinate(input.originLatitude, 90) ||
      !validCoordinate(input.originLongitude, 180) ||
      !validCoordinate(input.destinationLatitude, 90) ||
      !validCoordinate(input.destinationLongitude, 180)) return null;

  const couriers = [...new Set(input.courierCodes.map(c => c.trim().toLowerCase()))]
    .filter(c => /^[a-z0-9_-]+$/.test(c));
  if (couriers.length === 0 || input.cart.length === 0) return null;
  if (input.cart.some(item => !item.name.trim() ||
      !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ||
      !Number.isFinite(item.unitWeight) || item.unitWeight <= 0 ||
      !Number.isSafeInteger(item.unitPrice) || item.unitPrice < 0)) return null;

  return {
    origin_latitude: input.originLatitude,
    origin_longitude: input.originLongitude,
    destination_latitude: input.destinationLatitude,
    destination_longitude: input.destinationLongitude,
    couriers: couriers.join(','),
    items: input.cart.map(item => ({
      name: item.name,
      weight: item.unitWeight * item.quantity,
      quantity: item.quantity,
      value: item.unitPrice * item.quantity,
    })),
  };
}
