// lib/auth.config.ts
// Edge-compatible auth config (no Node.js modules)
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  providers: [], // Providers added in lib/auth.ts (needs Node.js runtime)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
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
        if (!isLoggedIn || (auth?.user as any)?.role !== 'admin') {
          return Response.redirect(new URL('/login', nextUrl));
        }
      }

      // Protected customer routes
      const customerProtectedRoutes = ['/cart', '/checkout', '/orders', '/addresses'];
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
        const isAdmin = (auth?.user as any)?.role === 'admin';
        return Response.redirect(new URL(isAdmin ? '/dashboard' : '/', nextUrl));
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
