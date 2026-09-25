// lib/stock.ts — Stock deduct/restore/validate helpers
// Supports both product-level stock and variant-level stock.
// If variantId is provided, deduct/restore/validate against product_variants.stock.
// Otherwise, fallback to products.stock (produk tanpa varian).

import { db } from '@/lib/db';
import { products, productVariants, orderItems, inventoryLocations, inventoryBalances, inventoryMovements } from '@/lib/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';

async function applyOnlineInventoryDelta(item: { productId: number; variantId?: number; quantity: number }, direction: -1 | 1, referenceId?: number) {
  const locations = await db.select({ id: inventoryLocations.id }).from(inventoryLocations)
    .where(and(eq(inventoryLocations.isOnlineDefault, true), eq(inventoryLocations.isActive, true))).limit(1);
  const locationId = locations[0]?.id;
  if (!locationId) throw new Error('Gudang online default tidak ditemukan');
  const condition = item.variantId
    ? and(eq(inventoryBalances.locationId, locationId), eq(inventoryBalances.productId, item.productId), eq(inventoryBalances.variantId, item.variantId))
    : and(eq(inventoryBalances.locationId, locationId), eq(inventoryBalances.productId, item.productId), isNull(inventoryBalances.variantId));
  const rows = await db.select().from(inventoryBalances).where(condition).limit(1);
  const balance = rows[0];
  if (!balance) throw new Error('Saldo stok Gudang Online belum tersedia');
  const delta = direction * item.quantity;
  const after = balance.quantity + delta;
  if (after < balance.reserved) throw new Error('Stok Gudang Online tidak mencukupi');
  await db.update(inventoryBalances).set({ quantity: after }).where(eq(inventoryBalances.id, balance.id));
  await db.insert(inventoryMovements).values({
    locationId, productId: item.productId, variantId: item.variantId ?? null,
    quantityDelta: delta, balanceAfter: after, type: direction < 0 ? 'online_sale' : 'return',
    referenceType: 'order', referenceId,
  });
}

/** Kurangi stok. Jika variantId ada → kurangi stok varian; jika tidak → kurangi stok produk. */
export async function deductStock(
  items: { productId: number; variantId?: number; quantity: number }[]
) {
  for (const item of items) {
    await applyOnlineInventoryDelta(item, -1);
    if (item.variantId) {
      await db
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} - ${item.quantity}` })
        .where(eq(productVariants.id, item.variantId));
    } else {
      await db
        .update(products)
        .set({ stock: sql`${products.stock} - ${item.quantity}` })
        .where(eq(products.id, item.productId));
    }
  }
}

/** Kembalikan stok saat order dibatalkan. Baca variantId dari order_items. */
export async function restoreStock(orderId: number) {
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const item of items) {
    if (!item.productId) continue;

    await applyOnlineInventoryDelta({ productId: item.productId, variantId: item.variantId ?? undefined, quantity: item.quantity }, 1, orderId);

    if (item.variantId) {
      await db
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} + ${item.quantity}` })
        .where(eq(productVariants.id, item.variantId));
    } else {
      await db
        .update(products)
        .set({ stock: sql`${products.stock} + ${item.quantity}` })
        .where(eq(products.id, item.productId));
    }
  }
}

/** Validasi stok sebelum order dibuat. Cek per varian jika variantId ada. */
export async function validateStock(
  items: { productId: number; variantId?: number; quantity: number; productName: string }[],
): Promise<{ valid: boolean; errors: string[] }> {
  if (items.length === 0) return { valid: true, errors: [] };

  const errors: string[] = [];

  for (const item of items) {
    if (item.variantId) {
      // Validasi stok varian
      const rows = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, item.variantId))
        .limit(1);

      const variant = rows[0];

      if (!variant) {
        errors.push(`Varian ${item.productName} tidak ditemukan.`);
        continue;
      }

      if (!variant.isActive) {
        errors.push(`Varian ${item.productName} tidak aktif.`);
        continue;
      }

      const available = variant.stock ?? 0;
      if (available < item.quantity) {
        errors.push(
          `Stok ${item.productName} tidak cukup (tersedia: ${available}, diminta: ${item.quantity})`
        );
      }
    } else {
      // Validasi stok produk (tanpa varian)
      const rows = await db
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);

      const product = rows[0];

      if (!product) {
        errors.push(`Produk ${item.productName} tidak ditemukan.`);
        continue;
      }

      if (!product.isActive) {
        errors.push(`Produk ${item.productName} tidak aktif.`);
        continue;
      }

      const available = product.stock ?? 0;
      if (available < item.quantity) {
        errors.push(
          `Stok ${item.productName} tidak cukup (tersedia: ${available}, diminta: ${item.quantity})`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
