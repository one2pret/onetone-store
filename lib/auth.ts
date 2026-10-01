// lib/auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import { isInternalCustomerEmail, normalizeLoginIdentifier } from '@/lib/registration-utils';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email atau nomor HP', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email/nomor HP dan password wajib diisi');
        }

        const identifier = normalizeLoginIdentifier(credentials.email as string);
        if (!identifier) throw new Error('Email atau nomor HP tidak valid');
        const userRows = await db.select().from(users).where(and(
          identifier.type === 'email' ? eq(users.email, identifier.value) : eq(users.phone, identifier.value),
          isNull(users.deletedAt),
        )).limit(1);
        const user = userRows[0];

        if (!user) {
          throw new Error('Akun tidak ditemukan');
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) {
          throw new Error('Password salah');
        }

        return {
          id: String(user.id),
          name: user.name,
          email: isInternalCustomerEmail(user.email) ? null : user.email,
          role: user.role ?? 'customer',
        };
      },
    }),
  ],
});

// Helper to get current user
export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}

// Helper to check if admin
export async function isAdmin() {
  const user = await getCurrentUser();
  return user?.role === 'admin';
}
