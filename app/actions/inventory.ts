"use server";

import { db } from "@/lib/db";
import {
  inventoryBalances,
  inventoryLocations,
  inventoryMovements,
  inventoryTransfers,
  products,
  productVariants,
  users,
} from "@/lib/db/schema";
import { requirePosAdmin, requirePosOperator } from "@/lib/pos-auth";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const locationSchema = z.object({
  name: z.string().trim().min(2).max(150),
  code: z.string().trim().min(2).max(50).regex(/^[A-Z0-9-]+$/),
  type: z.enum(["online", "pos", "warehouse"]),
});

export async function getActivePosLocations() {
  const auth = await requirePosOperator();
  if (!auth.ok) return [];
  return db.select({ id: inventoryLocations.id, name: inventoryLocations.name, code: inventoryLocations.code })
    .from(inventoryLocations)
    .where(and(eq(inventoryLocations.isActive, true), eq(inventoryLocations.type, "pos")))
    .orderBy(asc(inventoryLocations.name));
}

export async function getInventoryAdminData() {
  const auth = await requirePosAdmin();
  if (!auth.ok) return null;

  const [locations, productRows, variantRows, balances, movements] = await Promise.all([
    db.select().from(inventoryLocations).orderBy(asc(inventoryLocations.name)),
    db.select({ id: products.id, name: products.name, stock: products.stock })
      .from(products).orderBy(asc(products.name)),
    db.select({ id: productVariants.id, productId: productVariants.productId, size: productVariants.size, color: productVariants.color, sku: productVariants.sku })
      .from(productVariants).orderBy(asc(productVariants.productId)),
    db.select().from(inventoryBalances),
    db.select({
      id: inventoryMovements.id,
      locationId: inventoryMovements.locationId,
      productId: inventoryMovements.productId,
      variantId: inventoryMovements.variantId,
      quantityDelta: inventoryMovements.quantityDelta,
      balanceAfter: inventoryMovements.balanceAfter,
      type: inventoryMovements.type,
      referenceType: inventoryMovements.referenceType,
      referenceId: inventoryMovements.referenceId,
      notes: inventoryMovements.notes,
      createdAt: inventoryMovements.createdAt,
      actorName: users.name,
    }).from(inventoryMovements)
      .leftJoin(users, eq(inventoryMovements.actorUserId, users.id))
      .orderBy(desc(inventoryMovements.createdAt), desc(inventoryMovements.id))
      .limit(200),
  ]);
  return { locations, products: productRows, variants: variantRows, balances, movements };
}

export async function createInventoryLocation(input: { name: string; code: string; type: "online" | "pos" | "warehouse" }) {
  const auth = await requirePosAdmin();
  if (!auth.ok) return { success: false, error: auth.error };
  const parsed = locationSchema.safeParse({ ...input, code: input.code.toUpperCase() });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Lokasi tidak valid" };

  try {
    await db.insert(inventoryLocations).values({ ...parsed.data, isOnlineDefault: false, isActive: true });
    revalidatePath("/dashboard/inventory");
    revalidatePath("/pos");
    return { success: true };
  } catch {
    return { success: false, error: "Kode lokasi sudah digunakan atau data tidak valid" };
  }
}

export async function updateInventoryBalance(input: { locationId: number; productId: number; variantId?: number | null; quantity: number; notes?: string }) {
  const auth = await requirePosAdmin();
  if (!auth.ok) return { success: false, error: auth.error };
  const schema = z.object({ locationId: z.number().int().positive(), productId: z.number().int().positive(), variantId: z.number().int().positive().nullable().optional(), quantity: z.number().int().min(0), notes: z.string().trim().max(500).optional() });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Stok tidak valid" };
  const data = parsed.data;

  const condition = data.variantId
    ? and(eq(inventoryBalances.locationId, data.locationId), eq(inventoryBalances.productId, data.productId), eq(inventoryBalances.variantId, data.variantId))
    : and(eq(inventoryBalances.locationId, data.locationId), eq(inventoryBalances.productId, data.productId), isNull(inventoryBalances.variantId));
  const existing = await db.select().from(inventoryBalances).where(condition).limit(1);
  const previous = existing[0]?.quantity ?? 0;

  if (existing[0]) {
    await db.update(inventoryBalances).set({ quantity: data.quantity }).where(eq(inventoryBalances.id, existing[0].id));
  } else {
    await db.insert(inventoryBalances).values({ locationId: data.locationId, productId: data.productId, variantId: data.variantId ?? null, quantity: data.quantity });
  }

  const delta = data.quantity - previous;
  if (delta !== 0) {
    await db.insert(inventoryMovements).values({
      locationId: data.locationId, productId: data.productId, variantId: data.variantId ?? null,
      quantityDelta: delta, balanceAfter: data.quantity, type: "adjustment",
      actorUserId: auth.actor.id, notes: data.notes || "Penyesuaian stok oleh admin",
    });
  }

  const locations = await db.select({ isOnlineDefault: inventoryLocations.isOnlineDefault })
    .from(inventoryLocations).where(eq(inventoryLocations.id, data.locationId)).limit(1);
  if (locations[0]?.isOnlineDefault) {
    if (data.variantId) await db.update(productVariants).set({ stock: data.quantity }).where(eq(productVariants.id, data.variantId));
    else await db.update(products).set({ stock: data.quantity }).where(eq(products.id, data.productId));
  }

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/products");
  revalidatePath("/pos");
  return { success: true };
}

