import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelectReturn = vi.fn();
const mockInsertReturn = vi.fn();
const mockUpdateReturn = vi.fn();
const mockDeleteReturn = vi.fn();

const mockChain = (returnFn = mockSelectReturn) => {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.$dynamic = vi.fn().mockReturnValue(chain);
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

// Default: customer session
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: '2', name: 'John', email: 'john@example.com', role: 'customer' },
    })
  ),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getUserAddresses,
  getAddress,
} from '@/app/actions/addresses';

function makeAddressFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    recipientName: 'John Doe',
    phone: '081234567890',
    address: 'Jl. Contoh No. 123, Jakarta Selatan',
    detail: 'Blok A2 No. 5',
    province: 'DKI Jakarta',
    city: 'Jakarta Selatan',
    district: 'Kebayoran Baru',
    postalCode: '12120',
    latitude: '-6.2088',
    longitude: '106.8456',
    label: 'Rumah',
  };
  for (const [key, value] of Object.entries({ ...defaults, ...overrides })) {
    fd.set(key, value);
  }
  return fd;
}

describe('Address Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
    mockInsertReturn.mockReturnValue([{ insertId: 1 }]);
    mockUpdateReturn.mockReturnValue(undefined);
    mockDeleteReturn.mockReturnValue(undefined);
  });

  describe('createAddress', () => {
    it('validates required recipientName', async () => {
      const fd = makeAddressFormData({ recipientName: '' });
      const result = await createAddress(fd);
      expect(result.success).toBe(false);
      expect(result.errors?.recipientName).toBeDefined();
    });

    it('validates phone min length', async () => {
      const fd = makeAddressFormData({ phone: '0812' });
      const result = await createAddress(fd);
      expect(result.success).toBe(false);
      expect(result.errors?.phone).toBeDefined();
    });

    it('validates address min length', async () => {
      const fd = makeAddressFormData({ address: 'short' });
      const result = await createAddress(fd);
      expect(result.success).toBe(false);
      expect(result.errors?.address).toBeDefined();
    });

    it('succeeds with valid data', async () => {
      const fd = makeAddressFormData();
      const result = await createAddress(fd);
      expect(result.success).toBe(true);
    });

    it('requires authentication', async () => {
      const { auth } = await import('@/lib/auth');
      (auth as any).mockResolvedValueOnce(null);

      const fd = makeAddressFormData();
      const result = await createAddress(fd);
      expect(result.success).toBe(false);
      expect(result.error).toContain('login');
    });
  });

  describe('updateAddress', () => {
    it('validates required fields', async () => {
      const fd = makeAddressFormData({ recipientName: '' });
      fd.set('id', '1');
      const result = await updateAddress(fd);
      expect(result.success).toBe(false);
    });

    it('succeeds with valid data and own address', async () => {
      // Mock finding the address belonging to user 2
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2 }]);
      const fd = makeAddressFormData();
      fd.set('id', '1');
      const result = await updateAddress(fd);
      expect(result.success).toBe(true);
    });

    it('blocks updating other user address', async () => {
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 999 }]);
      const fd = makeAddressFormData();
      fd.set('id', '1');
      const result = await updateAddress(fd);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('deleteAddress', () => {
    it('deletes own address', async () => {
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2 }]);
      const result = await deleteAddress(1);
      expect(result.success).toBe(true);
    });

    it('blocks deleting other user address', async () => {
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 999 }]);
      const result = await deleteAddress(1);
      expect(result.success).toBe(false);
    });
  });

  describe('setDefaultAddress', () => {
    it('sets default and unsets others', async () => {
      mockSelectReturn.mockReturnValueOnce([{ id: 1, userId: 2 }]);
      const result = await setDefaultAddress(1);
      expect(result.success).toBe(true);
    });
  });

  describe('getUserAddresses', () => {
    it('returns addresses for current user', async () => {
      mockSelectReturn.mockReturnValue([
        { id: 1, userId: 2, recipientName: 'John', isDefault: true },
        { id: 2, userId: 2, recipientName: 'John Office', isDefault: false },
      ]);
      const result = await getUserAddresses();
      expect(result).toHaveLength(2);
    });
  });

  describe('getAddress', () => {
    it('returns own address', async () => {
      mockSelectReturn.mockReturnValue([{ id: 1, userId: 2, recipientName: 'John' }]);
      const result = await getAddress(1);
      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
    });

    it('returns null for other user address', async () => {
      mockSelectReturn.mockReturnValue([{ id: 1, userId: 999, recipientName: 'Other' }]);
      const result = await getAddress(1);
      expect(result).toBeNull();
    });
  });
});
