// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { loginWithCredentials } from '@/lib/api-auth';
import { z } from 'zod';
import { normalizeLoginIdentifier } from '@/lib/registration-utils';

const loginSchema = z.object({
  identifier: z.string().trim().refine(value => normalizeLoginIdentifier(value) !== null, 'Email atau nomor HP tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validated = loginSchema.safeParse({
      identifier: body.identifier ?? body.email,
      password: body.password,
    });
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: 'Validasi gagal', errors: validated.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const result = await loginWithCredentials(validated.data.identifier, validated.data.password);
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Email, nomor HP, atau password salah' },
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
  } catch {
    return NextResponse.json(
      { success: false, error: 'Gagal login' },
      { status: 500 },
    );
  }
}
