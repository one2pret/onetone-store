// app/actions/auth.ts
'use server';

import { signIn, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createCustomerAccount } from '@/lib/customer-registration';
import { normalizeLoginIdentifier } from '@/lib/registration-utils';
import { and, eq, isNull } from 'drizzle-orm';

const registerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.union([z.string().trim().email('Email tidak valid'), z.literal('')]).optional(),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  phone: z.string().trim().min(1, 'Nomor HP wajib diisi'),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email atau nomor HP wajib diisi')
    .refine(value => normalizeLoginIdentifier(value) !== null, 'Email atau nomor HP tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

type RegisterState = {
  success: boolean;
  error?: string;
  errors?: { name?: string[]; email?: string[]; password?: string[]; phone?: string[] };
};

export async function register(prevState: RegisterState, formData: FormData): Promise<RegisterState> {
  const validated = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    phone: formData.get('phone'),
  });

  if (!validated.success) {
    return { 
      success: false, 
      errors: validated.error.flatten().fieldErrors 
    };
  }

  const { name, email, password, phone } = validated.data;
  const result = await createCustomerAccount({ name, email, password, phone });
  if (!result.success) {
    return result.field
      ? { success: false, errors: { [result.field]: [result.error] } }
      : { success: false, error: result.error };
  }

  // Auto login after register
  await signIn('credentials', {
    email: result.user.phone,
    password,
    redirect: false,
  });

  redirect('/');
}

type LoginState = {
  success: boolean;
  error?: string;
  errors?: { identifier?: string[]; password?: string[] };
};

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const validated = loginSchema.safeParse({
    identifier: formData.get('identifier'),
    password: formData.get('password'),
  });

  if (!validated.success) {
    return { 
      success: false, 
      errors: validated.error.flatten().fieldErrors 
    };
  }

  try {
    await signIn('credentials', {
      email: validated.data.identifier,
      password: validated.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === 'CredentialsSignin' || error.type === 'CallbackRouteError') {
      return { success: false, error: 'Email, nomor HP, atau password salah' };
      }
      return { success: false, error: 'Terjadi kesalahan saat login' };
    }
    throw error;
  }

  const normalized = normalizeLoginIdentifier(validated.data.identifier)!;
  const userRows = await db.select().from(users).where(and(
    normalized.type === 'email' ? eq(users.email, normalized.value) : eq(users.phone, normalized.value),
    isNull(users.deletedAt),
  )).limit(1);
  const role = userRows[0]?.role;
  if (role === 'admin') redirect('/dashboard');
  if (role === 'cashier') redirect('/pos');
  if (role === 'inventory_staff') redirect('/dashboard/inventory/scan');
  redirect('/');
}

export async function logout() {
  await signOut({ redirectTo: '/' });
}

export async function adminLogout() {
  await signOut({ redirectTo: '/login' });
}