const transferSchema = z.object({
  fromLocationId: z.number().int().positive(),
  toLocationId: z.number().int().positive(),
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().positive("Jumlah transfer minimal 1"),
  notes: z.string().trim().max(500).optional(),
}).refine(data => data.fromLocationId !== data.toLocationId, {
  message: "Lokasi asal dan tujuan harus berbeda",
});

export async function transferInventory(input: z.input<typeof transferSchema>) {
  const auth = await requirePosAdmin();
  if (!auth.ok) return { success: false, error: auth.error };
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Transfer tidak valid" };
  const data = parsed.data;

  try {
    const transferId = await db.transaction(async tx => {
      const locations = await tx.select().from(inventoryLocations)
        .where(and(inArray(inventoryLocations.id, [data.fromLocationId, data.toLocationId]), eq(inventoryLocations.isActive, true)));
      if (locations.length !== 2) throw new Error("Lokasi asal atau tujuan tidak aktif");

      const sourceCondition = data.variantId
        ? and(eq(inventoryBalances.locationId, data.fromLocationId), eq(inventoryBalances.productId, data.productId), eq(inventoryBalances.variantId, data.variantId))
        : and(eq(inventoryBalances.locationId, data.fromLocationId), eq(inventoryBalances.productId, data.productId), isNull(inventoryBalances.variantId));
      const targetCondition = data.variantId
        ? and(eq(inventoryBalances.locationId, data.toLocationId), eq(inventoryBalances.productId, data.productId), eq(inventoryBalances.variantId, data.variantId))
        : and(eq(inventoryBalances.locationId, data.toLocationId), eq(inventoryBalances.productId, data.productId), isNull(inventoryBalances.variantId));

      const sourceRows = await tx.select().from(inventoryBalances).where(sourceCondition).limit(1);
      const source = sourceRows[0];
      if (!source || source.quantity - source.reserved < data.quantity) {
        const available = source ? Math.max(0, source.quantity - source.reserved) : 0;
        throw new Error(`Stok lokasi asal tidak cukup. Tersedia ${available}`);
      }

      const [decrement] = await tx.update(inventoryBalances)
        .set({ quantity: sql`${inventoryBalances.quantity} - ${data.quantity}` })
        .where(and(eq(inventoryBalances.id, source.id), sql`${inventoryBalances.quantity} - ${inventoryBalances.reserved} >= ${data.quantity}`));
      if (!decrement || decrement.affectedRows !== 1) throw new Error("Stok baru saja berubah. Silakan ulangi transfer");

      const targetRows = await tx.select().from(inventoryBalances).where(targetCondition).limit(1);
      if (targetRows[0]) {
        await tx.update(inventoryBalances)
          .set({ quantity: sql`${inventoryBalances.quantity} + ${data.quantity}` })
          .where(eq(inventoryBalances.id, targetRows[0].id));
      } else {
        await tx.insert(inventoryBalances).values({
          locationId: data.toLocationId,
          productId: data.productId,
          variantId: data.variantId ?? null,
          quantity: data.quantity,
        });
      }

      const sourceAfter = source.quantity - data.quantity;
      const targetAfter = (targetRows[0]?.quantity ?? 0) + data.quantity;
      const inserted = await tx.insert(inventoryTransfers).values({
        fromLocationId: data.fromLocationId,
        toLocationId: data.toLocationId,
        productId: data.productId,
        variantId: data.variantId ?? null,
        quantity: data.quantity,
        actorUserId: auth.actor.id,
        notes: data.notes || null,
      }).$returningId();
      const id = inserted[0]?.id;
      if (!id) throw new Error("Gagal membuat referensi transfer");

      const fromName = locations.find(location => location.id === data.fromLocationId)?.name ?? "lokasi asal";
      const toName = locations.find(location => location.id === data.toLocationId)?.name ?? "lokasi tujuan";
      await tx.insert(inventoryMovements).values([
        { locationId: data.fromLocationId, productId: data.productId, variantId: data.variantId ?? null, quantityDelta: -data.quantity, balanceAfter: sourceAfter, type: "transfer_out", referenceType: "inventory_transfer", referenceId: id, actorUserId: auth.actor.id, notes: data.notes || `Transfer ke ${toName}` },
        { locationId: data.toLocationId, productId: data.productId, variantId: data.variantId ?? null, quantityDelta: data.quantity, balanceAfter: targetAfter, type: "transfer_in", referenceType: "inventory_transfer", referenceId: id, actorUserId: auth.actor.id, notes: data.notes || `Transfer dari ${fromName}` },
      ]);

      const onlineLocation = locations.find(location => location.isOnlineDefault);
      if (onlineLocation) {
        const onlineQuantity = onlineLocation.id === data.fromLocationId ? sourceAfter : targetAfter;
        if (data.variantId) await tx.update(productVariants).set({ stock: onlineQuantity }).where(eq(productVariants.id, data.variantId));
        else await tx.update(products).set({ stock: onlineQuantity }).where(eq(products.id, data.productId));
      }
      return id;
    });

    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/products");
    revalidatePath("/pos");
    return { success: true, transferId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Transfer stok gagal" };
  }
}
