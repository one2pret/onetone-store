// app/(admin)/products/_components/ProductForm.tsx
'use client';

import { useActionState } from 'react';
import { createProduct, updateProduct } from '@/app/actions/products';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/ui/currency-input';
import type { Product, Category } from '@/lib/db/schema';

interface Props {
  product?: Product | null;
  categories: Category[];
}

type ActionState = {
  success: boolean;
  errors?: Record<string, string[]>;
} | null;

export function ProductForm({ product, categories }: Props) {
  const action = product
    ? (formData: FormData) => updateProduct(product.id, formData)
    : createProduct;

  const [state, formAction, pending] = useActionState(
    async (_prev: any, formData: FormData) => {
      return await action(formData);
    },
    null
  ) as [ActionState, any, boolean];

  return (
    <form action={formAction} className="space-y-6">
      {state?.errors?._form && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {state.errors._form[0]}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Informasi Produk</h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">
              Nama Produk <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              defaultValue={product?.name}
              required
              className="mt-1"
            />
            {state?.errors?.name && (
              <p className="text-red-500 text-sm mt-1">{state.errors.name[0]}</p>
            )}
          </div>

          <div>
            <Label htmlFor="categoryId">Kategori</Label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={product?.categoryId ?? ''}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            >
              <option value="">Pilih kategori...</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={product?.description || ''}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Harga & Stok</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="price">
              Harga (Rp) <span className="text-red-500">*</span>
            </Label>
            <CurrencyInput
              id="price"
              name="price"
              defaultValue={product?.price ? Number(product.price) : ''}
              required
              className="mt-1"
            />
            {state?.errors?.price && (
              <p className="text-red-500 text-sm mt-1">{state.errors.price[0]}</p>
            )}
          </div>

          <div>
            <Label htmlFor="stock">
              Stok <span className="text-red-500">*</span>
            </Label>
            <Input
              id="stock"
              name="stock"
              type="number"
              min="0"
              defaultValue={product?.stock ?? 0}
              required
              className="mt-1"
            />
            {state?.errors?.stock && (
              <p className="text-red-500 text-sm mt-1">{state.errors.stock[0]}</p>
            )}
          </div>

          <div>
            <Label htmlFor="weight">Berat (gram)</Label>
            <Input
              id="weight"
              name="weight"
              type="number"
              min="0"
              defaultValue={product?.weight ?? 0}
              className="mt-1"
            />
            {state?.errors?.weight && (
              <p className="text-red-500 text-sm mt-1">{state.errors.weight[0]}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Pengaturan</h2>

        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={product?.isActive ?? true}
              className="w-4 h-4 text-primary rounded"
            />
            <span className="text-sm text-slate-700">Produk aktif (tampil di toko)</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="isFeatured"
              defaultChecked={product?.isFeatured ?? false}
              className="w-4 h-4 text-primary rounded"
            />
            <span className="text-sm text-slate-700">Produk unggulan (tampil di halaman utama)</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending
            ? 'Menyimpan...'
            : product
              ? 'Update Produk'
              : 'Tambah Produk'}
        </Button>
        <Button variant="ghost" asChild>
          <a href="/dashboard/products">Batal</a>
        </Button>
      </div>
    </form>
  );
}
