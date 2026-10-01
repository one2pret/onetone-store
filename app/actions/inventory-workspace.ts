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
  users,
} from "@/lib/db/schema";
import { requireInventoryAccess } from "@/lib/inventory-auth";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { preferredProductImageKey, selectProductImage } from "@/lib/product-image-resolution";
import { storage } from "@/lib/storage";

function permittedLocationCondition(locationIds: number[] | null) {
  return locationIds === null ? undefined : inArray(inventoryLocations.id, locationIds);
}

export async function getMyInventoryReceiptHistory() {
  const access = await requireInventoryAccess();
  if (!access.ok || (access.locationIds !== null && access.locationIds.length === 0)) return [];
  const conditions = [eq(inventoryReceipts.actorUserId, access.actor.id)];
  const locationCondition = permittedLocationCondition(access.locationIds);
  if (locationCondition) conditions.push(locationCondition);

  return db.select({
    id: inventoryReceipts.id,
    receiptNumber: inventoryReceipts.receiptNumber,
    referenceNumber: inventoryReceipts.referenceNumber,
    sourceType: inventoryReceipts.sourceType,
    sourceName: inventoryReceipts.sourceName,
    sourceLocationId: inventoryReceipts.sourceLocationId,
    sourceLocationName: sql<string | null>`(select name from inventory_locations where id = ${inventoryReceipts.sourceLocationId})`,
    notes: inventoryReceipts.notes,
    createdAt: inventoryReceipts.createdAt,
    locationId: inventoryLocations.id,
    locationName: inventoryLocations.name,
    locationCode: inventoryLocations.code,
    itemCount: sql<number>`(select count(*) from ${inventoryMovements} where ${inventoryMovements.referenceType} = 'inventory_receipt' and ${inventoryMovements.referenceId} = ${inventoryReceipts.id} and ${inventoryMovements.locationId} = ${inventoryReceipts.locationId})`.mapWith(Number),
    totalQuantity: sql<number>`(select coalesce(sum(${inventoryMovements.quantityDelta}), 0) from ${inventoryMovements} where ${inventoryMovements.referenceType} = 'inventory_receipt' and ${inventoryMovements.referenceId} = ${inventoryReceipts.id} and ${inventoryMovements.locationId} = ${inventoryReceipts.locationId})`.mapWith(Number),
    barcodeCodes: sql<string>`(select coalesce(group_concat(distinct pb.code separator ' '), '') from inventory_movements im left join product_barcodes pb on pb.product_id = im.product_id and (pb.variant_id = im.variant_id or (pb.variant_id is null and im.variant_id is null)) where im.reference_type = 'inventory_receipt' and im.reference_id = ${inventoryReceipts.id})`,
  }).from(inventoryReceipts)
    .innerJoin(inventoryLocations, eq(inventoryReceipts.locationId, inventoryLocations.id))
    .where(and(...conditions))
    .orderBy(desc(inventoryReceipts.createdAt), desc(inventoryReceipts.id))
    .limit(100);
}

