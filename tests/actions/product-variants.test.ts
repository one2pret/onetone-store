import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
const mockSelect = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => {
      const chain: any = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: (value: unknown) => unknown) => resolve(mockSelect());
      return chain;
    }),
    selectDistinct: vi.fn(() => {
      const chain: any = {};
      chain.from = vi.fn().mockReturnValue(chain);
      chain.innerJoin = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: (value: unknown) => unknown) => resolve(mockSelect());
      return chain;
    }),
    update: vi.fn(() => {
      const chain: any = {};
      chain.set = vi.fn().mockReturnValue(chain);
      chain.where = vi.fn().mockReturnValue(chain);
      chain.then = (resolve: (value: unknown) => unknown) => {
        mockUpdate();
        return resolve(undefined);
      };
      return chain;
    }),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  getVariantIdsUsedInCarts,
  getVariantIdsUsedInOrders,
  updateVariantStock,
  upsertProductVariants,
} from '@/app/actions/product-variants';

describe.each([
  ['anonymous', null],
  ['customer', { user: { id: '2', role: 'customer' } }],
])('product variant authorization: %s', (_label, session) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(session);
  });

  it('blocks variant upsert', async () => {
    await expect(upsertProductVariants(1, [])).resolves.toEqual({
      success: false,
      error: 'Unauthorized',
    });
  });

  it('blocks stock updates', async () => {
    await expect(updateVariantStock(1, 10)).resolves.toEqual({
      success: false,
      error: 'Unauthorized',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('does not expose order or cart usage references', async () => {
    await expect(getVariantIdsUsedInOrders(1)).resolves.toEqual([]);
    await expect(getVariantIdsUsedInCarts(1)).resolves.toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });
});
