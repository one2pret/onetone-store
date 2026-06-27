import { describe, it, expect } from 'vitest';
import {
  ORDER_STATUSES,
  VALID_TRANSITIONS,
  validateStatusTransition,
  getNextStatuses,
} from '@/lib/order-status';

describe('Order Status Helper', () => {
  describe('ORDER_STATUSES', () => {
    it('contains all 6 statuses', () => {
      expect(ORDER_STATUSES).toEqual([
        'waiting_payment',
        'packing',
        'shipping',
        'delivered',
        'expired',
        'cancelled',
      ]);
    });
  });

  describe('validateStatusTransition', () => {
    it('allows waiting_payment -> packing', () => {
      expect(validateStatusTransition('waiting_payment', 'packing')).toBe(true);
    });

    it('allows waiting_payment -> expired', () => {
      expect(validateStatusTransition('waiting_payment', 'expired')).toBe(true);
    });

    it('allows waiting_payment -> cancelled', () => {
      expect(validateStatusTransition('waiting_payment', 'cancelled')).toBe(true);
    });

    it('allows packing -> shipping', () => {
      expect(validateStatusTransition('packing', 'shipping')).toBe(true);
    });

    it('allows packing -> cancelled', () => {
      expect(validateStatusTransition('packing', 'cancelled')).toBe(true);
    });

    it('allows shipping -> delivered', () => {
      expect(validateStatusTransition('shipping', 'delivered')).toBe(true);
    });

    it('allows shipping -> cancelled', () => {
      expect(validateStatusTransition('shipping', 'cancelled')).toBe(true);
    });

    it('allows expired -> waiting_payment (repayment)', () => {
      expect(validateStatusTransition('expired', 'waiting_payment')).toBe(true);
    });

    it('blocks delivered -> any (terminal)', () => {
      expect(validateStatusTransition('delivered', 'cancelled')).toBe(false);
      expect(validateStatusTransition('delivered', 'shipping')).toBe(false);
      expect(validateStatusTransition('delivered', 'waiting_payment')).toBe(false);
    });

    it('blocks cancelled -> any (terminal)', () => {
      expect(validateStatusTransition('cancelled', 'waiting_payment')).toBe(false);
      expect(validateStatusTransition('cancelled', 'packing')).toBe(false);
    });

    it('blocks invalid transitions', () => {
      expect(validateStatusTransition('waiting_payment', 'delivered')).toBe(false);
      expect(validateStatusTransition('waiting_payment', 'shipping')).toBe(false);
      expect(validateStatusTransition('packing', 'waiting_payment')).toBe(false);
      expect(validateStatusTransition('shipping', 'packing')).toBe(false);
    });

    it('blocks same status transition', () => {
      expect(validateStatusTransition('packing', 'packing')).toBe(false);
    });
  });

  describe('getNextStatuses', () => {
    it('returns valid next statuses for waiting_payment', () => {
      expect(getNextStatuses('waiting_payment')).toEqual(['packing', 'expired', 'cancelled']);
    });

    it('returns valid next statuses for packing', () => {
      expect(getNextStatuses('packing')).toEqual(['shipping', 'cancelled']);
    });

    it('returns valid next statuses for shipping', () => {
      expect(getNextStatuses('shipping')).toEqual(['delivered', 'cancelled']);
    });

    it('returns valid next statuses for expired', () => {
      expect(getNextStatuses('expired')).toEqual(['waiting_payment']);
    });

    it('returns empty array for terminal statuses', () => {
      expect(getNextStatuses('delivered')).toEqual([]);
      expect(getNextStatuses('cancelled')).toEqual([]);
    });
  });
});
