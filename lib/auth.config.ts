// lib/auth.config.ts
// Edge-compatible auth config (no Node.js modules)
import type { NextAuthConfig } from 'next-auth';
import { decode as defaultDecode } from 'next-auth/jwt';

export const authConfig = {
  providers: [], // Providers added in lib/auth.ts (needs Node.js runtime)
  jwt: {
    // Cookie session lama (mis. AUTH_SECRET pernah diganti) gagal decode dan
    // default behavior next-auth v5 throw JWTSessionError sampai ke error.tsx.
    // Treat gagal decode sebagai logged-out (return null) daripada crash.
    async decode(params) {
      try {
        return await defaultDecode(params);
      } catch {
        return null;
      }
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? 'customer';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Admin routes (all under /dashboard/*)
      if (pathname.startsWith('/dashboard')) {
        const role = (auth?.user as { role?: string } | undefined)?.role;
        if (!isLoggedIn || (role !== 'admin' && role !== 'inventory_staff')) {
          return Response.redirect(new URL('/login', nextUrl));
        }
        const inventoryStaffPath = pathname.startsWith('/dashboard/inventory/scan')
          || pathname.startsWith('/dashboard/inventory/history')
          || pathname.startsWith('/dashboard/inventory/catalog');
        if (role === 'inventory_staff' && !inventoryStaffPath) {
          return Response.redirect(new URL('/dashboard/inventory/scan', nextUrl));
        }
      }

      // Protected customer routes
      const customerProtectedRoutes = ['/cart', '/checkout', '/orders', '/addresses', '/account'];
      const isCustomerProtected = customerProtectedRoutes.some(route =>
        pathname === route || pathname.startsWith(route + '/')
      );

      if (isCustomerProtected && !isLoggedIn) {
        const loginUrl = new URL('/login', nextUrl);
        loginUrl.searchParams.set('redirect', pathname);
        return Response.redirect(loginUrl);
      }

      // Auth routes - redirect if already logged in
      if ((pathname === '/login' || pathname === '/register') && isLoggedIn) {
        const role = (auth?.user as { role?: string } | undefined)?.role;
        const destination = role === 'admin' ? '/dashboard' : role === 'cashier' ? '/pos' : role === 'inventory_staff' ? '/dashboard/inventory/scan' : '/';
        return Response.redirect(new URL(destination, nextUrl));
      }

      return true;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
} satisfies NextAuthConfig;
