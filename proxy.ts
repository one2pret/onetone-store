// proxy.ts (Next.js 16 — sebelumnya middleware.ts)
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';
import {
  AFFILIATE_COOKIE_NAME,
  VISITOR_COOKIE_NAME,
  DEFAULT_COOKIE_WINDOW_DAYS,
  encodeAffiliateCookie,
} from '@/lib/affiliate/attribution';

const { auth } = NextAuth(authConfig);

// Edge runtime — tidak bisa query DB (mysql2 butuh Node.js TCP). Kalau ada ?ref=,
// cuma simpan kode mentah di cookie; resolusi ke affiliateId dilakukan nanti di
// resolveAffiliateAttribution() (lib/affiliate/attribution.ts) saat checkout, yang
// jalan di Server Action (Node runtime, DB tersedia). Jalur lengkap dengan tracking
// klik + link spesifik ada di app/r/[slug]/route.ts (Route Handler, Node runtime).
export default auth((req) => {
  const { nextUrl } = req;
  const ref = nextUrl.searchParams.get('ref');

  if (!ref) return NextResponse.next();

  // nextUrl.clone() membawa origin dari header request internal, yang di balik
  // reverse proxy Docker bisa jadi host container (0.0.0.0:3000) kalau X-Forwarded-*
  // tidak diteruskan persis. Bangun ulang pakai NEXT_PUBLIC_APP_URL sebagai base.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || nextUrl.origin;
  const cleanUrl = new URL(nextUrl.pathname + nextUrl.search, baseUrl);
  cleanUrl.searchParams.delete('ref');

  const response = NextResponse.redirect(cleanUrl);

  response.cookies.set(
    AFFILIATE_COOKIE_NAME,
    encodeAffiliateCookie({
      code: ref,
      exp: Date.now() + DEFAULT_COOKIE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * DEFAULT_COOKIE_WINDOW_DAYS,
      path: '/',
    }
  );

  if (!req.cookies.get(VISITOR_COOKIE_NAME)) {
    response.cookies.set(VISITOR_COOKIE_NAME, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }

  return response;
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images).*)'],
};
