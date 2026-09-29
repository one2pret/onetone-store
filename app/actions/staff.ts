// app/actions/staff.ts
'use server';

import { db } from '@/lib/db';
import { inventoryLocations, userInventoryLocations, users } from '@/lib/db/schema';
import { eq, and, isNull, or, asc, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'admin') {
    return { ok: false as const, error: 'Unauthorized' };
  }
  return { ok: true as const, userId: Number(session.user.id) };
}

const createStaffSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'cashier', 'inventory_staff']).default('cashier'),
  locationIds: z.array(z.number().int().positive()).default([]),
}).superRefine((data, ctx) => {
  if (data.role === 'inventory_staff' && data.locationIds.length === 0) ctx.addIssue({ code: 'custom', path: ['locationIds'], message: 'Pilih minimal satu lokasi inventori' });
});

const updateStaffSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password minimal 6 karakter').optional().or(z.literal('')),
  role: z.enum(['admin', 'cashier', 'inventory_staff']),
  locationIds: z.array(z.number().int().positive()).default([]),
}).superRefine((data, ctx) => {
  if (data.role === 'inventory_staff' && data.locationIds.length === 0) ctx.addIssue({ code: 'custom', path: ['locationIds'], message: 'Pilih minimal satu lokasi inventori' });
});

export async function getStaffInventoryLocations() {
  const a = await requireAdmin();
  if (!a.ok) return [];
  return db.select({ id: inventoryLocations.id, name: inventoryLocations.name, code: inventoryLocations.code, type: inventoryLocations.type })
    .from(inventoryLocations).where(eq(inventoryLocations.isActive, true)).orderBy(asc(inventoryLocations.name));
}

async function inventoryLocationsAreValid(locationIds: number[]) {
  if (locationIds.length === 0) return false;
  const rows = await db.select({ id: inventoryLocations.id }).from(inventoryLocations)
    .where(and(inArray(inventoryLocations.id, locationIds), eq(inventoryLocations.isActive, true)));
  return rows.length === locationIds.length;
}

export async function getStaffUsers() {
  const a = await requireAdmin();
  if (!a.ok) return [];
  const [staff, assignments] = await Promise.all([db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    phone: users.phone,
    role: users.role,
    createdAt: users.createdAt,
  })
    .from(users)
    .where(and(
      isNull(users.deletedAt),
      or(eq(users.role, 'admin'), eq(users.role, 'cashier'), eq(users.role, 'inventory_staff'))
    )), db.select({ userId: userInventoryLocations.userId, locationId: userInventoryLocations.locationId }).from(userInventoryLocations)]);
  return staff.map(item => ({ ...item, locationIds: assignments.filter(assignment => assignment.userId === item.id).map(assignment => assignment.locationId) }));
}

export async function createStaffUser(prevState: unknown, formData: FormData) {
  const a = await requireAdmin();
  if (!a.ok) return { success: false, error: 'Unauthorized' };

  const validated = createStaffSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    phone: formData.get('phone') || undefined,
    role: formData.get('role') || 'cashier',
    locationIds: [...new Set(formData.getAll('locationIds').map(Number))],
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors };
  }
  if (validated.data.role === 'inventory_staff' && !(await inventoryLocationsAreValid(validated.data.locationIds))) {
    return { success: false, errors: { locationIds: ['Lokasi inventori tidak valid atau sudah nonaktif'] } };
  }

  const existing = await db.select({ id: users.id })
    .from(users).where(eq(users.email, validated.data.email)).limit(1);
  if (existing.length > 0) {
    return { success: false, errors: { email: ['Email sudah terdaftar'] } };
  }

  const hashed = await bcrypt.hash(validated.data.password, 10);

  await db.transaction(async tx => {
    const inserted = await tx.insert(users).values({
      name: validated.data.name,
      email: validated.data.email,
      password: hashed,
      phone: validated.data.phone,
      role: validated.data.role,
    }).$returningId();
    const userId = inserted[0]?.id;
    if (!userId) throw new Error('Gagal membuat akun staff');
    if (validated.data.role === 'inventory_staff') {
      await tx.insert(userInventoryLocations).values(validated.data.locationIds.map(locationId => ({ userId, locationId, createdByUserId: a.userId })));
    }
  });

  revalidatePath('/dashboard/settings/staff');
  return { success: true };
}

export async function updateStaffUser(id: number, prevState: unknown, formData: FormData) {
  const a = await requireAdmin();
  if (!a.ok) return { success: false, error: 'Unauthorized' };

  const validated = updateStaffSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') || undefined,
    password: formData.get('password') || '',
    role: formData.get('role'),
    locationIds: [...new Set(formData.getAll('locationIds').map(Number))],
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors };
  }
  if (validated.data.role === 'inventory_staff' && !(await inventoryLocationsAreValid(validated.data.locationIds))) {
    return { success: false, errors: { locationIds: ['Lokasi inventori tidak valid atau sudah nonaktif'] } };
  }

  if (id === a.userId && validated.data.role !== 'admin') return { success: false, error: 'Tidak dapat menurunkan role akun admin yang sedang digunakan' };

  const updateData: Record<string, unknown> = {
    name: validated.data.name,
    phone: validated.data.phone || null,
    role: validated.data.role,
  };

  if (validated.data.password) {
    updateData.password = await bcrypt.hash(validated.data.password, 10);
  }

  await db.transaction(async tx => {
    await tx.update(users).set(updateData).where(and(eq(users.id, id), or(eq(users.role, 'admin'), eq(users.role, 'cashier'), eq(users.role, 'inventory_staff'))));
    await tx.delete(userInventoryLocations).where(eq(userInventoryLocations.userId, id));
    if (validated.data.role === 'inventory_staff') {
      await tx.insert(userInventoryLocations).values(validated.data.locationIds.map(locationId => ({ userId: id, locationId, createdByUserId: a.userId })));
    }
  });

  revalidatePath('/dashboard/settings/staff');
  return { success: true };
}

export async function deleteStaffUser(id: number) {
  const a = await requireAdmin();
  if (!a.ok) return { success: false, error: 'Unauthorized' };

  if (id === a.userId) {
    return { success: false, error: 'Tidak bisa hapus akun sendiri' };
  }

  await db.update(users)
    .set({ deletedAt: new Date() })
    .where(and(eq(users.id, id), or(eq(users.role, 'admin'), eq(users.role, 'cashier'), eq(users.role, 'inventory_staff'))));

  revalidatePath('/dashboard/settings/staff');
  return { success: true };
}
