// lib/api-auth.ts — API auth helper: supports both cookie (web) and Bearer token (Flutter)
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || 'secret');
const TOKEN_EXPIRY = '30d';

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
}

// Sign a JWT for Flutter/mobile clients
export async function signApiToken(user: ApiUser): Promise<string> {
  return new SignJWT({ id: user.id, email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

// Verify Bearer token from Authorization header
async function verifyBearerToken(token: string): Promise<ApiUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.id as number;

    const rows = await db.select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    if (rows.length === 0) return null;

    const user = rows[0];
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role ?? 'customer',
      phone: user.phone,
    };
  } catch {
    return null;
  }
}

// Get authenticated user from request — tries Bearer token first, then cookie session
export async function getApiUser(request: Request): Promise<ApiUser | null> {
  // 1. Try Bearer token (Flutter/mobile)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return verifyBearerToken(token);
  }

  // 2. Fall back to cookie session (web)
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: Number(session.user.id),
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    role: (session.user as any).role ?? 'customer',
    phone: null,
  };
}

// Login helper: verify credentials and return user + token
export async function loginWithCredentials(
  email: string,
  password: string,
): Promise<{ user: ApiUser; token: string } | null> {
  const rows = await db.select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);
  if (rows.length === 0) return null;

  const user = rows[0];
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return null;

  const apiUser: ApiUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? 'customer',
    phone: user.phone,
  };

  const token = await signApiToken(apiUser);
  return { user: apiUser, token };
}
