'use server';

import { db } from '@/lib/db';
import { productVariants, cartItems, orderItems } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const SIZES_ORDER = ['FREE SIZE', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const variantSchema = z.object({
  id: z.number().optional(), // Add optional ID for existing variants
  size: z.string().min(1, 'Ukuran wajib diisi'),
  color: z.string().min(1, 'Warna wajib diisi'),
  colorHex: z.string().optional(),
  stock: z.coerce.number().int().min(0, 'Stok tidak boleh negatif'),
  priceModifier: z.coerce.number().default(0),
  sku: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type VariantInput = z.infer<typeof variantSchema>;

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
    const hasCartItems = await db
      .select({ id: cartItems.id })
      .from(cartItems)
      .where(eq(cartItems.variantId, variant.id))
      .limit(1);

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
          sku: variant.sku?.trim() || null,
          isActive: variant.isActive ?? true, // Ensure isActive is updated
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, variant.id));
    } else {
      // Insert new variant
      await db.insert(productVariants).values({
        productId,
        size: variant.size.trim(),
        color: variant.color.trim(),
        colorHex: variant.colorHex?.trim() || null,
        stock: variant.stock,
        priceModifier: String(variant.priceModifier ?? 0),
        sku: variant.sku?.trim() || null,
        isActive: variant.isActive ?? true,
      });
    }
  }

  revalidatePath('/dashboard/products');
  return { success: true, message: 'Varian produk berhasil diperbarui.' };
}

// ----- Get variant IDs yang sudah dipakai di order items -----
export async function getVariantIdsUsedInOrders(productId: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ variantId: orderItems.variantId })
    .from(orderItems)
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(eq(productVariants.productId, productId));
  return rows.map((r) => r.variantId).filter((id): id is number => id !== null);
}

// ----- Get variant IDs yang ada di cart aktif -----
export async function getVariantIdsUsedInCarts(productId: number): Promise<number[]> {
  const rows = await db
    .selectDistinct({ variantId: cartItems.variantId })
    .from(cartItems)
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(eq(productVariants.productId, productId));
  return rows.map((r) => r.variantId).filter((id): id is number => id !== null);
}

// ----- Update single variant stock (quick edit) -----
export async function updateVariantStock(variantId: number, stock: number) {
  await db
    .update(productVariants)
    .set({ stock, updatedAt: new Date() })
    .where(eq(productVariants.id, variantId));
  revalidatePath('/dashboard/products');
}
