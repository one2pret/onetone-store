import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelectReturn = vi.fn();
const mockUpdateReturn = vi.fn();
const mockInsertReturn = vi.fn();

const mockChain = (returnFn = mockSelectReturn) => {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any) => resolve(returnFn());
  chain.catch = () => chain;
  return chain;
};

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => mockChain()),
    update: vi.fn(() => mockChain(mockUpdateReturn)),
    insert: vi.fn(() => mockChain(mockInsertReturn)),
  },
}));

import { deductStock, restoreStock, validateStock } from '@/lib/stock';
import { db } from '@/lib/db';

describe('Stock Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
    mockUpdateReturn.mockReturnValue(undefined);
    mockInsertReturn.mockReturnValue(undefined);
  });

  describe('deductStock', () => {
    it('deducts stock for multiple items', async () => {
      mockSelectReturn
        .mockReturnValueOnce([{ id: 10 }])
        .mockReturnValueOnce([{ id: 101, quantity: 10, reserved: 0 }])
        .mockReturnValueOnce([{ id: 10 }])
        .mockReturnValueOnce([{ id: 102, quantity: 10, reserved: 0 }]);
      await deductStock([
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 3 },
      ]);

      expect(db.update).toHaveBeenCalledTimes(4);
    });

    it('does nothing for empty items', async () => {
      await deductStock([]);
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('restoreStock', () => {
    it('restores stock from order items', async () => {
      mockSelectReturn
        .mockReturnValueOnce([{ productId: 1, quantity: 2 }, { productId: 3, quantity: 1 }])
        .mockReturnValueOnce([{ id: 10 }])
        .mockReturnValueOnce([{ id: 101, quantity: 8, reserved: 0 }])
        .mockReturnValueOnce([{ id: 10 }])
        .mockReturnValueOnce([{ id: 103, quantity: 9, reserved: 0 }]);

      await restoreStock(1);

      expect(db.select).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalledTimes(4);
    });

    it('does nothing when order has no items', async () => {
      mockSelectReturn.mockReturnValue([]);

      await restoreStock(999);

      expect(db.select).toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('validateStock', () => {
    it('returns valid for sufficient stock', async () => {
      mockSelectReturn
        .mockReturnValueOnce([{ id: 1, stock: 50, isActive: true }])
        .mockReturnValueOnce([{ id: 2, stock: 30, isActive: true }]);

      const result = await validateStock([
        { productId: 1, quantity: 2, productName: 'Earbuds' },
        { productId: 2, quantity: 5, productName: 'Watch' },
      ]);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('returns invalid for insufficient stock', async () => {
      mockSelectReturn
        .mockReturnValueOnce([{ id: 1, stock: 1, isActive: true }])
        .mockReturnValueOnce([{ id: 2, stock: 0, isActive: true }]);

      const result = await validateStock([
        { productId: 1, quantity: 5, productName: 'Earbuds' },
        { productId: 2, quantity: 1, productName: 'Watch' },
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Earbuds');
      expect(result.errors[1]).toContain('Watch');
    });

    it('returns invalid for zero stock', async () => {
      mockSelectReturn.mockReturnValueOnce([{ id: 1, stock: 0, isActive: true }]);

      const result = await validateStock([
        { productId: 1, quantity: 1, productName: 'Earbuds' },
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('returns invalid for missing product', async () => {
      mockSelectReturn.mockReturnValueOnce([]);

      const result = await validateStock([
        { productId: 999, quantity: 1, productName: 'Ghost Product' },
      ]);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Ghost Product');
    });

    it('returns valid for empty items', async () => {
      const result = await validateStock([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
