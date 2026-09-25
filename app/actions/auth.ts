// app/actions/auth.ts
'use server';

import { signIn, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createCustomerAccount } from '@/lib/customer-registration';

const registerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
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
    email: result.user.email,
    password,
    redirect: false,
  });

  redirect('/');
}

type LoginState = {
  success: boolean;
  error?: string;
  errors?: { email?: string[]; password?: string[] };
};

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const validated = loginSchema.safeParse({
    email: formData.get('email'),
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
      email: validated.data.email,
      password: validated.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === 'CredentialsSignin' || error.type === 'CallbackRouteError') {
        return { success: false, error: 'Email atau password salah' };
      }
      return { success: false, error: 'Terjadi kesalahan saat login' };
    }
    throw error;
  }

  const userRows = await db.select().from(users).where(eq(users.email, validated.data.email)).limit(1);
  const role = userRows[0]?.role;
  if (role === 'admin') redirect('/dashboard');
  if (role === 'cashier') redirect('/pos');
  redirect('/');
}

export async function logout() {
  await signOut({ redirectTo: '/' });
}

export async function adminLogout() {
  await signOut({ redirectTo: '/login' });
}
