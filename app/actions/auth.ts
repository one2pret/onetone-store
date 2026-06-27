// app/actions/auth.ts
'use server';

import { signIn, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

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

export async function register(prevState: any, formData: FormData) {
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

  // Check if email already exists
  const existingRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const existing = existingRows[0];

  if (existing) {
    return { 
      success: false, 
      errors: { email: ['Email sudah terdaftar'] } 
    };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  await db.insert(users).values({
    name,
    email,
    password: hashedPassword,
    phone,
    role: 'customer',
  });

  // Auto login after register
  await signIn('credentials', {
    email,
    password,
    redirect: false,
  });

  redirect('/');
}

export async function login(prevState: any, formData: FormData) {
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

  // Check if user is admin → redirect to dashboard
  const userRows = await db.select().from(users).where(eq(users.email, validated.data.email)).limit(1);
  if (userRows[0]?.role === 'admin') {
    redirect('/dashboard');
  }

  redirect('/');
}

export async function logout() {
  await signOut({ redirectTo: '/' });
}

export async function adminLogout() {
  await signOut({ redirectTo: '/login' });
}
