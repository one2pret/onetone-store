// app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  phone: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validated = registerSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validasi gagal', errors: validated.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Check duplicate email
    const existing = await db.select()
      .from(users)
      .where(eq(users.email, validated.data.email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Email sudah terdaftar' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(validated.data.password, 10);

    const [result] = await db.insert(users).values({
      name: validated.data.name,
      email: validated.data.email,
      password: hashedPassword,
      phone: validated.data.phone,
      role: 'customer',
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: result.insertId,
          name: validated.data.name,
          email: validated.data.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal registrasi' },
      { status: 500 }
    );
  }
}