export async function getInventoryReceiptDetail(receiptId: number) {
  if (!Number.isSafeInteger(receiptId) || receiptId <= 0) return null;
  const access = await requireInventoryAccess();
  if (!access.ok) return null;

  const conditions = [eq(inventoryReceipts.id, receiptId)];
  if (access.actor.role === "inventory_staff") conditions.push(eq(inventoryReceipts.actorUserId, access.actor.id));
  if (access.locationIds !== null) {
    if (access.locationIds.length === 0) return null;
    conditions.push(inArray(inventoryReceipts.locationId, access.locationIds));
  }
  const headers = await db.select({
    id: inventoryReceipts.id,
    receiptNumber: inventoryReceipts.receiptNumber,
    referenceNumber: inventoryReceipts.referenceNumber,
    sourceType: inventoryReceipts.sourceType,
    sourceName: inventoryReceipts.sourceName,
    sourceLocationId: inventoryReceipts.sourceLocationId,
    sourceLocationName: sql<string | null>`(select name from inventory_locations where id = ${inventoryReceipts.sourceLocationId})`,
    notes: inventoryReceipts.notes,
    createdAt: inventoryReceipts.createdAt,
    locationName: inventoryLocations.name,
    locationId: inventoryLocations.id,
    locationCode: inventoryLocations.code,
    actorName: users.name,
  }).from(inventoryReceipts)
    .innerJoin(inventoryLocations, eq(inventoryReceipts.locationId, inventoryLocations.id))
    .innerJoin(users, eq(inventoryReceipts.actorUserId, users.id))
    .where(and(...conditions)).limit(1);
  if (!headers[0]) return null;

  const items = await db.select({
    id: inventoryMovements.id,
    productName: products.name,
    posName: products.posName,
    variantId: inventoryMovements.variantId,
    size: productVariants.size,
    color: productVariants.color,
    sku: productVariants.sku,
    quantity: inventoryMovements.quantityDelta,
    balanceAfter: inventoryMovements.balanceAfter,
    barcode: productBarcodes.code,
  }).from(inventoryMovements)
    .innerJoin(products, eq(inventoryMovements.productId, products.id))
    .leftJoin(productVariants, eq(inventoryMovements.variantId, productVariants.id))
    .leftJoin(productBarcodes, and(
      eq(productBarcodes.productId, inventoryMovements.productId),
      or(
        and(isNull(inventoryMovements.variantId), isNull(productBarcodes.variantId)),
        eq(productBarcodes.variantId, inventoryMovements.variantId),
      ),
    ))
    .where(and(eq(inventoryMovements.referenceType, "inventory_receipt"), eq(inventoryMovements.referenceId, receiptId), eq(inventoryMovements.locationId, headers[0].locationId)))
    .orderBy(inventoryMovements.id);
  return { ...headers[0], items };
}

export async function getInventoryProductCatalog() {
  const access = await requireInventoryAccess();
  if (!access.ok || (access.locationIds !== null && access.locationIds.length === 0)) return null;
  const locations = await db.select({ id: inventoryLocations.id, name: inventoryLocations.name, code: inventoryLocations.code })
    .from(inventoryLocations)
    .where(and(eq(inventoryLocations.isActive, true), access.locationIds === null ? undefined : inArray(inventoryLocations.id, access.locationIds)))
    .orderBy(inventoryLocations.name);
  const locationIds = locations.map(location => location.id);
  if (locationIds.length === 0) return { locations, products: [], variants: [], barcodes: [], balances: [] };

  const [productRows, variantRows, barcodeRows, balanceRows, imageRows] = await Promise.all([
    db.select({ id: products.id, name: products.name, posName: products.posName, image: products.image, isActive: products.isActive })
      .from(products).orderBy(products.name),
    db.select({ id: productVariants.id, productId: productVariants.productId, size: productVariants.size, color: productVariants.color, sku: productVariants.sku, posLabel: productVariants.posLabel, isActive: productVariants.isActive })
      .from(productVariants).orderBy(productVariants.productId),
    db.select({ code: productBarcodes.code, productId: productBarcodes.productId, variantId: productBarcodes.variantId }).from(productBarcodes),
    db.select({ locationId: inventoryBalances.locationId, productId: inventoryBalances.productId, variantId: inventoryBalances.variantId, quantity: inventoryBalances.quantity, reserved: inventoryBalances.reserved })
      .from(inventoryBalances).where(inArray(inventoryBalances.locationId, locationIds)),
    db.select().from(productImages),
  ]);
  const catalogProducts = productRows.map(product => {
    const selected = selectProductImage(imageRows.filter(image => image.productId === product.id));
    const key = preferredProductImageKey(selected);
    return { ...product, image: key ? storage.getUrl(key) : product.image };
  });
  return { locations, products: catalogProducts, variants: variantRows, barcodes: barcodeRows, balances: balanceRows };
}
