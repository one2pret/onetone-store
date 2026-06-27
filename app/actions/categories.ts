// app/actions/categories.ts
'use server';

import { db } from '@/lib/db';
import { categories, products } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { slugify } from '@/lib/utils';

const categorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi'),
  description: z.string().optional(),
});

// Get all categories
export async function getAllCategories() {
  return await db.select().from(categories).orderBy(asc(categories.name));
}

// Get single category by ID
export async function getCategory(id: number) {
  const rows = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return rows[0] ?? null;
}

// Create category
export async function createCategory(prevState: any, formData: FormData) {
  const validated = categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
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
    });

    revalidatePath('/dashboard/categories');
    revalidatePath('/products');
    redirect('/dashboard/categories');
  } catch (error) {
    return { success: false, errors: { _form: ['Gagal membuat kategori'] } };
  }
}

// Update category
export async function updateCategory(id: number, prevState: any, formData: FormData) {
  const validated = categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
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
      })
      .where(eq(categories.id, id));

    revalidatePath('/dashboard/categories');
    revalidatePath('/products');
    redirect('/dashboard/categories');
  } catch (error) {
    return { success: false, errors: { _form: ['Gagal update kategori'] } };
  }
}

// Delete category
export async function deleteCategory(id: number) {
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
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal hapus kategori' };
  }
}
