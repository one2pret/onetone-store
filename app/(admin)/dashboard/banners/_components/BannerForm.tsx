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

type ActionState = {
  success: boolean;
  errors?: Record<string, string[]>;
} | null;

export function BannerForm({ banner }: BannerFormProps) {
  const action = banner
    ? updateBanner.bind(null, banner.id)
    : createBanner;

  const [state, formAction, isPending] = useActionState(
    action as (state: ActionState, formData: FormData) => Promise<ActionState>,
    null
  );

  const [imagePreview, setImagePreview] = useState(banner?.image || '');
  const [imageError, setImageError] = useState(false);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImageError(false);
    setImagePreview(e.target.value);
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {state?.errors?._form && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg text-sm">
          {state.errors._form[0]}
        </div>
      )}

      <div>
        <Label htmlFor="title" className="text-foreground">
          Judul Banner <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          name="title"
          defaultValue={banner?.title}
          required
          className="mt-1"
          placeholder="Contoh: Koleksi Sportswear Terbaru"
        />
        {state?.errors?.title && (
          <p className="text-destructive text-sm mt-1">{state.errors.title[0]}</p>
        )}
      </div>

      <div>
        <Label htmlFor="subtitle" className="text-foreground">Subtitle</Label>
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
        <Label htmlFor="image" className="text-foreground">
          URL Gambar <span className="text-destructive">*</span>
        </Label>
        <Input
          id="image"
          name="image"
          defaultValue={banner?.image}
          required
          className="mt-1"
          placeholder="https://images.unsplash.com/... atau https://res.cloudinary.com/..."
          onChange={handleImageChange}
        />
        {state?.errors?.image && (
          <p className="text-destructive text-sm mt-1">{state.errors.image[0]}</p>
        )}

        {/* Image preview — hanya tampil jika URL valid & tidak error */}
        {imagePreview && !imageError && (
          <div className="mt-3 relative aspect-[3/1] rounded-xl overflow-hidden border border-border bg-muted">
            <Image
              src={imagePreview}
              alt="Preview banner"
              fill
              className="object-cover"
              onError={() => setImageError(true)}
              unoptimized={imagePreview.startsWith('https://unsplash.com/photos')}
            />
          </div>
        )}
        {imagePreview && imageError && (
          <p className="text-muted-foreground text-xs mt-2">
            ⚠️ Gambar tidak bisa ditampilkan. Pastikan URL valid dan dari domain yang diizinkan
            (images.unsplash.com, res.cloudinary.com).
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="link" className="text-foreground">Link (opsional)</Label>
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
          <Label htmlFor="sortOrder" className="text-foreground">Urutan Tampil</Label>
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
              className="w-4 h-4 accent-primary rounded"
            />
            <span className="text-sm text-foreground">Aktif</span>
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan...' : banner ? 'Update Banner' : 'Buat Banner'}
        </Button>
      </div>
    </form>
  );
}
