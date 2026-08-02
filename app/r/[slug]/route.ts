// app/r/[slug]/route.ts
// Route Handler (bukan page) — redirect instan tanpa render, Node runtime (butuh DB).
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { affiliateLinks, affiliates, affiliateClicks, affiliateSettings, products, categories } from '@/lib/db/schema';
import { eq, and, gt, sql } from 'drizzle-orm';
import {
  AFFILIATE_COOKIE_NAME,
  VISITOR_COOKIE_NAME,
  DEFAULT_COOKIE_WINDOW_DAYS,
  encodeAffiliateCookie,
} from '@/lib/affiliate/attribution';

const RATE_LIMIT_WINDOW_MS = 60_000;

async function resolveTargetPath(link: typeof affiliateLinks.$inferSelect): Promise<string> {
  if (link.targetType === 'custom' && link.targetPath) return link.targetPath;

  if (link.targetType === 'product' && link.targetId) {
    const row = await db.select({ slug: products.slug }).from(products)
      .where(eq(products.id, link.targetId)).limit(1).then((r) => r[0] ?? null);
    if (row) return `/products/${row.slug}`;
  }

  if (link.targetType === 'category' && link.targetId) {
    const row = await db.select({ slug: categories.slug }).from(categories)
      .where(eq(categories.id, link.targetId)).limit(1).then((r) => r[0] ?? null);
    if (row) return `/products?category=${row.slug}`;
  }

  return '/';
}

function appendUtm(path: string, link: typeof affiliateLinks.$inferSelect): string {
  const params = new URLSearchParams();
  if (link.utmSource) params.set('utm_source', link.utmSource);
  if (link.utmMedium) params.set('utm_medium', link.utmMedium);
  if (link.utmCampaign) params.set('utm_campaign', link.utmCampaign);
  const query = params.toString();
  if (!query) return path;
  return path.includes('?') ? `${path}&${query}` : `${path}?${query}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const origin = req.nextUrl.origin;

  const link = await db.select().from(affiliateLinks)
    .where(eq(affiliateLinks.slug, slug)).limit(1).then((r) => r[0] ?? null);

  if (!link || !link.isActive) {
    return NextResponse.redirect(new URL('/', origin));
  }

  const affiliate = await db.select().from(affiliates)
    .where(eq(affiliates.id, link.affiliateId)).limit(1).then((r) => r[0] ?? null);

  if (!affiliate || affiliate.status !== 'active') {
    return NextResponse.redirect(new URL('/', origin));
  }

  // Visitor id — reuse cookie kalau ada, buat baru kalau belum
  const existingVisitorId = req.cookies.get(VISITOR_COOKIE_NAME)?.value;
  const visitorId = existingVisitorId || crypto.randomUUID();

  const ipRaw = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '';
  const ipHash = ipRaw ? crypto.createHash('sha256').update(ipRaw + (process.env.AUTH_SECRET || '')).digest('hex') : null;

  // Rate-limit: max 1 insert per visitorId+linkId per 60 detik — reuse click yang sudah ada kalau masih dalam window
  const recentClick = await db.select().from(affiliateClicks)
    .where(and(
      eq(affiliateClicks.visitorId, visitorId),
      eq(affiliateClicks.linkId, link.id),
      gt(affiliateClicks.createdAt, new Date(Date.now() - RATE_LIMIT_WINDOW_MS)),
    ))
    .orderBy(sql`${affiliateClicks.createdAt} DESC`)
    .limit(1)
    .then((r) => r[0] ?? null);

  let clickId: number;
  if (recentClick) {
    clickId = recentClick.id;
  } else {
    const [inserted] = await db.insert(affiliateClicks).values({
      affiliateId: affiliate.id,
      linkId: link.id,
      visitorId,
      ipHash,
      userAgent: req.headers.get('user-agent')?.slice(0, 500) || null,
      referer: req.headers.get('referer')?.slice(0, 500) || null,
      landingPath: `/r/${slug}`,
    });
    clickId = Number(inserted.insertId);
    await db.update(affiliateLinks)
      .set({ clickCount: sql`${affiliateLinks.clickCount} + 1` })
      .where(eq(affiliateLinks.id, link.id));
  }

  const settings = await db.select({ cookieWindowDays: affiliateSettings.cookieWindowDays })
    .from(affiliateSettings).limit(1).then((r) => r[0] ?? null);
  const cookieWindowDays = settings?.cookieWindowDays ?? DEFAULT_COOKIE_WINDOW_DAYS;

  const targetPath = appendUtm(await resolveTargetPath(link), link);
  const response = NextResponse.redirect(new URL(targetPath, origin));

  if (!existingVisitorId) {
    response.cookies.set(VISITOR_COOKIE_NAME, visitorId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365, // 1 tahun
      path: '/',
    });
  }

  // Last-click wins — selalu ditimpa kalau ada klik baru
  response.cookies.set(
    AFFILIATE_COOKIE_NAME,
    encodeAffiliateCookie({
      code: affiliate.code,
      affiliateId: affiliate.id,
      linkId: link.id,
      clickId,
      exp: Date.now() + cookieWindowDays * 24 * 60 * 60 * 1000,
    }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * cookieWindowDays,
      path: '/',
    }
  );

  return response;
}
