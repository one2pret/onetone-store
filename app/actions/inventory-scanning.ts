"use server";

import { db } from "@/lib/db";
import {
  inventoryBalances,
  inventoryLocations,
  inventoryMovements,
  inventoryReceipts,
  inventoryTransfers,
  productBarcodes,
  productImages,
  products,
  productVariants,
} from "@/lib/db/schema";
import { requireInventoryAccess } from "@/lib/inventory-auth";
import { preferredProductImageKey, selectProductImage } from "@/lib/product-image-resolution";
import { storage } from "@/lib/storage";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const codeSchema = z.string().trim().min(3).max(100).regex(/^\S+$/, "Kode tidak boleh mengandung spasi");

export async function getInventoryScanLocations() {
  const auth = await requireInventoryAccess();
  if (!auth.ok) return [];
  const locations = await db.select({ id: inventoryLocations.id, name: inventoryLocations.name, code: inventoryLocations.code })
    .from(inventoryLocations)
    .where(eq(inventoryLocations.isActive, true))
    .orderBy(inventoryLocations.name);
  const allowedLocationIds = auth.locationIds;
  return allowedLocationIds === null ? locations : locations.filter(location => allowedLocationIds.includes(location.id));
}

export async function lookupInventoryBarcode(codeInput: string, locationId: number) {
  const auth = await requireInventoryAccess(locationId);
  if (!auth.ok) return { success: false as const, error: auth.error };
  const parsed = z.object({ code: codeSchema, locationId: z.number().int().positive() })
    .safeParse({ code: codeInput, locationId });
  if (!parsed.success) return { success: false as const, error: "Barcode/QR atau lokasi tidak valid" };

  const rows = await db.select({
    code: productBarcodes.code,
    productId: products.id,
    productName: products.name,
    posName: products.posName,
    productImage: products.image,
    productActive: products.isActive,
    variantId: productVariants.id,
    size: productVariants.size,
    color: productVariants.color,
    sku: productVariants.sku,
    posLabel: productVariants.posLabel,
    variantActive: productVariants.isActive,
  }).from(productBarcodes)
    .innerJoin(products, eq(productBarcodes.productId, products.id))
    .leftJoin(productVariants, eq(productBarcodes.variantId, productVariants.id))
    .where(eq(productBarcodes.code, parsed.data.code))
    .limit(1);
  const item = rows[0];
  if (!item || !item.productActive || (item.variantId && !item.variantActive)) {
    return { success: false as const, error: "Barcode/QR tidak ditemukan atau produk tidak aktif" };
  }

  const balanceCondition = item.variantId
    ? and(eq(inventoryBalances.locationId, parsed.data.locationId), eq(inventoryBalances.productId, item.productId), eq(inventoryBalances.variantId, item.variantId))
    : and(eq(inventoryBalances.locationId, parsed.data.locationId), eq(inventoryBalances.productId, item.productId), isNull(inventoryBalances.variantId));
  const [balanceRows, imageRows] = await Promise.all([
    db.select({ quantity: inventoryBalances.quantity }).from(inventoryBalances).where(balanceCondition).limit(1),
    db.query.productImages.findMany({ where: eq(productImages.productId, item.productId) }),
  ]);
  const selectedImage = selectProductImage(imageRows, item.variantId ? { id: item.variantId, color: item.color ?? "" } : null);
  const imageKey = preferredProductImageKey(selectedImage);

  return {
    success: true as const,
    item: {
      code: item.code,
      productId: item.productId,
      variantId: item.variantId,
      name: item.posName?.trim() || item.productName,
      variantLabel: item.variantId ? (item.posLabel?.trim() || `${item.size} / ${item.color}`) : null,
      sku: item.sku,
      image: imageKey ? storage.getUrl(imageKey) : item.productImage,
      currentStock: balanceRows[0]?.quantity ?? 0,
    },
  };
}

const receiptSchema = z.object({
  locationId: z.number().int().positive(),
  sourceType: z.enum(["external", "internal"]),
  sourceLocationId: z.number().int().positive().optional(),
  sourceName: z.string().trim().max(150).optional(),
  idempotencyKey: z.string().uuid(),
  referenceNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(z.object({ code: codeSchema, quantity: z.number().int().positive().max(100_000) })).min(1).max(500),
}).superRefine((data, context) => {
  if (data.sourceType === "internal" && (!data.sourceLocationId || data.sourceLocationId === data.locationId)) {
    context.addIssue({ code: "custom", path: ["sourceLocationId"], message: "Pilih lokasi asal yang berbeda dari lokasi penerima" });
  }
  if (data.sourceType === "external" && !data.sourceName?.trim()) {
    context.addIssue({ code: "custom", path: ["sourceName"], message: "Nama sumber barang wajib diisi" });
  }
});

