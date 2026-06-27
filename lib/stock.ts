// lib/stock.ts — Stock deduct/restore/validate helpers

import { db } from '@/lib/db';
import { products, orderItems } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function deductStock(items: { productId: number; quantity: number }[]) {
  for (const item of items) {
    await db
      .update(products)
      .set({ stock: sql`${products.stock} - ${item.quantity}` })
      .where(eq(products.id, item.productId));
  }
}

export async function restoreStock(orderId: number) {
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  for (const item of items) {
    if (!item.productId) continue;
    await db
      .update(products)
      .set({ stock: sql`${products.stock} + ${item.quantity}` })
      .where(eq(products.id, item.productId));
  }
}

export async function validateStock(
  items: { productId: number; quantity: number; productName: string }[],
): Promise<{ valid: boolean; errors: string[] }> {
  if (items.length === 0) return { valid: true, errors: [] };

  const errors: string[] = [];

  for (const item of items) {
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);

    if (rows.length === 0 || (rows[0].stock ?? 0) < item.quantity) {
      const available = rows.length > 0 ? rows[0].stock ?? 0 : 0;
      errors.push(`Stok ${item.productName} tidak cukup (tersedia: ${available}, diminta: ${item.quantity})`);
    }
  }

  return { valid: errors.length === 0, errors };
}
