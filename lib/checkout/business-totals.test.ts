import { describe, expect, it } from 'vitest';
import {
  calculateCheckoutBusinessTotals, CheckoutBusinessTotalsError,
  type CheckoutBusinessTotalsInput,
  type CheckoutBusinessTotalsErrorCode,
} from './business-totals';

const base: CheckoutBusinessTotalsInput = {
  subtotal: 100_000,
  quotedShippingCost: 9_000,
  voucher: null,
  tierFreeShippingThreshold: null,
  pointsToRedeem: 0,
  availablePoints: null,
};

function rejected(input: CheckoutBusinessTotalsInput, code: CheckoutBusinessTotalsErrorCode) {
  try {
    calculateCheckoutBusinessTotals(input);
    throw new Error('Expected invalid checkout to be rejected');
  } catch (error) {
    expect(error).toBeInstanceOf(CheckoutBusinessTotalsError);
    expect((error as CheckoutBusinessTotalsError).code).toBe(code);
  }
}

describe('shared checkout financial parity contract (pure; no DB/provider)', () => {
  it('preserves the full trusted shipping quote without voucher, tier, or points', () => {
    expect(calculateCheckoutBusinessTotals(base)).toEqual({
      subtotal: 100_000, discountAmount: 0, freeShipping: false,
      shippingCost: 9_000, pointsRedeemed: 0, pointsDiscountAmount: 0, total: 109_000,
    });
  });

  it('computes voucher discount, remaining shipping and points in the legacy ordering', () => {
    expect(calculateCheckoutBusinessTotals({
      ...base,
      voucher: { discountAmount: 15_000, freeShipping: false, allowPoints: true },
      pointsToRedeem: 10, availablePoints: 50,
    })).toEqual({
      subtotal: 100_000, discountAmount: 15_000, freeShipping: false,
      shippingCost: 9_000, pointsRedeemed: 10, pointsDiscountAmount: 1_000, total: 93_000,
    });
  });

  it('free-shipping voucher waives delivery price but does not deduct merchandise subtotal', () => {
    expect(calculateCheckoutBusinessTotals({
      ...base, voucher: { discountAmount: 0, freeShipping: true, allowPoints: true },
    })).toMatchObject({
      subtotal: 100_000, discountAmount: 0, freeShipping: true,
      shippingCost: 0, total: 100_000,
    });
  });

  it.each([0, 80_000])('tier threshold %i provides free shipping', threshold => {
    expect(calculateCheckoutBusinessTotals({
      ...base, tierFreeShippingThreshold: threshold,
    })).toMatchObject({ freeShipping: true, shippingCost: 0, total: 100_000 });
  });

  it('tier threshold above current subtotal does not waive the shipping quote', () => {
    expect(calculateCheckoutBusinessTotals({
      ...base, tierFreeShippingThreshold: 150_000,
    }).shippingCost).toBe(9_000);
  });

  it.each([
    [{ subtotal: -1 }, 'invalid_amount'],
    [{ subtotal: 1.5 }, 'invalid_amount'],
    [{ subtotal: Number.MAX_SAFE_INTEGER + 1 }, 'invalid_amount'],
    [{ subtotal: 0 }, 'invalid_amount'],
    [{ quotedShippingCost: -1 }, 'invalid_amount'],
    [{ quotedShippingCost: Number.NaN }, 'invalid_amount'],
    [{ tierFreeShippingThreshold: -1 }, 'invalid_amount'],
    [{ voucher: { discountAmount: 100_001, freeShipping: false, allowPoints: true } }, 'invalid_voucher'],
    [{ voucher: { discountAmount: -1, freeShipping: false, allowPoints: true } }, 'invalid_voucher'],
    [{ voucher: { discountAmount: 0.5, freeShipping: false, allowPoints: true } }, 'invalid_voucher'],
    [{ pointsToRedeem: -1 }, 'invalid_points'],
    [{ pointsToRedeem: 1.1 }, 'invalid_points'],
    [{ availablePoints: -1 }, 'invalid_points'],
  ] as const)('rejects malformed financial data %j', (override, code) => {
    rejected({ ...base, ...override }, code);
  });

  it('does not redeem points without a membership', () => {
    rejected({ ...base, pointsToRedeem: 1 }, 'membership_required');
  });

  it('does not redeem points with a voucher that disallows stacking', () => {
    rejected({
      ...base, voucher: { discountAmount: 5_000, freeShipping: false, allowPoints: false },
      pointsToRedeem: 1, availablePoints: 10,
    }, 'voucher_points_conflict');
  });

  it('prevents overdrawing a member points balance', () => {
    rejected({ ...base, pointsToRedeem: 11, availablePoints: 10 }, 'insufficient_points');
  });

  it('does not silently consume extra points when the discount would be capped', () => {
    rejected({
      ...base, subtotal: 10_050, quotedShippingCost: 0,
      pointsToRedeem: 101, availablePoints: 200,
    }, 'excess_points');
  });

  it('rejects a zero-value Xendit invoice instead of accepting full point redemption', () => {
    rejected({
      ...base, subtotal: 10_000, quotedShippingCost: 0,
      pointsToRedeem: 100, availablePoints: 100,
    }, 'zero_total');
  });

  it('allows a one-rupiah positive remaining invoice', () => {
    expect(calculateCheckoutBusinessTotals({
      ...base, subtotal: 10_001, quotedShippingCost: 0,
      pointsToRedeem: 100, availablePoints: 100,
    }).total).toBe(1);
  });

  it('rejects arithmetic overflow even when input amounts are safe integers', () => {
    rejected({
      ...base, subtotal: Number.MAX_SAFE_INTEGER,
      quotedShippingCost: 2, pointsToRedeem: 0,
    }, 'invalid_amount');
  });

  it('never mutates the caller-owned voucher and checkout input', () => {
    const input = Object.freeze({
      ...base,
      voucher: Object.freeze({ discountAmount: 100, freeShipping: false, allowPoints: true }),
    });
    calculateCheckoutBusinessTotals(input);
    expect(input.voucher.discountAmount).toBe(100);
    expect(input.quotedShippingCost).toBe(9_000);
  });
});
