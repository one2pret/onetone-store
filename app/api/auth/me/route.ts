// app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  return NextResponse.json({ success: true, data: user });
}

const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').optional(),
  phone: z.string().optional(),
});

export async function PUT(request: Request) {
  try {
    const user = await getApiUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const validated = updateProfileSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validasi gagal', errors: validated.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const updateData: Record<string, string> = {};
    if (validated.data.name !== undefined) updateData.name = validated.data.name;
    if (validated.data.phone !== undefined) updateData.phone = validated.data.phone;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada data yang diubah' },
        { status: 400 },
      );
    }

    await db.update(users).set(updateData).where(eq(users.id, user.id));

    const [updated] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
    }).from(users).where(eq(users.id, user.id)).limit(1);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal memperbarui profil' },
      { status: 500 },
    );
  }
}

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password wajib diisi'),
});

export async function DELETE(request: Request) {
  try {
    const user = await getApiUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const validated = deleteAccountSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validasi gagal', errors: validated.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const [userRow] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!userRow) {
      return NextResponse.json(
        { success: false, error: 'User tidak ditemukan' },
        { status: 404 },
      );
    }

    const isValid = await bcrypt.compare(validated.data.password, userRow.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Password salah' },
        { status: 401 },
      );
    }

    // Soft delete: anonymize email and set deletedAt
    const anonymousEmail = `deleted_${userRow.id}_${Date.now()}@deleted.local`;
    await db.update(users)
      .set({
        email: anonymousEmail,
        name: `Deleted User ${userRow.id}`,
        phone: null,
        address: null,
        password: '', // Remove password for security
        deletedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal menghapus akun' },
      { status: 500 },
    );
  }
}
