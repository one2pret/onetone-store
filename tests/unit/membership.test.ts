import { describe, it, expect } from 'vitest';
import {
  calculatePointsEarned,
  isFreeShippingEligible,
} from '@/lib/membership-utils';

describe('calculatePointsEarned', () => {
  it('1 poin per Rp10.000 dengan multiplier 1', () => {
    expect(calculatePointsEarned(500_000, 1)).toBe(50);
  });

  it('multiplier 2 mengalikan poin', () => {
    expect(calculatePointsEarned(500_000, 2)).toBe(100);
  });

  it('multiplier 3 (Platinum)', () => {
    // 23_336_000 / 10_000 = 2333.6 → Math.round → 2334 → * 3 = 7002
    expect(calculatePointsEarned(23_336_000, 3)).toBe(7002);
  });

  it('subtotal kecil dibulatkan ke atas', () => {
    // 5_000 / 10_000 = 0.5 → Math.round → 1
    expect(calculatePointsEarned(5_000, 1)).toBe(1);
  });

  it('multiplier 0 fallback ke 1', () => {
    expect(calculatePointsEarned(100_000, 0)).toBe(10);
  });

  it('dibulatkan ke bawah', () => {
    // 15.000 / 10.000 = 1.5 → Math.round → 2
    expect(calculatePointsEarned(15_000, 1)).toBe(2);
  });
});

describe('isFreeShippingEligible', () => {
  it('voucher free_shipping selalu gratis', () => {
    expect(isFreeShippingEligible(50_000, null, 'free_shipping')).toBe(true);
  });

  it('threshold 0 (Platinum) selalu gratis', () => {
    expect(isFreeShippingEligible(1_000, 0, null)).toBe(true);
  });

  it('subtotal memenuhi threshold', () => {
    expect(isFreeShippingEligible(300_000, 200_000, null)).toBe(true);
  });

  it('subtotal tepat di threshold', () => {
    expect(isFreeShippingEligible(200_000, 200_000, null)).toBe(true);
  });

  it('subtotal di bawah threshold — tidak gratis', () => {
    expect(isFreeShippingEligible(100_000, 200_000, null)).toBe(false);
  });

  it('tidak ada tier dan tidak ada voucher — tidak gratis', () => {
    expect(isFreeShippingEligible(999_999, null, null)).toBe(false);
  });

  it('voucher type lain tidak memberikan free shipping', () => {
    expect(isFreeShippingEligible(500_000, null, 'percent')).toBe(false);
  });
});
