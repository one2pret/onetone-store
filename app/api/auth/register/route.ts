// app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCustomerAccount } from '@/lib/customer-registration';

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

    const result = await createCustomerAccount(validated.data);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, field: result.field },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...result.user,
          welcomeVoucherGranted: result.welcomeVoucherGranted,
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
