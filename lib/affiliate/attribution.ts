// lib/affiliate/attribution.ts
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { affiliates, affiliateSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const AFFILIATE_COOKIE_NAME = '_otref';
export const VISITOR_COOKIE_NAME = '_otv';
export const DEFAULT_COOKIE_WINDOW_DAYS = 30;

/**
 * Bentuk cookie `_otref`. `affiliateId`/`linkId`/`clickId` cuma terisi kalau attribution
 * lewat /r/[slug] (Route Handler, Node runtime, bisa akses DB). Kalau lewat `?ref=` di
 * proxy.ts (Edge runtime, tidak bisa query DB), cuma `code` yang keisi — resolusi ke
 * affiliateId dilakukan di sini, saat attribution beneran dipakai (checkout).
 */
export type AffiliateCookiePayload = {
  code: string;
  affiliateId?: number;
  linkId?: number;
  clickId?: number;
  exp: number; // unix ms
};

export type AttributionResult = {
  affiliateId: number;
  affiliateCode: string;
  affiliateLinkId: number | null;
  affiliateClickId: number | null;
};

/**
 * Resolusi attribution affiliate untuk order yang mau dibuat. Dipanggil dari
 * createOrder() SEBELUM insert order. Order channel POS tidak pernah memanggil ini
 * sama sekali (POS pakai action terpisah) — jadi exclude channel='pos' otomatis
 * struktural, bukan lewat parameter.
 *
 * Aturan reject (kembalikan null, order tetap jalan tanpa attribution):
 * - cookie tidak ada / tidak valid / expired
 * - affiliate tidak ditemukan / status !== 'active'
 * - self-referral (affiliate.userId === userId) kecuali affiliate_settings.allowSelfReferral
 */
export async function resolveAffiliateAttribution(userId: number): Promise<AttributionResult | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AFFILIATE_COOKIE_NAME)?.value;
  if (!raw) return null;

  let payload: AffiliateCookiePayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!payload.code || !payload.exp || payload.exp < Date.now()) return null;

  const affiliateRow = await db.select().from(affiliates)
    .where(
      payload.affiliateId != null
        ? eq(affiliates.id, payload.affiliateId)
        : eq(affiliates.code, payload.code)
    )
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!affiliateRow || affiliateRow.status !== 'active') return null;

  if (affiliateRow.userId === userId) {
    const settingsRow = await db.select().from(affiliateSettings).limit(1).then((r) => r[0] ?? null);
    if (!settingsRow?.allowSelfReferral) return null;
  }

  return {
    affiliateId: affiliateRow.id,
    affiliateCode: affiliateRow.code,
    affiliateLinkId: payload.linkId ?? null,
    affiliateClickId: payload.clickId ?? null,
  };
}

/**
 * Encode payload cookie `_otref` jadi string siap di-set ke response cookie.
 */
export function encodeAffiliateCookie(payload: AffiliateCookiePayload): string {
  return JSON.stringify(payload);
}
