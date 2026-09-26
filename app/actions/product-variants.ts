'use server';

import { db } from '@/lib/db';
import { productVariants, cartItems, orderItems, products } from '@/lib/db/schema';
import { requireOnlineInventoryLocation, setOnlineInventoryStock } from '@/lib/inventory-stock';
import { assertBarcodeAvailable, setPrimaryBarcode } from '@/lib/product-barcodes';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth';

const SIZES_ORDER = ['FREE SIZE', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const variantSchema = z.object({
  id: z.number().optional(), // Add optional ID for existing variants
  size: z.string().min(1, 'Ukuran wajib diisi'),
  color: z.string().min(1, 'Warna wajib diisi'),
  colorHex: z.string().optional(),
  stock: z.coerce.number().int().min(0, 'Stok tidak boleh negatif'),
  priceModifier: z.coerce.number().default(0),
  salePriceOverride: z.number().min(0).nullable().optional(),
  sku: z.string().optional(),
  posLabel: z.string().trim().max(60, 'Label POS maksimal 60 karakter').optional(),
  barcode: z.string().trim().max(100, 'Barcode maksimal 100 karakter').optional(),
  isActive: z.boolean().default(true),
});

export type VariantInput = z.infer<typeof variantSchema>;

async function isAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === 'admin';
}

// ----- Get variants for a product -----
export async function getProductVariants(productId: number, onlyActive = false) {
  const whereConditions = [eq(productVariants.productId, productId)];
  if (onlyActive) {
    whereConditions.push(eq(productVariants.isActive, true));
  }

  const rows = await db
    .select()
    .from(productVariants)
    .where(and(...whereConditions));

  return rows.sort((a, b) => {
    const si = SIZES_ORDER.indexOf(a.size.toUpperCase());
    const sj = SIZES_ORDER.indexOf(b.size.toUpperCase());
    if (si !== sj) return (si === -1 ? 99 : si) - (sj === -1 ? 99 : sj);
    return a.color.localeCompare(b.color);
  });
}

