import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelectReturn = vi.fn();
const mockInsertReturn = vi.fn();
const mockUpdateReturn = vi.fn();

const mockChain = (returnFn = mockSelectReturn) => {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.onDuplicateKeyUpdate = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any) => resolve(returnFn());
  chain.catch = () => chain;
  return chain;
};

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => mockChain()),
    insert: vi.fn(() => mockChain(mockInsertReturn)),
    update: vi.fn(() => mockChain(mockUpdateReturn)),
  },
}));

// Admin session by default
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: '1', name: 'Admin', email: 'admin@store.com', role: 'admin' },
    })
  ),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  getStoreSetting,
  getStoreSettings,
  upsertStoreSetting,
} from '@/app/actions/store-settings';

describe('Store Settings Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
    mockInsertReturn.mockReturnValue([{ insertId: 1 }]);
  });

  describe('getStoreSetting', () => {
    it('returns value for existing key', async () => {
      mockSelectReturn.mockReturnValue([{ id: 1, key: 'store_name', value: 'Toko Saya' }]);
      const result = await getStoreSetting('store_name');
      expect(result).toBe('Toko Saya');
    });

    it('returns null for nonexistent key', async () => {
      mockSelectReturn.mockReturnValue([]);
      const result = await getStoreSetting('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getStoreSettings', () => {
    it('returns all settings as key-value object', async () => {
      mockSelectReturn.mockReturnValue([
        { id: 1, key: 'store_name', value: 'Toko Saya' },
        { id: 2, key: 'store_phone', value: '08123456789' },
      ]);
      const result = await getStoreSettings();
      expect(result).toEqual({
        store_name: 'Toko Saya',
        store_phone: '08123456789',
      });
    });
  });

  describe('upsertStoreSetting', () => {
    it('requires admin role', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '2', name: 'John', role: 'customer' },
      });

      const result = await upsertStoreSetting('store_name', 'Test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('admin');
    });

    it('inserts new setting', async () => {
      mockSelectReturn.mockReturnValueOnce([]); // not found
      const result = await upsertStoreSetting('store_name', 'Toko Saya');
      expect(result.success).toBe(true);
    });

    it('updates existing setting', async () => {
      mockSelectReturn.mockReturnValueOnce([{ id: 1, key: 'store_name', value: 'Old' }]);
      const result = await upsertStoreSetting('store_name', 'New Name');
      expect(result.success).toBe(true);
    });
  });
});
