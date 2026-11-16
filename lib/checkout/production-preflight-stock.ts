import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  cartItems, products, productVariants, inventoryLocations, inventoryBalances,
} from '@/lib/db/schema';
import { getEffectiveUnitPrice } from '@/lib/cart-pricing';

export type PreflightStockReason =
  | 'cart_empty'
  | 'invalid_item'
  | 'invalid_variant'
  | 'invalid_quantity'
  | 'invalid_weight'
  | 'invalid_price'
  | 'online_location'
  | 'stock_unavailable';

type StockLine = {
  productId: number;
  variantId: number | null;
  quantity: number;
  productActive: boolean;
  productChannel: string | null;
  productStock: number | null;
  variantActive: boolean | null;
  variantProductId: number | null;
  variantStock: number | null;
  unitWeight: number | null;
  unitPrice: number;
};

type OnlineBalance = {
  productId: number;
  variantId: number | null;
  quantity: number;
  reserved: number;
};

export type CheckoutStockAssessment =
  | { ok: true; subtotal: number; itemCount: number }
  | { ok: false; reason: PreflightStockReason };

const stockKey = (productId: number, variantId: number | null) =>
  productId + ':' + (variantId ?? 'base');

/**
 * Read-only preflight check, NOT a reservation or transaction guarantee.
 * Sum duplicate cart lines first so their combined quantity cannot pass
 * a stock check individually. The actual commit must recheck under locks.
 */
export function assessOnlineCheckoutStock(
  lines: readonly StockLine[],
  balances: readonly OnlineBalance[],
): CheckoutStockAssessment {
  if (lines.length === 0) return { ok: false, reason: 'cart_empty' };

  const grouped = new Map<string, { quantity: number; productStock: number; variantStock: number | null }>();
  let subtotal = 0;
  let itemCount = 0;

  for (const line of lines) {
    if (!Number.isSafeInteger(line.productId) || line.productId <= 0 ||
        !line.productActive || line.productChannel === 'store_only') {
      return { ok: false, reason: 'invalid_item' };
    }
    if (line.variantId !== null &&
        (!Number.isSafeInteger(line.variantId) || line.variantId <= 0 ||
         !line.variantActive || line.variantProductId !== line.productId)) {
      return { ok: false, reason: 'invalid_variant' };
    }
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      return { ok: false, reason: 'invalid_quantity' };
    }
    if (!Number.isSafeInteger(line.unitWeight) || (line.unitWeight ?? 0) <= 0) {
      return { ok: false, reason: 'invalid_weight' };
    }
    if (!Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0) {
      return { ok: false, reason: 'invalid_price' };
    }
    const stock = line.variantId === null ? line.productStock : line.variantStock;
    if (stock === null || !Number.isSafeInteger(stock) || stock < 0) {
      return { ok: false, reason: 'stock_unavailable' };
    }
    const lineTotal = line.unitPrice * line.quantity;
    subtotal += lineTotal;
    itemCount += line.quantity;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(subtotal) ||
        !Number.isSafeInteger(itemCount)) {
      return { ok: false, reason: 'invalid_price' };
    }
    const key = stockKey(line.productId, line.variantId);
    const previous = grouped.get(key);
    const combined = (previous?.quantity ?? 0) + line.quantity;
    if (!Number.isSafeInteger(combined)) {
      return { ok: false, reason: 'invalid_quantity' };
    }
    grouped.set(key, {
      quantity: combined,
      productStock: line.productStock ?? 0,
      variantStock: line.variantStock,
    });
  }
  if (subtotal <= 0) return { ok: false, reason: 'invalid_price' };

  const available = new Map<string, number>();
  for (const balance of balances) {
    if (!Number.isSafeInteger(balance.quantity) ||
        !Number.isSafeInteger(balance.reserved) ||
        balance.reserved < 0) return { ok: false, reason: 'stock_unavailable' };
    const key = stockKey(balance.productId, balance.variantId);
    if (available.has(key)) return { ok: false, reason: 'stock_unavailable' };
    available.set(key, balance.quantity - balance.reserved);
  }

  for (const [key, group] of grouped) {
    const stock = group.variantStock ?? group.productStock;
    if (!Number.isSafeInteger(stock) || stock < group.quantity ||
        !available.has(key) || available.get(key)! < group.quantity) {
      return { ok: false, reason: 'stock_unavailable' };
    }
  }
  return { ok: true, subtotal, itemCount };
}

/**
 * Checks only the signed-in user's cart and the configured online location.
 * Does not lock, reserve, deduct, create an order or call a payment provider.
 * The future atomic checkout must repeat all stock checks in its transaction.
 */
export async function loadReadOnlyCheckoutStock(userId: number): Promise<CheckoutStockAssessment> {
  const cart = await db.select()
    .from(cartItems)
    .leftJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(eq(cartItems.userId, userId));
  if (cart.length === 0) return { ok: false, reason: 'cart_empty' };

  const locations = await db.select({ id: inventoryLocations.id })
    .from(inventoryLocations)
    .where(and(eq(inventoryLocations.isOnlineDefault, true), eq(inventoryLocations.isActive, true)))
    .limit(2);
  if (locations.length !== 1) return { ok: false, reason: 'online_location' };

  const lines: StockLine[] = cart.map(row => {
    const product = row.products;
    const variant = row.product_variants;
    const price = product
      ? getEffectiveUnitPrice(product.price, variant?.priceModifier, {
          salePrice: product.salePrice,
          saleStartsAt: product.saleStartsAt,
          saleEndsAt: product.saleEndsAt,
          saleChannel: product.saleChannel,
          variantSalePriceOverride: variant?.salePriceOverride,
        })
      : -1;
    return {
      productId: row.cart_items.productId,
      variantId: row.cart_items.variantId,
      quantity: row.cart_items.quantity ?? 0,
      productActive: product?.isActive === true,
      productChannel: product?.channel ?? null,
      productStock: product?.stock ?? null,
      variantActive: variant?.isActive ?? null,
      variantProductId: variant?.productId ?? null,
      variantStock: variant?.stock ?? null,
      unitWeight: product?.weight ?? null,
      unitPrice: price,
    };
  });

  // Check malformed products/cart lines before querying inventory balances.
  const preliminary = assessOnlineCheckoutStock(lines, []);
  if (!preliminary.ok && preliminary.reason !== 'stock_unavailable') return preliminary;

  const requested = new Map<string, { productId: number; variantId: number | null }>();
  for (const line of lines) {
    requested.set(stockKey(line.productId, line.variantId), {
      productId: line.productId, variantId: line.variantId,
    });
  }
  const balances: OnlineBalance[] = [];
  for (const item of requested.values()) {
    const rows = await db.select().from(inventoryBalances)
      .where(and(
        eq(inventoryBalances.locationId, locations[0].id),
        eq(inventoryBalances.productId, item.productId),
        item.variantId === null ? isNull(inventoryBalances.variantId)
          : eq(inventoryBalances.variantId, item.variantId),
      ))
      .limit(2);
    for (const row of rows) {
      balances.push({
        productId: row.productId, variantId: row.variantId,
        quantity: row.quantity, reserved: row.reserved,
      });
    }
  }
  return assessOnlineCheckoutStock(lines, balances);
}
