// app/(admin)/dashboard/banners/_components/BannerForm.tsx
'use client';

import { useActionState } from 'react';
import { createBanner, updateBanner } from '@/app/actions/banners';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Banner } from '@/lib/db/schema';
import Image from 'next/image';
import { useState } from 'react';

interface BannerFormProps {
  banner?: Banner | null;
}

export function BannerForm({ banner }: BannerFormProps) {
  const action = banner
    ? ((_prev: any, formData: FormData) => updateBanner(banner.id, formData))
    : createBanner;

  const [state, formAction, isPending] = useActionState(action as any, null);
  const [imagePreview, setImagePreview] = useState(banner?.image || '');

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {(state as any)?.errors?._form && (
        <p className="text-red-500 text-sm p-3 bg-red-50 rounded-lg border border-red-100">
          {(state as any).errors._form[0]}
        </p>
      )}

      <div>
        <Label htmlFor="title">Judul Banner *</Label>
        <Input
          id="title"
          name="title"
          defaultValue={banner?.title}
          required
          className="mt-1"
          placeholder="contoh: Flash Sale Akhir Tahun"
        />
      </div>

      <div>
        <Label htmlFor="subtitle">Subtitle</Label>
        <Textarea
          id="subtitle"
          name="subtitle"
          defaultValue={banner?.subtitle || ''}
          className="mt-1"
          placeholder="Deskripsi singkat banner"
          rows={2}
        />
      </div>

      <div>
        <Label htmlFor="image">URL Gambar *</Label>
        <Input
          id="image"
          name="image"
          defaultValue={banner?.image}
          required
          className="mt-1"
          placeholder="https://images.unsplash.com/..."
          onChange={(e) => setImagePreview(e.target.value)}
        />
        {imagePreview && (
          <div className="mt-3 relative aspect-[3/1] rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
            <Image
              src={imagePreview}
              alt="Preview"
              fill
              className="object-cover"
              onError={() => setImagePreview('')}
            />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="link">Link (opsional)</Label>
        <Input
          id="link"
          name="link"
          defaultValue={banner?.link || ''}
          className="mt-1"
          placeholder="/products atau https://..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sortOrder">Urutan</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={banner?.sortOrder ?? 0}
            className="mt-1"
          />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={banner?.isActive ?? true}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-slate-700">Aktif</span>
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary-hover">
          {isPending ? 'Menyimpan...' : banner ? 'Update Banner' : 'Buat Banner'}
        </Button>
      </div>
    </form>
  );
}
