"use server";

import { db } from "@/lib/db";
import {
  inventoryBalances,
  inventoryLocations,
  inventoryMovements,
  inventoryReceipts,
  productBarcodes,
  productImages,
  products,
  productVariants,
} from "@/lib/db/schema";
import { requireInventoryAccess } from "@/lib/inventory-auth";
import { preferredProductImageKey, selectProductImage } from "@/lib/product-image-resolution";
import { storage } from "@/lib/storage";
import { and, eq, inArray, isNull } from "drizzle-orm";
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
  idempotencyKey: z.string().uuid(),
  referenceNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(z.object({ code: codeSchema, quantity: z.number().int().positive().max(100_000) })).min(1).max(500),
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

  const quantities = new Map<string, number>();
  for (const item of data.items) quantities.set(item.code, (quantities.get(item.code) ?? 0) + item.quantity);
  const codes = [...quantities.keys()];

  try {
    const result = await db.transaction(async tx => {
      // Lock lokasi menserialkan penerimaan pada lokasi yang sama dan mencegah
      // dua operator membaca saldo awal yang sama.
      const locations = await tx.select().from(inventoryLocations)
        .where(and(eq(inventoryLocations.id, data.locationId), eq(inventoryLocations.isActive, true)))
        .limit(1)
        .for("update");
      const location = locations[0];
      if (!location) throw new Error("Lokasi inventori tidak aktif atau tidak ditemukan");

      const existing = await tx.select({ id: inventoryReceipts.id, receiptNumber: inventoryReceipts.receiptNumber })
        .from(inventoryReceipts).where(eq(inventoryReceipts.idempotencyKey, data.idempotencyKey)).limit(1);
      if (existing[0]) return { id: existing[0].id, number: existing[0].receiptNumber, reused: true };

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
        actorUserId: auth.actor.id,
        referenceNumber: data.referenceNumber || null,
        notes: data.notes || null,
      }).$returningId();
      const receiptId = inserted[0]?.id;
      if (!receiptId) throw new Error("Gagal membuat dokumen penerimaan");

      for (const code of codes) {
        const item = barcodeMap.get(code)!;
        const quantity = quantities.get(code)!;
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
    revalidatePath("/dashboard/products");
    revalidatePath("/products");
    revalidatePath("/pos");
    return { success: true as const, receiptId: result.id, receiptNumber: result.number, reused: result.reused };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Penerimaan stok gagal" };
  }
}