function receiptNumber() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `RCV-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function receiveInventoryByScan(input: z.input<typeof receiptSchema>) {
  const auth = await requireInventoryAccess(input.locationId);
  if (!auth.ok) return { success: false as const, error: auth.error };
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Penerimaan tidak valid" };
  const data = parsed.data;
  if (data.sourceType === "internal") {
    const sourceAccess = await requireInventoryAccess(data.sourceLocationId);
    if (!sourceAccess.ok) return { success: false as const, error: "Anda tidak memiliki akses ke lokasi asal" };
  }

  const quantities = new Map<string, number>();
  for (const item of data.items) quantities.set(item.code, (quantities.get(item.code) ?? 0) + item.quantity);
  const codes = [...quantities.keys()];

  try {
    const result = await db.transaction(async tx => {
      // Kunci lokasi dalam urutan tetap agar dua transfer silang tidak deadlock.
      const locations = await tx.select().from(inventoryLocations)
        .where(and(inArray(inventoryLocations.id, data.sourceType === "internal" ? [data.locationId, data.sourceLocationId!] : [data.locationId]), eq(inventoryLocations.isActive, true)))
        .orderBy(inventoryLocations.id)
        .for("update");
      const location = locations.find(row => row.id === data.locationId);
      if (!location) throw new Error("Lokasi inventori tidak aktif atau tidak ditemukan");
      if (data.sourceType === "internal" && locations.length !== 2) throw new Error("Lokasi asal tidak aktif atau tidak ditemukan");

      const existing = await tx.select({
        id: inventoryReceipts.id,
        receiptNumber: inventoryReceipts.receiptNumber,
        locationId: inventoryReceipts.locationId,
        sourceType: inventoryReceipts.sourceType,
        sourceLocationId: inventoryReceipts.sourceLocationId,
        sourceName: inventoryReceipts.sourceName,
      })
        .from(inventoryReceipts).where(eq(inventoryReceipts.idempotencyKey, data.idempotencyKey)).limit(1);
      if (existing[0]) {
        if (existing[0].locationId !== data.locationId || existing[0].sourceType !== data.sourceType
          || existing[0].sourceLocationId !== (data.sourceType === "internal" ? data.sourceLocationId : null)
          || existing[0].sourceName !== (data.sourceType === "external" ? data.sourceName?.trim() : null)) {
          throw new Error("Permintaan ini sudah digunakan untuk penerimaan dengan asal atau tujuan berbeda. Muat ulang halaman.");
        }
        return { id: existing[0].id, number: existing[0].receiptNumber, reused: true };
      }

      const barcodeRows = await tx.select({
        code: productBarcodes.code,
        productId: productBarcodes.productId,
        variantId: productBarcodes.variantId,
        productActive: products.isActive,
        variantActive: productVariants.isActive,
      }).from(productBarcodes)
        .innerJoin(products, eq(productBarcodes.productId, products.id))
        .leftJoin(productVariants, eq(productBarcodes.variantId, productVariants.id))
        .where(inArray(productBarcodes.code, codes));
      const barcodeMap = new Map(barcodeRows.map(row => [row.code, row]));
      const invalid = codes.find(code => {
        const row = barcodeMap.get(code);
        return !row || !row.productActive || (row.variantId && !row.variantActive);
      });
      if (invalid) throw new Error(`Barcode/QR ${invalid} tidak ditemukan atau tidak aktif`);

      const number = receiptNumber();
      const inserted = await tx.insert(inventoryReceipts).values({
        receiptNumber: number,
        idempotencyKey: data.idempotencyKey,
        locationId: data.locationId,
        sourceType: data.sourceType,
        sourceLocationId: data.sourceType === "internal" ? data.sourceLocationId : null,
        sourceName: data.sourceType === "external" ? data.sourceName?.trim() : null,
        actorUserId: auth.actor.id,
        referenceNumber: data.referenceNumber || null,
        notes: data.notes || null,
      }).$returningId();
      const receiptId = inserted[0]?.id;
      if (!receiptId) throw new Error("Gagal membuat dokumen penerimaan");

      for (const code of codes) {
        const item = barcodeMap.get(code)!;
        const quantity = quantities.get(code)!;
        if (data.sourceType === "internal") {
          const sourceLocationId = data.sourceLocationId!;
          const sourceCondition = item.variantId
            ? and(eq(inventoryBalances.locationId, sourceLocationId), eq(inventoryBalances.productId, item.productId), eq(inventoryBalances.variantId, item.variantId))
            : and(eq(inventoryBalances.locationId, sourceLocationId), eq(inventoryBalances.productId, item.productId), isNull(inventoryBalances.variantId));
          const sourceRows = await tx.select().from(inventoryBalances).where(sourceCondition).limit(1).for("update");
          const source = sourceRows[0];
          if (!source || source.quantity - source.reserved < quantity) {
            throw new Error(`Stok ${item.code} di lokasi asal tidak cukup (tersedia ${source ? Math.max(0, source.quantity - source.reserved) : 0})`);
          }
          const [decrement] = await tx.update(inventoryBalances)
            .set({ quantity: sql`${inventoryBalances.quantity} - ${quantity}` })
            .where(and(eq(inventoryBalances.id, source.id), sql`${inventoryBalances.quantity} - ${inventoryBalances.reserved} >= ${quantity}`));
          if (!decrement || decrement.affectedRows !== 1) throw new Error(`Stok ${item.code} baru berubah. Ulangi penerimaan.`);
          const destinationCondition = item.variantId
            ? and(eq(inventoryBalances.locationId, data.locationId), eq(inventoryBalances.productId, item.productId), eq(inventoryBalances.variantId, item.variantId))
            : and(eq(inventoryBalances.locationId, data.locationId), eq(inventoryBalances.productId, item.productId), isNull(inventoryBalances.variantId));
          const destinationRows = await tx.select().from(inventoryBalances).where(destinationCondition).limit(1).for("update");
          const balanceAfter = (destinationRows[0]?.quantity ?? 0) + quantity;
          if (destinationRows[0]) {
            await tx.update(inventoryBalances).set({ quantity: sql`${inventoryBalances.quantity} + ${quantity}` }).where(eq(inventoryBalances.id, destinationRows[0].id));
          } else {
            await tx.insert(inventoryBalances).values({ locationId: data.locationId, productId: item.productId, variantId: item.variantId, quantity });
          }
          await tx.insert(inventoryTransfers).values({
            fromLocationId: sourceLocationId, toLocationId: data.locationId,
            productId: item.productId, variantId: item.variantId,
            quantity, actorUserId: auth.actor.id, receiptId,
            notes: data.notes || null,
          });
          await tx.insert(inventoryMovements).values([
            { locationId: sourceLocationId, productId: item.productId, variantId: item.variantId, quantityDelta: -quantity, balanceAfter: source.quantity - quantity, type: "transfer_out", referenceType: "inventory_receipt", referenceId: receiptId, actorUserId: auth.actor.id, notes: data.notes || null },
            { locationId: data.locationId, productId: item.productId, variantId: item.variantId, quantityDelta: quantity, balanceAfter, type: "transfer_in", referenceType: "inventory_receipt", referenceId: receiptId, actorUserId: auth.actor.id, notes: data.notes || null },
          ]);
          const sourceLocation = locations.find(row => row.id === sourceLocationId)!;
          if (sourceLocation.isOnlineDefault || location.isOnlineDefault) {
            const onlineQuantity = sourceLocation.isOnlineDefault ? source.quantity - quantity : balanceAfter;
            if (item.variantId) await tx.update(productVariants).set({ stock: onlineQuantity }).where(eq(productVariants.id, item.variantId));
            else await tx.update(products).set({ stock: onlineQuantity }).where(eq(products.id, item.productId));
          }
          continue;
        }
        const condition = item.variantId
          ? and(eq(inventoryBalances.locationId, data.locationId), eq(inventoryBalances.productId, item.productId), eq(inventoryBalances.variantId, item.variantId))
          : and(eq(inventoryBalances.locationId, data.locationId), eq(inventoryBalances.productId, item.productId), isNull(inventoryBalances.variantId));
        const balanceRows = await tx.select().from(inventoryBalances).where(condition).limit(1).for("update");
        const balanceAfter = (balanceRows[0]?.quantity ?? 0) + quantity;
        if (balanceRows[0]) {
          await tx.update(inventoryBalances).set({ quantity: balanceAfter }).where(eq(inventoryBalances.id, balanceRows[0].id));
        } else {
          await tx.insert(inventoryBalances).values({ locationId: data.locationId, productId: item.productId, variantId: item.variantId, quantity: balanceAfter });
        }
        await tx.insert(inventoryMovements).values({
          locationId: data.locationId,
          productId: item.productId,
          variantId: item.variantId,
          quantityDelta: quantity,
          balanceAfter,
          type: "receipt",
          referenceType: "inventory_receipt",
          referenceId: receiptId,
          actorUserId: auth.actor.id,
          notes: data.notes || (data.referenceNumber ? `Penerimaan ${data.referenceNumber}` : "Penerimaan melalui scanner"),
        });
        if (location.isOnlineDefault) {
          if (item.variantId) await tx.update(productVariants).set({ stock: balanceAfter }).where(eq(productVariants.id, item.variantId));
          else await tx.update(products).set({ stock: balanceAfter }).where(eq(products.id, item.productId));
        }
      }
      return { id: receiptId, number, reused: false };
    });

    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/inventory/scan");
    revalidatePath("/dashboard/inventory/history");
    revalidatePath("/dashboard/inventory/report");
    revalidatePath("/dashboard/products");
    revalidatePath("/products");
    revalidatePath("/pos");
    return { success: true as const, receiptId: result.id, receiptNumber: result.number, reused: result.reused };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Penerimaan stok gagal" };
  }
}
