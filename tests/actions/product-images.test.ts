import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAuth, mockFindImage, mockVariantRows, mockUpdate } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindImage: vi.fn(),
  mockVariantRows: vi.fn(),
  mockUpdate: vi.fn(),
}));

function queryChain(rows: () => unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (value: unknown) => unknown) => resolve(rows());
  return chain;
}

vi.mock('@/lib/auth', () => ({ auth: mockAuth }));
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      productImages: { findFirst: (...args: unknown[]) => mockFindImage(...args) },
      products: { findFirst: vi.fn() },
    },
    select: vi.fn(() => queryChain(mockVariantRows)),
    update: vi.fn(() => {
      const chain = queryChain(() => undefined);
      chain.set = vi.fn((values: unknown) => {
        mockUpdate(values);
        return chain;
      });
      return chain;
    }),
  },
}));
vi.mock('@/lib/storage', () => ({ storage: {}, generateObjectKey: vi.fn() }));
vi.mock('@/lib/image-processor', () => ({ processProductImage: vi.fn(), detectMimeFromBuffer: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { updateImageVariant } from '@/app/actions/product-images';

describe('product image variant assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: '1', role: 'admin' } });
    mockFindImage.mockResolvedValue({ id: 5, productId: 10 });
  });

  it('rejects a variant that does not belong to the image product', async () => {
    mockVariantRows.mockReturnValue([]);

    await expect(updateImageVariant(5, 99)).resolves.toEqual({
      success: false,
      error: 'Varian tidak ditemukan pada produk ini atau sudah nonaktif',
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('stores an exact variant relation and clears the legacy color tag', async () => {
    mockVariantRows.mockReturnValue([{ id: 21 }]);

    await expect(updateImageVariant(5, 21)).resolves.toEqual({ success: true, variantId: 21 });
    expect(mockUpdate).toHaveBeenCalledWith({ variantId: 21, variantColor: null });
  });
});
