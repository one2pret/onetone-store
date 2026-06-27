// app/api/auth/password/route.ts
import { NextResponse } from 'next/server';
import { getApiUser } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password lama wajib diisi'),
  newPassword: z.string().min(6, 'Password baru minimal 6 karakter'),
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
    const validated = changePasswordSchema.safeParse(body);
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

    const isValid = await bcrypt.compare(validated.data.currentPassword, userRow.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Password lama salah' },
        { status: 401 },
      );
    }

    const hashedPassword = await bcrypt.hash(validated.data.newPassword, 10);
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal mengubah password' },
      { status: 500 },
    );
  }
}
