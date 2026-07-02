'use server';

import { db } from '@/lib/db';
import { productVariants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const SIZES_ORDER = ['FREE SIZE', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const variantSchema = z.object({
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
export async function getProductVariants(productId: number) {
  const rows = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId));

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
): Promise<void> {
  // Delete removed variants
  await db
    .delete(productVariants)
    .where(eq(productVariants.productId, productId));

  if (variants.length === 0) return;

  await db.insert(productVariants).values(
    variants.map((v) => ({
      productId,
      size: v.size.trim(),
      color: v.color.trim(),
      colorHex: v.colorHex?.trim() || null,
      stock: v.stock,
      priceModifier: String(v.priceModifier ?? 0),
      sku: v.sku?.trim() || null,
      isActive: v.isActive ?? true,
    }))
  );

  revalidatePath('/dashboard/products');
}

// ----- Update single variant stock (quick edit) -----
export async function updateVariantStock(variantId: number, stock: number) {
  await db
    .update(productVariants)
    .set({ stock, updatedAt: new Date() })
    .where(eq(productVariants.id, variantId));
  revalidatePath('/dashboard/products');
}
