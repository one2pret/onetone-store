import { calculateRedeemAmount, isFreeShippingEligible, POINTS_REDEEM_VALUE } from '@/lib/membership-utils';

/**
 * Pure financial parity contract for the future shared web/API checkout.
 *
 * Input values must come from the SERVER after rechecking the authenticated
 * cart, owned voucher/grant, membership and trusted shipping quote. This does
 * not authorize charging a payment provider or committing an order.
 */
export type CheckoutBusinessTotalsInput = {
  subtotal: number;
  quotedShippingCost: number;
  voucher: {
    discountAmount: number;
    freeShipping: boolean;
    allowPoints: boolean;
  } | null;
  tierFreeShippingThreshold: number | null;
  pointsToRedeem: number;
  availablePoints: number | null;
};

export type CheckoutBusinessTotals = {
  subtotal: number;
  discountAmount: number;
  freeShipping: boolean;
  shippingCost: number;
  pointsRedeemed: number;
  pointsDiscountAmount: number;
  total: number;
};

export type CheckoutBusinessTotalsErrorCode =
  | 'invalid_amount'
  | 'invalid_voucher'
  | 'invalid_points'
  | 'membership_required'
  | 'voucher_points_conflict'
  | 'insufficient_points'
  | 'excess_points'
  | 'zero_total';

export class CheckoutBusinessTotalsError extends Error {
  constructor(public readonly code: CheckoutBusinessTotalsErrorCode) {
    super(code);
    this.name = 'CheckoutBusinessTotalsError';
  }
}

function validRupiah(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Calculate one deterministic checkout financial snapshot using the existing
 * membership helpers, but disallow invalid or economically ambiguous inputs.
 *
 * Unlike the legacy action, the future live path must not consume more points
 * than the actual Rupiah discount (the helper caps a discount, not point debit)
 * or ask Xendit for a zero-value invoice. Both cases fail CLOSED. The caller
 * should ask the customer to reduce points and review the updated total.
 */
export function calculateCheckoutBusinessTotals(
  input: CheckoutBusinessTotalsInput,
): CheckoutBusinessTotals {
  const { subtotal, quotedShippingCost, voucher, pointsToRedeem, availablePoints } = input;
  if (!validRupiah(subtotal) || subtotal === 0 || !validRupiah(quotedShippingCost)) {
    throw new CheckoutBusinessTotalsError('invalid_amount');
  }
  const threshold = input.tierFreeShippingThreshold;
  if (threshold !== null && !validRupiah(threshold)) {
    throw new CheckoutBusinessTotalsError('invalid_amount');
  }

  const discountAmount = voucher?.discountAmount ?? 0;
  if (!validRupiah(discountAmount) || discountAmount > subtotal) {
    throw new CheckoutBusinessTotalsError('invalid_voucher');
  }

  if (!Number.isSafeInteger(pointsToRedeem) || pointsToRedeem < 0 ||
      (availablePoints !== null && (!Number.isSafeInteger(availablePoints) || availablePoints < 0))) {
    throw new CheckoutBusinessTotalsError('invalid_points');
  }
  if (pointsToRedeem > 0 && availablePoints === null) {
    throw new CheckoutBusinessTotalsError('membership_required');
  }
  if (pointsToRedeem > 0 && voucher?.allowPoints === false) {
    throw new CheckoutBusinessTotalsError('voucher_points_conflict');
  }
  if (pointsToRedeem > (availablePoints ?? 0)) {
    throw new CheckoutBusinessTotalsError('insufficient_points');
  }

  const freeShipping = isFreeShippingEligible(
    subtotal,
    threshold,
    voucher?.freeShipping ? 'free_shipping' : null,
  );
  const shippingCost = freeShipping ? 0 : quotedShippingCost;
  const dueBeforePoints = subtotal - discountAmount + shippingCost;
  if (!Number.isSafeInteger(dueBeforePoints)) {
    throw new CheckoutBusinessTotalsError('invalid_amount');
  }

  // The legacy calculateRedeemAmount() caps the Rupiah discount, but not
  // points charged. Reject over-redemption instead of silently burning points.
  const requestedDiscount = pointsToRedeem * POINTS_REDEEM_VALUE;
  if (!Number.isSafeInteger(requestedDiscount) ||
      requestedDiscount > dueBeforePoints) {
    throw new CheckoutBusinessTotalsError('excess_points');
  }
  const pointsDiscountAmount = calculateRedeemAmount(pointsToRedeem, dueBeforePoints);
  const total = dueBeforePoints - pointsDiscountAmount;
  if (!Number.isSafeInteger(total)) {
    throw new CheckoutBusinessTotalsError('invalid_amount');
  }
  if (total <= 0) {
    throw new CheckoutBusinessTotalsError('zero_total');
  }

  return {
    subtotal, discountAmount, freeShipping, shippingCost,
    pointsRedeemed: pointsToRedeem, pointsDiscountAmount, total,
  };
}
