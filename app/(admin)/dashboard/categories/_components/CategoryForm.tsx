// app/(admin)/categories/_components/CategoryForm.tsx
'use client';

import { useActionState } from 'react';
import { createCategory, updateCategory } from '@/app/actions/categories';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { Category } from '@/lib/db/schema';

interface Props {
  category?: Category | null;
}

type ActionState = {
  success: boolean;
  errors?: Record<string, string[]>;
} | null;

export function CategoryForm({ category }: Props) {
  const action = category
    ? updateCategory.bind(null, category.id)
    : createCategory;

  const [state, formAction, pending] = useActionState(action as any, null) as [ActionState, any, boolean];

  return (
    <form action={formAction} className="space-y-6">
      {state?.errors?._form && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {state.errors._form[0]}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 p-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">
              Nama Kategori <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              defaultValue={category?.name}
              required
              className="mt-1"
              placeholder="Contoh: Elektronik"
            />
            {state?.errors?.name && (
              <p className="text-red-500 text-sm mt-1">{state.errors.name[0]}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={category?.description || ''}
              className="mt-1"
              placeholder="Deskripsi singkat kategori..."
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending
            ? 'Menyimpan...'
            : category
              ? 'Update Kategori'
              : 'Tambah Kategori'}
        </Button>
        <Button variant="ghost" asChild>
          <a href="/dashboard/categories">Batal</a>
        </Button>
      </div>
    </form>
  );
}
