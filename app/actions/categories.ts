// app/actions/categories.ts
'use server';

import { db } from '@/lib/db';
import { categories, products } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { slugify } from '@/lib/utils';
import { auth } from '@/lib/auth';

async function isAdmin() {
  const session = await auth();
  return session?.user?.role === 'admin';
}

const categorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi'),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().default(99),
  isVisible: z.boolean().default(true),
});

// Get all categories (admin — semua, visible + hidden)
export async function getAllCategories() {
  if (!(await isAdmin())) return [];
  return await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
}

// Get single category by ID
export async function getCategory(id: number) {
  if (!(await isAdmin())) return null;
  const rows = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return rows[0] ?? null;
}

// Create category
export async function createCategory(prevState: any, formData: FormData) {
  if (!(await isAdmin())) return { success: false, errors: { _form: ['Unauthorized'] } };
  const validated = categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    sortOrder: formData.get('sort_order') || 0,
    isVisible: formData.get('is_visible') === 'on',
  });

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const slug = slugify(validated.data.name);

  try {
    await db.insert(categories).values({
      name: validated.data.name,
      slug,
      description: validated.data.description,
      sortOrder: validated.data.sortOrder,
      isVisible: validated.data.isVisible,
    });
  } catch (error) {
    return { success: false, errors: { _form: ['Gagal membuat kategori. Pastikan nama kategori belum digunakan.'] } };
  }

  revalidatePath('/dashboard/categories');
  revalidatePath('/products');
  revalidatePath('/');
  revalidatePath('/categories');
  redirect('/dashboard/categories');
}

// Update category
export async function updateCategory(id: number, prevState: any, formData: FormData) {
  if (!(await isAdmin())) return { success: false, errors: { _form: ['Unauthorized'] } };
  const validated = categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    sortOrder: formData.get('sort_order') || 0,
    isVisible: formData.get('is_visible') === 'on',
  });

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const slug = slugify(validated.data.name);

  try {
    await db.update(categories)
      .set({
        name: validated.data.name,
        slug,
        description: validated.data.description,
        sortOrder: validated.data.sortOrder,
        isVisible: validated.data.isVisible,
      })
      .where(eq(categories.id, id));
  } catch (error) {
    return { success: false, errors: { _form: ['Gagal update kategori.'] } };
  }

  revalidatePath('/dashboard/categories');
  revalidatePath('/products');
  revalidatePath('/');
  revalidatePath('/categories');
  redirect('/dashboard/categories');
}

// Delete category
export async function deleteCategory(id: number) {
  if (!(await isAdmin())) return { success: false, error: 'Unauthorized' };
  try {
    // Check if category has products
    const categoryProducts = await db.select()
      .from(products)
      .where(eq(products.categoryId, id))
      .limit(1);

    if (categoryProducts.length > 0) {
      return {
        success: false,
        error: 'Kategori tidak bisa dihapus karena masih memiliki produk',
      };
    }

    await db.delete(categories).where(eq(categories.id, id));

    revalidatePath('/dashboard/categories');
    revalidatePath('/products');
    revalidatePath('/');
    revalidatePath('/categories');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal hapus kategori' };
  }
}
