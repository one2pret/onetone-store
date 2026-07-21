// app/actions/staff.ts
'use server';

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== 'admin') {
    return { ok: false as const, error: 'Unauthorized' };
  }
  return { ok: true as const, userId: Number(session.user.id) };
}

const createStaffSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  phone: z.string().optional(),
});

const updateStaffSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password minimal 6 karakter').optional().or(z.literal('')),
});

export async function getStaffUsers() {
  const a = await requireAdmin();
  if (!a.ok) return [];
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    phone: users.phone,
    createdAt: users.createdAt,
  })
    .from(users)
    .where(and(eq(users.role, 'admin'), isNull(users.deletedAt)));
}

export async function createStaffUser(prevState: any, formData: FormData) {
  const a = await requireAdmin();
  if (!a.ok) return { success: false, error: 'Unauthorized' };

  const validated = createStaffSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    phone: formData.get('phone') || undefined,
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors };
  }

  const existing = await db.select({ id: users.id })
    .from(users).where(eq(users.email, validated.data.email)).limit(1);
  if (existing.length > 0) {
    return { success: false, errors: { email: ['Email sudah terdaftar'] } };
  }

  const hashed = await bcrypt.hash(validated.data.password, 10);

  await db.insert(users).values({
    name: validated.data.name,
    email: validated.data.email,
    password: hashed,
    phone: validated.data.phone,
    role: 'admin',
  });

  revalidatePath('/dashboard/settings/staff');
  return { success: true };
}

export async function updateStaffUser(id: number, prevState: any, formData: FormData) {
  const a = await requireAdmin();
  if (!a.ok) return { success: false, error: 'Unauthorized' };

  const validated = updateStaffSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') || undefined,
    password: formData.get('password') || '',
  });

  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors };
  }

  const updateData: Record<string, any> = {
    name: validated.data.name,
    phone: validated.data.phone || null,
  };

  if (validated.data.password) {
    updateData.password = await bcrypt.hash(validated.data.password, 10);
  }

  await db.update(users).set(updateData).where(and(eq(users.id, id), eq(users.role, 'admin')));

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
    .where(and(eq(users.id, id), eq(users.role, 'admin')));

  revalidatePath('/dashboard/settings/staff');
  return { success: true };
}
