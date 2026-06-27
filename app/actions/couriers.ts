'use server';

import { db } from '@/lib/db';
import { couriers } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const courierSchema = z.object({
  name: z.string().min(1, 'Nama kurir wajib diisi'),
  code: z.string().min(1, 'Kode kurir wajib diisi'),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') {
    return null;
  }
  return session;
}

export async function createCourier(formData: FormData) {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Hanya admin yang dapat mengelola kurir' };
  }

  const validated = courierSchema.safeParse({
    name: formData.get('name'),
    code: formData.get('code'),
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors };
  }

  try {
    await db.insert(couriers).values(validated.data);
    revalidatePath('/dashboard/couriers');
    return { success: true };
  } catch (error) {
    return { success: false, errors: { _form: ['Gagal menambahkan kurir'] } };
  }
}

export async function updateCourier(formData: FormData) {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Hanya admin yang dapat mengelola kurir' };
  }

  const id = Number(formData.get('id'));
  const validated = courierSchema.safeParse({
    name: formData.get('name'),
    code: formData.get('code'),
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors };
  }

  try {
    await db.update(couriers)
      .set({
        ...validated.data,
        isActive: formData.get('isActive') === 'on',
      })
      .where(eq(couriers.id, id));

    revalidatePath('/dashboard/couriers');
    return { success: true };
  } catch (error) {
    return { success: false, errors: { _form: ['Gagal update kurir'] } };
  }
}

export async function deleteCourier(id: number) {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Hanya admin yang dapat mengelola kurir' };
  }

  try {
    await db.delete(couriers).where(eq(couriers.id, id));
    revalidatePath('/dashboard/couriers');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal menghapus kurir' };
  }
}

export async function getCouriers() {
  return db.select().from(couriers).orderBy(asc(couriers.name));
}

export async function getActiveCouriers() {
  return db.select().from(couriers)
    .where(eq(couriers.isActive, true))
    .orderBy(asc(couriers.name));
}
