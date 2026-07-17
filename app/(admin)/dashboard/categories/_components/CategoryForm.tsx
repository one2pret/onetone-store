// app/(admin)/dashboard/categories/_components/CategoryForm.tsx
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

  const [state, formAction, pending] = useActionState(
    action as (state: ActionState, formData: FormData) => Promise<ActionState>,
    null
  );

  return (
    <form action={formAction} className="space-y-6">
      {state?.errors?._form && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm">
          {state.errors._form[0]}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-foreground">
              Nama Kategori <span className="text-destructive">*</span>
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
              <p className="text-destructive text-sm mt-1">{state.errors.name[0]}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description" className="text-foreground">Deskripsi</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={category?.description || ''}
              className="mt-1"
              placeholder="Deskripsi singkat kategori..."
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex-1">
              <Label htmlFor="sort_order" className="text-foreground">Urutan</Label>
              <Input
                id="sort_order"
                name="sort_order"
                type="number"
                min={0}
                defaultValue={category?.sortOrder ?? 0}
                className="mt-1 w-28"
              />
              <p className="text-xs text-muted-foreground mt-1">Angka kecil tampil lebih dulu</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="is_visible" className="text-foreground">Tampilkan</Label>
              <input
                id="is_visible"
                name="is_visible"
                type="checkbox"
                defaultChecked={category?.isVisible ?? true}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
              <p className="text-xs text-muted-foreground">Kategori terlihat di toko</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? 'Menyimpan...' : category ? 'Update Kategori' : 'Tambah Kategori'}
        </Button>
        <Button variant="ghost" asChild>
          <a href="/dashboard/categories">Batal</a>
        </Button>
      </div>
    </form>
  );
}
