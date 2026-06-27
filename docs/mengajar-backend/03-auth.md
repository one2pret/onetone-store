# Sesi 03 — Authentication (NextAuth v5)

> ⏱️ Estimasi: 45 menit
> 🎯 Tujuan: Peserta paham JWT auth, bisa setup NextAuth v5, bikin login/register, dan proteksi route via middleware.

---

## 1. Konsep (10 menit)

### Authentication vs Authorization
- **Authentication** = "Siapa kamu?" (login)
- **Authorization** = "Boleh akses apa?" (role check)

### Session-based vs JWT
| | Session (Stateful) | JWT (Stateless) |
|---|---|---|
| Storage | Server (DB/Redis) | Client (cookie/localStorage) |
| Scale | Butuh shared session store | Mudah scale horizontal |
| Edge-compatible | ❌ | ✅ |
| Revocation | Mudah | Susah (perlu blacklist) |

**Next.js pilih JWT** karena edge runtime tidak punya persistent storage.

### NextAuth v5
- Library auth de-facto untuk Next.js
- Support OAuth (Google, GitHub, dll), Credentials, Email
- Kita pakai **Credentials** (email + password manual)

---

## 2. Setup NextAuth Config

### Bikin `lib/auth.config.ts` (Edge-Compatible)
Config minimal yang bisa run di edge runtime (untuk middleware).

```typescript
import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as "customer" | "admin";
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdmin = auth?.user?.role === "admin";

      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnAuth = ["/login", "/register"].includes(nextUrl.pathname);
      const isOnProtected = ["/cart", "/checkout", "/orders"].some((p) =>
        nextUrl.pathname.startsWith(p)
      );

      // Dashboard → admin only
      if (isOnDashboard) {
        if (!isLoggedIn) return false;
        if (!isAdmin) return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      // Protected customer pages → authenticated only
      if (isOnProtected) {
        if (!isLoggedIn) {
          return Response.redirect(
            new URL(`/login?redirect=${nextUrl.pathname}`, nextUrl)
          );
        }
        return true;
      }

      // /login & /register → redirect kalau sudah login
      if (isOnAuth && isLoggedIn) {
        if (isAdmin) return Response.redirect(new URL("/dashboard", nextUrl));
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
```

### Bikin `lib/auth.ts` (Full Config dengan Provider)
```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const validated = credentialsSchema.safeParse(credentials);
        if (!validated.success) return null;

        const { email, password } = validated.data;
        const result = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        const user = result[0];
        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role ?? "customer",
        };
      },
    }),
  ],
});
```

### Extend NextAuth Types
Buat `types/next-auth.d.ts`:
```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "customer" | "admin";
  }

  interface Session {
    user: {
      id: string;
      role: "customer" | "admin";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "customer" | "admin";
  }
}
```

---

## 3. NextAuth Route Handler

Buat `app/api/auth/[...nextauth]/route.ts`:
```typescript
export { GET, POST } from "@/lib/auth";
```

> Ini handler untuk endpoint internal NextAuth (`/api/auth/signin`, `/api/auth/callback`, dll).

---

## 4. Middleware untuk Proteksi Route

Buat `middleware.ts` di root project:
```typescript
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images).*)"],
};
```

**Penting**: `matcher` exclude `/api` karena API routes urus auth manual.

---

## 5. Halaman Login

### Server Action `loginAction`
Buat `app/actions/auth.ts`:

```typescript
"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export async function loginAction(
  prevState: unknown,
  formData: FormData
) {
  const validated = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  try {
    await signIn("credentials", {
      email: validated.data.email,
      password: validated.data.password,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { errors: { _form: ["Email atau password salah"] } };
    }
    throw error; // re-throw redirect error
  }
}
```

### Halaman Login Page
Buat `app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from "./_components/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-xl shadow-sm w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6">Login</h1>
        <LoginForm />
      </div>
    </div>
  );
}
```

