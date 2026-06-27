import { describe, it, expect, vi, beforeEach } from 'vitest';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Mock db before importing actions
const mockSelectReturn = vi.fn();
const mockInsertReturn = vi.fn();
const mockUpdateReturn = vi.fn();
const mockDeleteReturn = vi.fn();

const mockChain = () => {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.values = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any) => resolve(mockSelectReturn());
  chain.catch = () => chain;
  return chain;
};

const mockInsertChain = () => {
  const chain: any = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any) => resolve(mockInsertReturn());
  chain.catch = () => chain;
  return chain;
};

const mockUpdateChain = () => {
  const chain: any = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any) => resolve(mockUpdateReturn());
  chain.catch = () => chain;
  return chain;
};

const mockDeleteChain = () => {
  const chain: any = {};
  chain.where = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: any) => resolve(mockDeleteReturn());
  chain.catch = () => chain;
  return chain;
};

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(() => mockChain()),
    insert: vi.fn(() => mockInsertChain()),
    update: vi.fn(() => mockUpdateChain()),
    delete: vi.fn(() => mockDeleteChain()),
  },
}));

import {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategory,
  getAllCategories,
} from '@/app/actions/categories';

describe('Category Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn.mockReturnValue([]);
    mockInsertReturn.mockReturnValue([{ insertId: 1 }]);
    mockUpdateReturn.mockReturnValue(undefined);
    mockDeleteReturn.mockReturnValue(undefined);
  });

  describe('createCategory', () => {
    it('validates required fields', async () => {
      const formData = new FormData();
      formData.set('name', '');

      const result = await createCategory({}, formData);

      expect(result.success).toBe(false);
      expect(result.errors?.name).toBeDefined();
    });

    it('generates slug from name', async () => {
      const formData = new FormData();
      formData.set('name', 'Makanan & Minuman');
      formData.set('description', 'Kategori makanan dan minuman');

      try {
        await createCategory({}, formData);
      } catch (e: any) {
        // redirect throws
        expect(e.message).toContain('NEXT_REDIRECT');
      }

      expect(revalidatePath).toHaveBeenCalled();
    });

    it('inserts into db and redirects', async () => {
      const { db } = await import('@/lib/db');
      const formData = new FormData();
      formData.set('name', 'Elektronik');
      formData.set('description', 'Produk elektronik');

      try {
        await createCategory({}, formData);
      } catch (e: any) {
        expect(e.message).toContain('NEXT_REDIRECT');
      }

      expect(db.insert).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/categories');
    });
  });

  describe('updateCategory', () => {
    it('validates required fields', async () => {
      const formData = new FormData();
      formData.set('name', '');

      const result = await updateCategory(1, {}, formData);

      expect(result.success).toBe(false);
      expect(result.errors?.name).toBeDefined();
    });

    it('updates db and redirects', async () => {
      const { db } = await import('@/lib/db');
      const formData = new FormData();
      formData.set('name', 'Updated Name');
      formData.set('description', 'Updated desc');

      try {
        await updateCategory(1, {}, formData);
      } catch (e: any) {
        expect(e.message).toContain('NEXT_REDIRECT');
      }

      expect(db.update).toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalled();
    });
  });

  describe('deleteCategory', () => {
    it('deletes category and returns success', async () => {
      // Mock: no products in category
      mockSelectReturn.mockReturnValue([]);

      const result = await deleteCategory(1);

      expect(result.success).toBe(true);
    });

    it('prevents deletion if category has products', async () => {
      // Mock: category has products
      mockSelectReturn.mockReturnValue([{ id: 1 }]);

      const result = await deleteCategory(1);

      expect(result.success).toBe(false);
      expect(result.error).toContain('produk');
    });
  });

  describe('getCategory', () => {
    it('returns category by id', async () => {
      const mockCategory = {
        id: 1,
        name: 'Elektronik',
        slug: 'elektronik',
        description: 'Produk elektronik',
        image: null,
        createdAt: new Date(),
      };
      mockSelectReturn.mockReturnValue([mockCategory]);

      const result = await getCategory(1);

      expect(result).toEqual(mockCategory);
    });

    it('returns null for nonexistent category', async () => {
      mockSelectReturn.mockReturnValue([]);

      const result = await getCategory(999);

      expect(result).toBeNull();
    });
  });

  describe('getAllCategories', () => {
    it('returns all categories', async () => {
      const mockCategories = [
        { id: 1, name: 'Elektronik', slug: 'elektronik', description: null, image: null, createdAt: new Date() },
        { id: 2, name: 'Fashion', slug: 'fashion', description: null, image: null, createdAt: new Date() },
      ];
      mockSelectReturn.mockReturnValue(mockCategories);

      const result = await getAllCategories();

      expect(result).toHaveLength(2);
    });
  });
});
