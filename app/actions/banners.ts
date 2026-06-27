// app/actions/banners.ts
'use server';

import { db } from '@/lib/db';
import { banners } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { auth } from '@/lib/auth';

const bannerSchema = z.object({
  title: z.string().min(1, 'Judul banner wajib diisi'),
  subtitle: z.string().optional(),
  image: z.string().min(1, 'URL gambar wajib diisi'),
  link: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().default(0),
});

// Get active banners (for shop)
export async function getActiveBanners() {
  return await db.select()
    .from(banners)
    .where(eq(banners.isActive, true))
    .orderBy(asc(banners.sortOrder));
}

// Get all banners (for admin)
export async function getAllBanners() {
  return await db.select()
    .from(banners)
    .orderBy(asc(banners.sortOrder));
}

// Get single banner
export async function getBanner(id: number) {
  const rows = await db.select().from(banners).where(eq(banners.id, id)).limit(1);
  return rows[0] ?? null;
}

// Create banner (admin)
export async function createBanner(formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') {
    return { success: false, errors: { _form: ['Unauthorized'] } };
  }

  const validated = bannerSchema.safeParse({
    title: formData.get('title'),
    subtitle: formData.get('subtitle') || undefined,
    image: formData.get('image'),
    link: formData.get('link') || undefined,
    isActive: formData.get('isActive') === 'on',
    sortOrder: formData.get('sortOrder') || 0,
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors };
  }

  try {
    await db.insert(banners).values(validated.data);
    revalidatePath('/dashboard/banners');
    revalidatePath('/');
    redirect('/dashboard/banners');
  } catch (error) {
    return { success: false, errors: { _form: ['Gagal membuat banner'] } };
  }
}

// Update banner (admin)
export async function updateBanner(id: number, formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') {
    return { success: false, errors: { _form: ['Unauthorized'] } };
  }

  const validated = bannerSchema.safeParse({
    title: formData.get('title'),
    subtitle: formData.get('subtitle') || undefined,
    image: formData.get('image'),
    link: formData.get('link') || undefined,
    isActive: formData.get('isActive') === 'on',
    sortOrder: formData.get('sortOrder') || 0,
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors };
  }

  try {
    await db.update(banners).set(validated.data).where(eq(banners.id, id));
    revalidatePath('/dashboard/banners');
    revalidatePath('/');
    redirect('/dashboard/banners');
  } catch (error) {
    return { success: false, errors: { _form: ['Gagal update banner'] } };
  }
}

// Delete banner (admin)
export async function deleteBanner(id: number) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    await db.delete(banners).where(eq(banners.id, id));
    revalidatePath('/dashboard/banners');
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal hapus banner' };
  }
}
