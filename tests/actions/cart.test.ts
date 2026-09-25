import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSelectReturn = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

function selectChain() {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (value: unknown) => unknown) => resolve(mockSelectReturn());
  return chain;
}

function mutationChain(callback: ReturnType<typeof vi.fn>) {
  const chain: any = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (value: unknown) => unknown) => {
    callback();
    return resolve(undefined);
  };
  return chain;
}

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: '2', email: 'customer@example.com', role: 'customer' },
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => selectChain()),
    insert: vi.fn(() => mutationChain(mockInsert)),
    update: vi.fn(() => mutationChain(mockUpdate)),
    delete: vi.fn(() => mutationChain(mockDelete)),
  },
}));

import { addToCart, ensureCartItem, removeFromCart, updateCartItem } from '@/app/actions/cart';

const activeProduct = {
  id: 1,
  isActive: true,
  stock: 10,
  price: '3000',
};

describe('cart server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReset();
  });

  it('keeps the existing quantity when buy-now ensures an existing item', async () => {
    mockSelectReturn
      .mockReturnValueOnce([activeProduct])
      .mockReturnValueOnce([{ id: 10, userId: 2, productId: 1, variantId: null, quantity: 1 }]);

    const result = await ensureCartItem(1, 1);

    expect(result).toMatchObject({ success: true, quantity: 1, alreadyInCart: true });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('increments the existing quantity for the regular add-to-cart action', async () => {
    mockSelectReturn
      .mockReturnValueOnce([activeProduct])
      .mockReturnValueOnce([{ id: 10, userId: 2, productId: 1, variantId: null, quantity: 1 }]);

    const result = await addToCart(1, 1);

    expect(result).toMatchObject({ success: true, quantity: 2, alreadyInCart: true });
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it('inserts the selected quantity when buy-now item is not in the cart', async () => {
    mockSelectReturn
      .mockReturnValueOnce([activeProduct])
      .mockReturnValueOnce([]);

    const result = await ensureCartItem(1, 1);

    expect(result).toMatchObject({ success: true, quantity: 1, alreadyInCart: false });
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it('rejects a variant that belongs to another product', async () => {
    mockSelectReturn
      .mockReturnValueOnce([activeProduct])
      .mockReturnValueOnce([{ id: 5, productId: 999, isActive: true, stock: 10 }]);

    const result = await addToCart(1, 1, 5);

    expect(result).toEqual({ success: false, error: 'Varian tidak sesuai dengan produk' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('does not update a cart item that is not owned by the current user', async () => {
    mockSelectReturn.mockReturnValueOnce([]);

    const result = await updateCartItem(99, 2);

    expect(result).toEqual({ success: false, error: 'Item keranjang tidak ditemukan' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('does not remove a cart item that is not owned by the current user', async () => {
    mockSelectReturn.mockReturnValueOnce([]);

    const result = await removeFromCart(99);

    expect(result).toEqual({ success: false, error: 'Item keranjang tidak ditemukan' });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
