// app/actions/products.ts
'use server';

import { db } from '@/lib/db';
import { products, categories } from '@/lib/db/schema';
import { eq, desc, and, like, asc, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { slugify } from '@/lib/utils';

const productSchema = z.object({
  name: z.string().min(1, 'Nama produk wajib diisi'),
  categoryId: z.coerce.number().optional().nullable(),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Harga tidak boleh negatif'),
  stock: z.coerce.number().min(0, 'Stock tidak boleh negatif'),
  weight: z.coerce.number().min(0, 'Berat tidak boleh negatif').default(0),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  channel: z.enum(['all', 'store_only', 'marketplace_only']).default('all'),
});

async function queryProductsWithCategory(whereConditions: any[], options?: { limit?: number }) {
  let query = db.select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...whereConditions))
    .orderBy(desc(products.createdAt))
    .$dynamic();

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const rows = await query;
  return rows.map(row => ({ ...row.products, category: row.categories }));
}

export async function getProducts() {
  const rows = await db.select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(desc(products.createdAt));
  return rows.map(row => ({ ...row.products, category: row.categories }));
}

export async function getActiveProducts(options?: {
  categorySlug?: string;
  search?: string;
  limit?: number;
  featured?: boolean;
  forStore?: boolean;
}) {
  const channelFilter = options?.forStore
    ? or(eq(products.channel, 'all'), eq(products.channel, 'store_only'))!
    : or(eq(products.channel, 'all'), eq(products.channel, 'marketplace_only'))!;

  let whereConditions: any[] = [eq(products.isActive, true), channelFilter];
  if (options?.featured) whereConditions.push(eq(products.isFeatured, true));
  if (options?.search) whereConditions.push(like(products.name, `%${options.search}%`));

  const results = await queryProductsWithCategory(whereConditions, { limit: options?.limit });
  if (options?.categorySlug) {
    return results.filter(p => p.category?.slug === options.categorySlug);
  }
  return results;
}

export async function getFeaturedProducts(limit = 8, forStore = false) {
  return getActiveProducts({ featured: true, limit, forStore });
}

export async function getBestSellerProducts(limit = 4, forStore = false) {
  const channelFilter = forStore
    ? or(eq(products.channel, 'all'), eq(products.channel, 'store_only'))!
    : or(eq(products.channel, 'all'), eq(products.channel, 'marketplace_only'))!;
  const whereConditions: any[] = [
    eq(products.isActive, true),
    eq(products.isBestSeller, true),
    channelFilter,
  ];
  return queryProductsWithCategory(whereConditions, { limit });
}

export async function getProductBySlug(slug: string) {
  const rows = await db.select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1);

  if (rows.length === 0) return null;
  return { ...rows[0].products, category: rows[0].categories };
}

export async function getProduct(id: number) {
  const rows = await db.select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  return { ...rows[0].products, category: rows[0].categories };
}

export async function getCategories() {
  return await db.select().from(categories)
    .where(eq(categories.isVisible, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryBySlug(slug: string) {
  const rows = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/**
 * Create product — returns { success, productId } instead of redirecting.
 * The caller (ProductForm) handles redirect after upsertProductVariants.
 */
export async function createProduct(prevState: any, formData: FormData) {
  const validated = productSchema.safeParse({
    name: formData.get('name'),
    categoryId: formData.get('categoryId') || null,
    description: formData.get('description'),
    price: formData.get('price'),
    stock: formData.get('stock'),
    weight: formData.get('weight') || 0,
    isActive: formData.get('isActive') === 'on',
    isFeatured: formData.get('isFeatured') === 'on',
    channel: formData.get('channel') || 'all',
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors, productId: undefined };
  }

  const image = (formData.get('image') as string) || '';
  const images = (formData.get('images') as string) || '[]';
  const slug = slugify(validated.data.name);

  try {
    const inserted = await db
      .insert(products)
      .values({
        ...validated.data,
        slug,
        image,
        images,
        price: String(validated.data.price),
      })
      .$returningId(); // Use $returningId without specific selection for simplicity

    const productId = inserted[0]?.id; // Access id from the first element of the returned array
    revalidatePath('/dashboard/products');
    revalidatePath('/products');
    // FIX: return productId so caller can save variants, then redirect
    return { success: true, productId };
  } catch {
    return {
      success: false,
      errors: { _form: ['Gagal membuat produk. Pastikan nama produk belum digunakan.'] },
      productId: undefined,
    };
  }
}

/**
 * Update product — returns { success } instead of redirecting.
 * The caller (ProductForm) handles redirect after upsertProductVariants.
 */
export async function updateProduct(id: number, prevState: any, formData: FormData) {
  const validated = productSchema.safeParse({
    name: formData.get('name'),
    categoryId: formData.get('categoryId') || null,
    description: formData.get('description'),
    price: formData.get('price'),
    stock: formData.get('stock'),
    weight: formData.get('weight') || 0,
    isActive: formData.get('isActive') === 'on',
    isFeatured: formData.get('isFeatured') === 'on',
    channel: formData.get('channel') || 'all',
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors, productId: id };
  }

  const image = (formData.get('image') as string) || '';
  const images = (formData.get('images') as string) || '[]';
  const slug = slugify(validated.data.name);

  try {
    await db
      .update(products)
      .set({ ...validated.data, slug, image, images, price: String(validated.data.price) })
      .where(eq(products.id, id));
  } catch {
    return { success: false, errors: { _form: ['Gagal update produk.'] }, productId: id };
  }

  revalidatePath('/dashboard/products');
  revalidatePath('/products');
  // FIX: return success so caller can save variants, then redirect
  return { success: true, productId: id };
}

export async function deleteProduct(id: number) {
  try {
    await db.delete(products).where(eq(products.id, id));
    revalidatePath('/dashboard/products');
    revalidatePath('/products');
    return { success: true };
  } catch {
    return { success: false, error: 'Gagal hapus produk' };
  }
}
