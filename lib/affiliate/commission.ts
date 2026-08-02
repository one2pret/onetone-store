// lib/affiliate/commission.ts
import { db } from '@/lib/db';
import { commissionRules, affiliateSettings } from '@/lib/db/schema';
import { eq, and, or } from 'drizzle-orm';
import type { CommissionRule } from '@/lib/db/schema';

export type AffiliateTier = 'starter' | 'pro' | 'elite';

export type RateResolutionParams = {
  productId?: number | null;
  categoryId?: number | null;
  tier: AffiliateTier;
};

const SCOPE_PRIORITY: Record<CommissionRule['scope'], number> = {
  product: 3,
  category: 2,
  tier: 1,
  global: 0,
};

/**
 * Resolusi rate dari daftar rule yang sudah di-fetch — pure function, gampang di-unit-test.
 * Urutan menang: scope product > category > tier > global. Dalam scope yang sama,
 * priority DESC menang. Rule harus aktif dan (kalau ada window) dalam periode `now`.
 */
export function resolveRateFromRules(
  rules: CommissionRule[],
  params: RateResolutionParams,
  now: Date = new Date()
): CommissionRule | null {
  const eligible = rules.filter((rule) => {
    if (!rule.isActive) return false;
    if (rule.startsAt && new Date(rule.startsAt) > now) return false;
    if (rule.endsAt && new Date(rule.endsAt) < now) return false;

    switch (rule.scope) {
      case 'product':
        return params.productId != null && rule.productId === params.productId;
      case 'category':
        return params.categoryId != null && rule.categoryId === params.categoryId;
      case 'tier':
        return rule.scopeTier === params.tier;
      case 'global':
        return true;
      default:
        return false;
    }
  });

  if (eligible.length === 0) return null;

  eligible.sort((a, b) => {
    const scopeDiff = SCOPE_PRIORITY[b.scope] - SCOPE_PRIORITY[a.scope];
    if (scopeDiff !== 0) return scopeDiff;
    return b.priority - a.priority;
  });

  return eligible[0];
}

/**
 * Versi yang fetch rule aktif dari DB lalu resolusi. Dipanggil dari flow order.
 */
export async function resolveRate(params: RateResolutionParams): Promise<CommissionRule | null> {
  // Ambil semua rule yang berpotensi relevan: global + tier selalu diambil,
  // category/product cuma diambil kalau param-nya ada. Filter final (periode, match
  // persis) dikerjakan di resolveRateFromRules — query ini sengaja longgar.
  const scopes = ['global', 'tier'] as const;
  const conditions = scopes.map((scope) => eq(commissionRules.scope, scope));
  if (params.categoryId != null) conditions.push(eq(commissionRules.scope, 'category'));
  if (params.productId != null) conditions.push(eq(commissionRules.scope, 'product'));

  const rules = await db.select().from(commissionRules)
    .where(and(
      eq(commissionRules.isActive, true),
      or(...conditions)
    ));

  return resolveRateFromRules(rules, params);
}

export type CommissionCalcResult = {
  ratePercent: number;
  amount: number;
};

/**
 * Hitung komisi per item. Ongkir tidak pernah masuk basis — baseAmount harus sudah
 * dikurangi proporsi diskon sebelum dipanggil. Pembulatan ke rupiah penuh (floor),
 * sisa pecahan jadi milik toko, bukan affiliate.
 */
export function calculateCommission(
  baseAmount: number,
  rule: CommissionRule | null,
  fallbackRatePercent: number
): CommissionCalcResult {
  const ratePercent = rule ? Number(rule.ratePercent) : fallbackRatePercent;
  let amount = Math.floor((baseAmount * ratePercent) / 100);

  const maxCommission = rule?.maxCommission != null ? Number(rule.maxCommission) : null;
  if (maxCommission != null) {
    amount = Math.min(amount, maxCommission);
  }

  return { ratePercent, amount };
}

/**
 * Ambil default rate dari affiliate_settings (singleton row id=1) — dipakai sebagai
 * fallback terakhir kalau tidak ada rule yang match sama sekali.
 */
export async function getDefaultRatePercent(): Promise<number> {
  const rows = await db.select({ defaultRatePercent: affiliateSettings.defaultRatePercent })
    .from(affiliateSettings)
    .limit(1);
  return rows[0] ? Number(rows[0].defaultRatePercent) : 5;
}
