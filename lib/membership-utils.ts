// lib/membership-utils.ts — Pure functions, no DB deps (testable)

/**
 * Earn points: 1 poin per Rp10.000, dikali tier multiplier.
 * Contoh: subtotal 500.000, multiplier 2 → 100 * 2 = 100 poin.
 */
export function calculatePointsEarned(subtotal: number, pointMultiplier: number): number {
  return Math.round(subtotal / 10000) * Math.max(1, pointMultiplier || 1);
}

/**
 * Hitung diskon rupiah dari voucher.
 * free_shipping tidak mengurangi subtotal → return 0.
 */
export function calculateDiscount(
  type: 'fixed' | 'percent' | 'free_shipping',
  value: number,
  subtotal: number
): number {
  if (type === 'fixed') return Math.min(value, subtotal);
  if (type === 'percent') return Math.min(Math.round((subtotal * value) / 100), subtotal);
  return 0;
}

/**
 * Cek apakah customer dapat gratis ongkir.
 * true jika:
 * - voucher type free_shipping
 * - tier.freeShippingThreshold === 0 (selalu gratis)
 * - tier.freeShippingThreshold !== null && subtotal >= threshold
 */
export function isFreeShippingEligible(
  subtotal: number,
  tierFreeShippingThreshold: number | null | undefined,
  voucherType: string | null | undefined
): boolean {
  if (voucherType === 'free_shipping') return true;
  if (tierFreeShippingThreshold === 0) return true;
  if (tierFreeShippingThreshold != null && subtotal >= tierFreeShippingThreshold) return true;
  return false;
}
