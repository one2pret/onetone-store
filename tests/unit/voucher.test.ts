import { describe, it, expect } from 'vitest';
import { calculateDiscount } from '@/lib/membership-utils';

describe('calculateDiscount', () => {
  describe('type: fixed', () => {
    it('diskon tetap kurang dari subtotal', () => {
      expect(calculateDiscount('fixed', 50_000, 500_000)).toBe(50_000);
    });

    it('diskon tidak melebihi subtotal', () => {
      expect(calculateDiscount('fixed', 100_000, 30_000)).toBe(30_000);
    });

    it('diskon tepat sama dengan subtotal', () => {
      expect(calculateDiscount('fixed', 200_000, 200_000)).toBe(200_000);
    });
  });

  describe('type: percent', () => {
    it('diskon 10% dari 500.000 = 50.000', () => {
      expect(calculateDiscount('percent', 10, 500_000)).toBe(50_000);
    });

    it('diskon 15% dari 1.000.000 = 150.000', () => {
      expect(calculateDiscount('percent', 15, 1_000_000)).toBe(150_000);
    });

    it('diskon 20% dari 250.000 = 50.000', () => {
      expect(calculateDiscount('percent', 20, 250_000)).toBe(50_000);
    });

    it('diskon 100% tidak melebihi subtotal', () => {
      expect(calculateDiscount('percent', 100, 500_000)).toBe(500_000);
    });

    it('diskon 0% = 0', () => {
      expect(calculateDiscount('percent', 0, 500_000)).toBe(0);
    });
  });

  describe('type: free_shipping', () => {
    it('free_shipping tidak mengurangi subtotal (return 0)', () => {
      expect(calculateDiscount('free_shipping', 0, 500_000)).toBe(0);
    });
  });
});
