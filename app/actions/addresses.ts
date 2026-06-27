'use server';

import { db } from '@/lib/db';
import { addresses } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const addressSchema = z.object({
  recipientName: z.string().min(1, 'Nama penerima wajib diisi'),
  phone: z.string().min(10, 'Nomor HP minimal 10 digit'),
  address: z.string().min(10, 'Alamat minimal 10 karakter'),
  detail: z.string().optional(),
  province: z.string().min(1, 'Provinsi wajib diisi'),
  provinceId: z.string().optional(),
  city: z.string().min(1, 'Kota wajib diisi'),
  cityId: z.string().optional(),
  district: z.string().min(1, 'Kecamatan wajib diisi'),
  districtId: z.string().optional(),
  postalCode: z.string().min(1, 'Kode pos wajib diisi'),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  label: z.string().optional(),
  isDefault: z.coerce.boolean().optional(),
});

async function getAuthUserId(): Promise<number | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return Number(session.user.id);
}

async function verifyOwnership(addressId: number, userId: number): Promise<boolean> {
  const rows = await db.select().from(addresses).where(eq(addresses.id, addressId)).limit(1);
  if (rows.length === 0) return false;
  return rows[0].userId === userId;
}

export async function createAddress(formData: FormData) {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  const validated = addressSchema.safeParse({
    recipientName: formData.get('recipientName'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    detail: formData.get('detail') || undefined,
    province: formData.get('province'),
    provinceId: formData.get('provinceId') || undefined,
    city: formData.get('city'),
    cityId: formData.get('cityId') || undefined,
    district: formData.get('district'),
    districtId: formData.get('districtId') || undefined,
    postalCode: formData.get('postalCode'),
    latitude: formData.get('latitude') || undefined,
    longitude: formData.get('longitude') || undefined,
    label: formData.get('label') || undefined,
    isDefault: formData.get('isDefault') === 'on',
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors };
  }

  try {
    if (validated.data.isDefault) {
      await db.update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, userId));
    }

    await db.insert(addresses).values({
      ...validated.data,
      userId,
    });

    revalidatePath('/addresses');
    revalidatePath('/checkout');
    return { success: true };
  } catch (error) {
    return { success: false, errors: { _form: ['Gagal menambahkan alamat'] } };
  }
}

export async function updateAddress(formData: FormData) {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  const id = Number(formData.get('id'));

  const validated = addressSchema.safeParse({
    recipientName: formData.get('recipientName'),
    phone: formData.get('phone'),
    address: formData.get('address'),
    detail: formData.get('detail') || undefined,
    province: formData.get('province'),
    provinceId: formData.get('provinceId') || undefined,
    city: formData.get('city'),
    cityId: formData.get('cityId') || undefined,
    district: formData.get('district'),
    districtId: formData.get('districtId') || undefined,
    postalCode: formData.get('postalCode'),
    latitude: formData.get('latitude') || undefined,
    longitude: formData.get('longitude') || undefined,
    label: formData.get('label') || undefined,
    isDefault: formData.get('isDefault') === 'on',
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors };
  }

  const isOwner = await verifyOwnership(id, userId);
  if (!isOwner) {
    return { success: false, error: 'Alamat tidak ditemukan' };
  }

  try {
    if (validated.data.isDefault) {
      await db.update(addresses)
        .set({ isDefault: false })
        .where(eq(addresses.userId, userId));
    }

    await db.update(addresses)
      .set(validated.data)
      .where(eq(addresses.id, id));

    revalidatePath('/addresses');
    return { success: true };
  } catch (error) {
    return { success: false, errors: { _form: ['Gagal update alamat'] } };
  }
}

export async function deleteAddress(id: number) {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  const isOwner = await verifyOwnership(id, userId);
  if (!isOwner) {
    return { success: false, error: 'Alamat tidak ditemukan' };
  }

  try {
    await db.delete(addresses).where(eq(addresses.id, id));
    revalidatePath('/addresses');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal menghapus alamat' };
  }
}

export async function setDefaultAddress(id: number) {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: 'Silakan login terlebih dahulu' };
  }

  const isOwner = await verifyOwnership(id, userId);
  if (!isOwner) {
    return { success: false, error: 'Alamat tidak ditemukan' };
  }

  try {
    // Unset all defaults for this user
    await db.update(addresses)
      .set({ isDefault: false })
      .where(eq(addresses.userId, userId));

    // Set this one as default
    await db.update(addresses)
      .set({ isDefault: true })
      .where(eq(addresses.id, id));

    revalidatePath('/addresses');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Gagal set alamat utama' };
  }
}

export async function getUserAddresses() {
  const userId = await getAuthUserId();
  if (!userId) return [];

  return db.select().from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(addresses.isDefault);
}

export async function getAddress(id: number) {
  const userId = await getAuthUserId();
  if (!userId) return null;

  const rows = await db.select().from(addresses)
    .where(eq(addresses.id, id))
    .limit(1);

  if (rows.length === 0) return null;
  if (rows[0].userId !== userId) return null;

  return rows[0];
}
