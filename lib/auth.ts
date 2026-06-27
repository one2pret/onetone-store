// lib/auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email dan password wajib diisi');
        }

        const userRows = await db.select().from(users).where(eq(users.email, credentials.email as string)).limit(1);
        const user = userRows[0];

        if (!user) {
          throw new Error('Email tidak terdaftar');
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
          email: user.email,
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
