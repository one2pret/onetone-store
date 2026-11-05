import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { addresses, cartItems, couriers, products, productVariants, storeSettings } from '@/lib/db/schema';
import { getShippingRates, type BitshipRate } from '@/lib/bitship';
import { getEffectiveUnitPrice } from '@/lib/cart-pricing';
import { buildShippingQuoteInput } from './shipping-quote-input';
import { checkoutSnapshotDigest } from './order-snapshot';
import { resolveTrustedShippingQuote, type CheckoutCourierRequest } from './trusted-shipping-quote';

export type FreshQuoteResult =
  | { ok: true; rates: BitshipRate[]; snapshot: string }
  | { ok: false; reason: 'address' | 'origin' | 'couriers' | 'cart' | 'invalid_weight_or_coordinates' };

/**
 * Loads a fresh quote using ONLY server-owned state and an address belonging
 * to the authenticated user. No client-provided prices, origin, or weights.
 *
 * This also powers the shipping preview endpoint. Biteship expects per-unit
 * item weight and value, with quantity supplied separately.
 */
export async function loadFreshCheckoutRates(userId: number, addressId: number): Promise<FreshQuoteResult> {
  const [address] = await db.select().from(addresses)
    .where(eq(addresses.id, addressId)).limit(1);
  if (!address || address.userId !== userId) return { ok: false, reason: 'address' };

  const settings = await db.select().from(storeSettings);
  const map = Object.fromEntries(settings.map(s => [s.key, s.value]));
  if (!map.store_latitude || !map.store_longitude) return { ok: false, reason: 'origin' };

  const activeCouriers = await db.select().from(couriers).where(eq(couriers.isActive, true));
  if (activeCouriers.length === 0) return { ok: false, reason: 'couriers' };

  const cart = await db.select().from(cartItems)
    .leftJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(eq(cartItems.userId, userId));
  if (cart.length === 0) return { ok: false, reason: 'cart' };

  if (cart.some(row => !row.products)) return { ok: false, reason: 'invalid_weight_or_coordinates' };
  const input = buildShippingQuoteInput({
    originLatitude: map.store_latitude,
    originLongitude: map.store_longitude,
    destinationLatitude: address.latitude ?? '',
    destinationLongitude: address.longitude ?? '',
    courierCodes: activeCouriers.map(c => c.code),
    cart: cart.map(row => ({
      name: row.products!.name,
      unitWeight: row.products!.weight ?? 0,
      quantity: row.cart_items.quantity ?? 1,
      unitPrice: getEffectiveUnitPrice(
        row.products!.price,
        row.product_variants?.priceModifier,
        {
          salePrice: row.products!.salePrice,
          saleStartsAt: row.products!.saleStartsAt,
          saleEndsAt: row.products!.saleEndsAt,
          saleChannel: row.products!.saleChannel,
          variantSalePriceOverride: row.product_variants?.salePriceOverride,
        },
      ),
    })),
  });
  if (!input) return { ok: false, reason: 'invalid_weight_or_coordinates' };
  const snapshot = checkoutSnapshotDigest({
    address: {
      id: address.id,
      userId: address.userId,
      recipientName: address.recipientName,
      phone: address.phone,
      address: address.address,
      detail: address.detail,
      latitude: address.latitude,
      longitude: address.longitude,
    },
    items: cart.map(row => ({
      productId: row.cart_items.productId,
      variantId: row.cart_items.variantId,
      quantity: row.cart_items.quantity ?? 1,
      unitWeight: row.products!.weight ?? 0,
      unitPrice: getEffectiveUnitPrice(
        row.products!.price,
        row.product_variants?.priceModifier,
        {
          salePrice: row.products!.salePrice,
          saleStartsAt: row.products!.saleStartsAt,
          saleEndsAt: row.products!.saleEndsAt,
          saleChannel: row.products!.saleChannel,
          variantSalePriceOverride: row.product_variants?.salePriceOverride,
        },
      ),
    })),
  });
  return { ok: true, rates: await getShippingRates(input), snapshot };
}

export async function loadTrustedCheckoutSelection(
  userId: number,
  addressId: number,
  selection: CheckoutCourierRequest,
) {
  const quote = await loadFreshCheckoutRates(userId, addressId);
  if (!quote.ok) return { ok: false as const, reason: quote.reason };
  const selected = resolveTrustedShippingQuote(selection, quote.rates);
  if (!selected) return { ok: false as const, reason: 'rate_changed' as const };
  return { ok: true as const, selected, snapshot: quote.snapshot };
}
