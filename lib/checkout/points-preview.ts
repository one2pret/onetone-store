import { POINTS_REDEEM_VALUE } from '@/lib/membership-utils';

/**
 * UI-only safe point suggestion. Leave at least Rp1 payable and never burn
 * a point whose full Rp100 value is not applied. Backend MUST re-check balance
 * and price independently; this function is not a checkout authorization.
 */
export function maximumCheckoutPreviewPoints(
  availablePoints: number,
  payableRupiahBeforePoints: number,
): number {
  if (!Number.isSafeInteger(availablePoints) || availablePoints <= 0 ||
      !Number.isSafeInteger(payableRupiahBeforePoints) ||
      payableRupiahBeforePoints <= 0) {
    return 0;
  }
  const fullValuePoints = Math.floor(
    (payableRupiahBeforePoints - 1) / POINTS_REDEEM_VALUE,
  );
  return Math.max(0, Math.min(availablePoints, fullValuePoints));
}
