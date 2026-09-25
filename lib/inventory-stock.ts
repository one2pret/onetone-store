import { db } from "@/lib/db";
import { inventoryBalances, inventoryLocations, inventoryMovements, productVariants, products } from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";

export type InventoryStockItem = { productId: number; variantId?: number; quantity: number; productName?: string };

function balanceCondition(locationId: number, item: InventoryStockItem) {
  return item.variantId
    ? and(eq(inventoryBalances.locationId, locationId), eq(inventoryBalances.productId, item.productId), eq(inventoryBalances.variantId, item.variantId))
    : and(eq(inventoryBalances.locationId, locationId), eq(inventoryBalances.productId, item.productId), isNull(inventoryBalances.variantId));
}

export async function validateLocationStock(locationId: number, items: InventoryStockItem[]) {
  const errors: string[] = [];
  for (const item of items) {
    const entity = item.variantId
      ? await db.select({ active: productVariants.isActive }).from(productVariants).where(eq(productVariants.id, item.variantId)).limit(1)
      : await db.select({ active: products.isActive }).from(products).where(eq(products.id, item.productId)).limit(1);
    const balance = await db.select({ quantity: inventoryBalances.quantity, reserved: inventoryBalances.reserved })
      .from(inventoryBalances).where(balanceCondition(locationId, item)).limit(1);
    const available = (balance[0]?.quantity ?? 0) - (balance[0]?.reserved ?? 0);
    const name = item.productName ?? `Produk #${item.productId}`;
    if (!entity[0]) errors.push(`${name} tidak ditemukan.`);
    else if (!entity[0].active) errors.push(`${name} tidak aktif.`);
    else if (available < item.quantity) errors.push(`Stok ${name} di lokasi ini tidak cukup (tersedia: ${available}, diminta: ${item.quantity})`);
  }
  return { valid: errors.length === 0, errors };
}

export async function deductLocationStock(locationId: number, items: InventoryStockItem[], options: { type: "pos_sale" | "online_sale"; referenceId?: number; actorUserId?: number } ) {
  for (const item of items) {
    const rows = await db.select().from(inventoryBalances).where(balanceCondition(locationId, item)).limit(1);
    const balance = rows[0];
    if (!balance || balance.quantity - balance.reserved < item.quantity) throw new Error("Stok berubah atau tidak mencukupi. Muat ulang POS.");
    const [result] = await db.update(inventoryBalances)
      .set({ quantity: sql`${inventoryBalances.quantity} - ${item.quantity}` })
      .where(and(
        eq(inventoryBalances.id, balance.id),
        sql`${inventoryBalances.quantity} - ${inventoryBalances.reserved} >= ${item.quantity}`,
      ));
    if (!result || result.affectedRows !== 1) throw new Error("Stok baru saja berubah. Muat ulang POS dan coba lagi.");
    const updated = await db.select({ quantity: inventoryBalances.quantity }).from(inventoryBalances)
      .where(eq(inventoryBalances.id, balance.id)).limit(1);
    const after = updated[0]?.quantity ?? balance.quantity - item.quantity;
    await db.insert(inventoryMovements).values({
      locationId, productId: item.productId, variantId: item.variantId ?? null,
      quantityDelta: -item.quantity, balanceAfter: after, type: options.type,
      referenceType: "order", referenceId: options.referenceId, actorUserId: options.actorUserId,
    });
  }
}

export async function getLocationBalanceMap(locationId: number) {
  const rows = await db.select({ productId: inventoryBalances.productId, variantId: inventoryBalances.variantId, quantity: inventoryBalances.quantity, reserved: inventoryBalances.reserved })
    .from(inventoryBalances).where(eq(inventoryBalances.locationId, locationId));
  return new Map(rows.map(row => [`${row.productId}:${row.variantId ?? 0}`, Math.max(0, row.quantity - row.reserved)]));
}

export async function requireOnlineInventoryLocation() {
  const locations = await db.select({ id: inventoryLocations.id }).from(inventoryLocations)
    .where(and(eq(inventoryLocations.isOnlineDefault, true), eq(inventoryLocations.isActive, true))).limit(1);
  if (!locations[0]) throw new Error("Gudang Online belum dikonfigurasi. Tetapkan lokasi Online utama di Dashboard > Inventori sebelum menyimpan produk.");
  return locations[0].id;
}

export async function setOnlineInventoryStock(productId: number, variantId: number | null, quantity: number) {
  const locationId = await requireOnlineInventoryLocation();
  const condition = variantId
    ? and(eq(inventoryBalances.locationId, locationId), eq(inventoryBalances.productId, productId), eq(inventoryBalances.variantId, variantId))
    : and(eq(inventoryBalances.locationId, locationId), eq(inventoryBalances.productId, productId), isNull(inventoryBalances.variantId));
  const rows = await db.select().from(inventoryBalances).where(condition).limit(1);
  const previous = rows[0]?.quantity ?? 0;
  if (rows[0]) await db.update(inventoryBalances).set({ quantity }).where(eq(inventoryBalances.id, rows[0].id));
  else await db.insert(inventoryBalances).values({ locationId, productId, variantId, quantity });
  if (quantity !== previous) await db.insert(inventoryMovements).values({
    locationId, productId, variantId, quantityDelta: quantity - previous, balanceAfter: quantity,
    type: rows[0] ? "adjustment" : "opening_balance", notes: "Sinkronisasi stok produk Gudang Online",
  });
}
