// app/actions/products.ts
'use server';

import { db } from '@/lib/db';
import { products, categories } from '@/lib/db/schema';
import { eq, desc, and, like, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { slugify } from '@/lib/utils';

// Validation schema
const productSchema = z.object({
  name: z.string().min(1, 'Nama produk wajib diisi'),
  categoryId: z.coerce.number().optional().nullable(),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Harga tidak boleh negatif'),
  stock: z.coerce.number().min(0, 'Stock tidak boleh negatif'),
  weight: z.coerce.number().min(0, 'Berat tidak boleh negatif').default(0),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
});

// Helper to query products with category join
async function queryProductsWithCategory(whereConditions: any[], options?: { limit?: number; orderBy?: any }) {
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
  return rows.map(row => ({
    ...row.products,
    category: row.categories,
  }));
}

// Get all products (for admin)
export async function getProducts() {
  const rows = await db.select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(desc(products.createdAt));

  return rows.map(row => ({
    ...row.products,
    category: row.categories,
  }));
}

// Get active products (for shop)
export async function getActiveProducts(options?: {
  categorySlug?: string;
  search?: string;
  limit?: number;
  featured?: boolean;
}) {
  let whereConditions: any[] = [eq(products.isActive, true)];

  if (options?.featured) {
    whereConditions.push(eq(products.isFeatured, true));
  }

  if (options?.search) {
    whereConditions.push(like(products.name, `%${options.search}%`));
  }

  const results = await queryProductsWithCategory(whereConditions, { limit: options?.limit });

  // Filter by category slug if provided
  if (options?.categorySlug) {
    return results.filter(p => p.category?.slug === options.categorySlug);
  }

  return results;
}

// Get featured products
export async function getFeaturedProducts(limit = 8) {
  return getActiveProducts({ featured: true, limit });
}

// Get single product by slug
export async function getProductBySlug(slug: string) {
  const rows = await db.select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.slug, slug))
    .limit(1);

  if (rows.length === 0) return null;
  return { ...rows[0].products, category: rows[0].categories };
}

// Get single product by ID
export async function getProduct(id: number) {
  const rows = await db.select()
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id))
    .limit(1);

  if (rows.length === 0) return null;
  return { ...rows[0].products, category: rows[0].categories };
}

// Get all categories
export async function getCategories() {
  return await db.select().from(categories).orderBy(asc(categories.name));
}

// Get category by slug
export async function getCategoryBySlug(slug: string) {
  const rows = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1);
  return rows[0] ?? null;
}

// Create product (admin)
export async function createProduct(formData: FormData) {
  const validated = productSchema.safeParse({
    name: formData.get('name'),
    categoryId: formData.get('categoryId') || null,
    description: formData.get('description'),
    price: formData.get('price'),
    stock: formData.get('stock'),
    weight: formData.get('weight') || 0,
    isActive: formData.get('isActive') === 'on',
    isFeatured: formData.get('isFeatured') === 'on',
  });

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors
    };
  }

  const slug = slugify(validated.data.name);

  try {
    await db.insert(products).values({
      ...validated.data,
      slug,
      price: String(validated.data.price),
    });

    revalidatePath('/dashboard/products');
    revalidatePath('/products');
    redirect('/dashboard/products');
  } catch (error) {
    return { success: false, errors: { _form: ['Gagal membuat produk'] } };
  }
}

// Update product (admin)
export async function updateProduct(id: number, formData: FormData) {
  const validated = productSchema.safeParse({
    name: formData.get('name'),
    categoryId: formData.get('categoryId') || null,
    description: formData.get('description'),
    price: formData.get('price'),
    stock: formData.get('stock'),
    weight: formData.get('weight') || 0,
    isActive: formData.get('isActive') === 'on',
    isFeatured: formData.get('isFeatured') === 'on',
  });

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors
    };
  }

  const slug = slugify(validated.data.name);

  try {
    await db.update(products)
      .set({
        ...validated.data,
        slug,
        price: String(validated.data.price),
      })
      .where(eq(products.id, id));

    revalidatePath('/dashboard/products');
    revalidatePath('/products');
    redirect('/dashboard/products');
  } catch (error) {
    return { success: false, errors: { _form: ['Gagal update produk'] } };
  }
}

// Delete product (admin)
export async function deleteProduct(id: number) {
  try {
    await db.delete(products).where(eq(products.id, id));
    revalidatePath('/dashboard/products');
    revalidatePath('/products');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal hapus produk' };
  }
}
