// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { loginWithCredentials } from '@/lib/api-auth';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validated = loginSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validasi gagal', errors: validated.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await loginWithCredentials(validated.data.email, validated.data.password);
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Email atau password salah' },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        token: result.token,
        user: result.user,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Gagal login' },
      { status: 500 },
    );
  }
}