### Client Component Form
Buat `app/(auth)/login/_components/LoginForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          name="email"
          type="email"
          required
          className="w-full px-3 py-2 border rounded-lg"
        />
        {state?.errors?.email && (
          <p className="text-red-500 text-xs mt-1">{state.errors.email[0]}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Password</label>
        <input
          name="password"
          type="password"
          required
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      {state?.errors?._form && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
          {state.errors._form[0]}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#51B1A6] text-white py-2 rounded-lg disabled:opacity-50"
      >
        {isPending ? "Loading..." : "Login"}
      </button>
    </form>
  );
}
```

---

## 6. Halaman Register

### Server Action `registerAction`
Tambah di `app/actions/auth.ts`:

```typescript
const registerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  phone: z.string().optional(),
});

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function registerAction(
  prevState: unknown,
  formData: FormData
) {
  const validated = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  // Cek email sudah dipakai
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, validated.data.email))
    .limit(1);

  if (existing.length > 0) {
    return { errors: { email: ["Email sudah terdaftar"] } };
  }

  // Hash password & insert
  const hashedPassword = await bcrypt.hash(validated.data.password, 10);
  await db.insert(users).values({
    name: validated.data.name,
    email: validated.data.email,
    password: hashedPassword,
    phone: validated.data.phone || null,
    role: "customer",
  });

  // Auto login setelah register
  await signIn("credentials", {
    email: validated.data.email,
    password: validated.data.password,
    redirectTo: "/",
  });
}
```

### Halaman Register
Buat `app/(auth)/register/page.tsx` dan form-nya — pola sama dengan login.

---

## 7. Test Login

1. Pastikan `pnpm db:seed` sudah jalan (ada user `admin@store.com` & `john@example.com`).
2. Buka `http://localhost:3000/login`
3. Login dengan:
   - **Admin**: `admin@store.com` / `password123` → harus redirect ke `/dashboard`
   - **Customer**: `john@example.com` / `password123` → harus redirect ke `/`
4. Coba akses `/dashboard` sebagai customer → harus redirect ke `/`
5. Coba akses `/cart` tanpa login → harus redirect ke `/login?redirect=/cart`

---

## 8. Helper Logout

Buat component logout button:
```tsx
"use client";
import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/" })}>
      Logout
    </button>
  );
}
```

Atau via Server Action:
```typescript
"use server";
import { signOut } from "@/lib/auth";

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}
```

---

## 9. Cek Session di Server Component

```tsx
// app/page.tsx
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    return <p>Halo, {session.user.name}!</p>;
  }
  return <p>Silakan login</p>;
}
```

---

## 10. Auth untuk REST API (Buat Flutter)

Untuk endpoint Flutter, NextAuth session-cookie tidak praktis. Solusi: pakai **Bearer Token** via JWT manual.

Buat `lib/api-auth.ts` (singgung saja di sesi ini, detail di Sesi 05):
```typescript
import { jwtVerify, SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

export async function signApiToken(payload: { id: string; role: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyApiToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { id: string; role: string };
  } catch {
    return null;
  }
}
```

---

## ✅ Checklist Akhir Sesi 03

- [ ] NextAuth config siap (`auth.ts`, `auth.config.ts`)
- [ ] Middleware proteksi route jalan
- [ ] Halaman `/login` bisa login dengan demo account
- [ ] Halaman `/register` bisa daftar user baru
- [ ] Akses `/dashboard` tanpa admin → redirect
- [ ] Akses `/cart` tanpa login → redirect ke login
- [ ] `session.user.role` bisa dipakai di server component

---

## 🐛 Common Issues

| Error | Fix |
|-------|-----|
| `[next-auth][error] MissingSecret` | `AUTH_SECRET` belum diset di `.env.local` |
| Cookie tidak kebawa | Pastikan `NEXTAUTH_URL=http://localhost:3000` di env |
| Middleware infinite redirect | Cek logic `authorized()` — biasanya lupa case |
| `session.user.id` undefined | Lupa setup callback `jwt` & `session` di `auth.config.ts` |
| TypeScript error di `session.user.role` | Belum buat `types/next-auth.d.ts` |

---

## ➡️ Lanjut ke [Sesi 04 — Server Actions](./04-server-actions.md)