// ----- Upsert all variants for a product (replace strategy) -----
export async function upsertProductVariants(
  productId: number,
  variants: VariantInput[]
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!(await isAdmin())) {
    return { success: false, error: 'Unauthorized' };
  }

  const parsedVariants = z.array(variantSchema).safeParse(variants);
  if (!parsedVariants.success) {
    return { success: false, error: 'Data varian tidak valid' };
  }
  variants = parsedVariants.data;

  try {
    await requireOnlineInventoryLocation();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Gudang Online belum dikonfigurasi' };
  }

  const productRows = await db
    .select({ price: products.price })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  const basePrice = Number(productRows[0]?.price);
  if (!Number.isFinite(basePrice)) {
    return { success: false, error: 'Produk tidak ditemukan' };
  }
  const invalidPrice = variants.find(variant => basePrice + variant.priceModifier <= 0);
  if (invalidPrice) {
    return {
      success: false,
      error: `Harga akhir varian ${invalidPrice.size} / ${invalidPrice.color} harus lebih dari Rp0`,
    };
  }

  const incomingBarcodes = variants.map(variant => variant.barcode?.trim()).filter((code): code is string => Boolean(code));
  if (new Set(incomingBarcodes).size !== incomingBarcodes.length) {
    return { success: false, error: 'Barcode antarvarian tidak boleh sama' };
  }
  for (const variant of variants) {
    await assertBarcodeAvailable(variant.barcode, variant.id ? { productId, variantId: variant.id } : undefined);
  }

  const existingVariants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId));

  const incomingVariantIds = variants.filter(v => v.id).map(v => v.id!);
  const existingVariantIds = existingVariants.map(v => v.id);

  // 1. Handle variants removed from the UI (soft delete or hard delete)
  const variantsToRemove = existingVariants.filter(
    (existing) => !incomingVariantIds.includes(existing.id)
  );

  for (const variant of variantsToRemove) {
    const hasOrderItems = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.variantId, variant.id))
      .limit(1);

    if (hasOrderItems.length > 0) {
      // Rule 3: If variant used in orderItems -> archive (set isActive = false)
      await db
        .update(productVariants)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(productVariants.id, variant.id));
    } else {
      const hasCartItems = await db
        .select({ id: cartItems.id })
        .from(cartItems)
        .where(eq(cartItems.variantId, variant.id))
        .limit(1);

      if (hasCartItems.length > 0) {
        // Rule 2: If variant used in cartItems -> archive (set isActive = false)
        await db
          .update(productVariants)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(productVariants.id, variant.id));
      } else {
        // Rule 1: If variant not used in cartItems and orderItems -> hard delete
        await db.delete(productVariants).where(eq(productVariants.id, variant.id));
      }
    }
  }

  // 2. Handle new and updated variants
  for (const variant of variants) {
    if (variant.id && existingVariantIds.includes(variant.id)) {
      // Update existing variant
      await db
        .update(productVariants)
        .set({
          size: variant.size.trim(),
          color: variant.color.trim(),
          colorHex: variant.colorHex?.trim() || null,
          stock: variant.stock,
          priceModifier: String(variant.priceModifier ?? 0),
          salePriceOverride: variant.salePriceOverride === null || variant.salePriceOverride === undefined
            ? null
            : String(variant.salePriceOverride),
          sku: variant.sku?.trim() || null,
          posLabel: variant.posLabel?.trim() || null,
          isActive: variant.isActive ?? true, // Ensure isActive is updated
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, variant.id));
      await setOnlineInventoryStock(productId, variant.id, variant.stock);
      await setPrimaryBarcode(productId, variant.id, variant.barcode);
    } else {
      // Insert new variant
      const inserted = await db.insert(productVariants).values({
        productId,
        size: variant.size.trim(),
        color: variant.color.trim(),
        colorHex: variant.colorHex?.trim() || null,
        stock: variant.stock,
        priceModifier: String(variant.priceModifier ?? 0),
        salePriceOverride: variant.salePriceOverride === null || variant.salePriceOverride === undefined
          ? null
          : String(variant.salePriceOverride),
        sku: variant.sku?.trim() || null,
        posLabel: variant.posLabel?.trim() || null,
        isActive: variant.isActive ?? true,
      }).$returningId();
      if (inserted[0]?.id) await setOnlineInventoryStock(productId, inserted[0].id, variant.stock);
      if (inserted[0]?.id) await setPrimaryBarcode(productId, inserted[0].id, variant.barcode);
    }
  }

  revalidatePath('/dashboard/products');
  return { success: true, message: 'Varian produk berhasil diperbarui.' };
}

// ----- Get variant IDs yang sudah dipakai di order items -----
export async function getVariantIdsUsedInOrders(productId: number): Promise<number[]> {
  if (!(await isAdmin())) return [];

  const rows = await db
    .selectDistinct({ variantId: orderItems.variantId })
    .from(orderItems)
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(eq(productVariants.productId, productId));
  return rows.map((r) => r.variantId).filter((id): id is number => id !== null);
}

// ----- Get variant IDs yang ada di cart aktif -----
export async function getVariantIdsUsedInCarts(productId: number): Promise<number[]> {
  if (!(await isAdmin())) return [];

  const rows = await db
    .selectDistinct({ variantId: cartItems.variantId })
    .from(cartItems)
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(eq(productVariants.productId, productId));
  return rows.map((r) => r.variantId).filter((id): id is number => id !== null);
}

// ----- Update single variant stock (quick edit) -----
export async function updateVariantStock(variantId: number, stock: number) {
  if (!(await isAdmin())) {
    return { success: false, error: 'Unauthorized' };
  }
  if (!Number.isInteger(variantId) || variantId <= 0 || !Number.isInteger(stock) || stock < 0) {
    return { success: false, error: 'Data stok tidak valid' };
  }

  try {
    await requireOnlineInventoryLocation();
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Gudang Online belum dikonfigurasi' };
  }

  await db
    .update(productVariants)
    .set({ stock, updatedAt: new Date() })
    .where(eq(productVariants.id, variantId));
  const rows = await db.select({ productId: productVariants.productId }).from(productVariants).where(eq(productVariants.id, variantId)).limit(1);
  if (rows[0]) await setOnlineInventoryStock(rows[0].productId, variantId, stock);
  revalidatePath('/dashboard/products');
  return { success: true };
}
