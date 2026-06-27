import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelectReturn = vi.fn();
const mockInsertReturn = vi.fn();
const mockUpdateReturn = vi.fn();
const mockDeleteReturn = vi.fn();

const mockChain = (returnFn = mockSelectReturn) => {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any) => resolve(returnFn());
  chain.catch = () => chain;
  return chain;
};

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => mockChain()),
    insert: vi.fn(() => mockChain(mockInsertReturn)),
    update: vi.fn(() => mockChain(mockUpdateReturn)),
    delete: vi.fn(() => mockChain(mockDeleteReturn)),
  },
}));

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
  createCourier,
  updateCourier,
  deleteCourier,
  getCouriers,
  getActiveCouriers,
} from '@/app/actions/couriers';

describe('Courier Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
    mockInsertReturn.mockReturnValue([{ insertId: 1 }]);
  });

  describe('createCourier', () => {
    it('requires admin role', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce({
        user: { id: '2', name: 'John', role: 'customer' },
      });
      const fd = new FormData();
      fd.set('name', 'JNE');
      fd.set('code', 'jne');
      const result = await createCourier(fd);
      expect(result.success).toBe(false);
    });

    it('validates required fields', async () => {
      const fd = new FormData();
      fd.set('name', '');
      fd.set('code', '');
      const result = await createCourier(fd);
      expect(result.success).toBe(false);
      expect(result.errors?.name).toBeDefined();
    });

    it('succeeds with valid data', async () => {
      const fd = new FormData();
      fd.set('name', 'JNE');
      fd.set('code', 'jne');
      const result = await createCourier(fd);
      expect(result.success).toBe(true);
    });
  });

  describe('updateCourier', () => {
    it('succeeds with valid data', async () => {
      const fd = new FormData();
      fd.set('id', '1');
      fd.set('name', 'JNE Express');
      fd.set('code', 'jne');
      fd.set('isActive', 'on');
      const result = await updateCourier(fd);
      expect(result.success).toBe(true);
    });
  });

  describe('deleteCourier', () => {
    it('deletes courier and returns success', async () => {
      const result = await deleteCourier(1);
      expect(result.success).toBe(true);
    });
  });

  describe('getCouriers', () => {
    it('returns all couriers', async () => {
      mockSelectReturn.mockReturnValue([
        { id: 1, name: 'JNE', code: 'jne', isActive: true },
        { id: 2, name: 'J&T', code: 'jnt', isActive: false },
      ]);
      const result = await getCouriers();
      expect(result).toHaveLength(2);
    });
  });

  describe('getActiveCouriers', () => {
    it('returns only active couriers', async () => {
      mockSelectReturn.mockReturnValue([
        { id: 1, name: 'JNE', code: 'jne', isActive: true },
      ]);
      const result = await getActiveCouriers();
      expect(result).toHaveLength(1);
    });
  });
});
