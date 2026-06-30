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
import { AlertCircle } from 'lucide-react';

interface BannerFormProps {
  banner?: Banner | null;
}

type ActionState = {
  success: boolean;
  errors?: Record<string, string[]>;
} | null;

// Domain yang terdaftar di next.config.ts remotePatterns
const ALLOWED_HOSTNAMES = [
  'images.unsplash.com',
  'unsplash.com',
  'res.cloudinary.com',
  'lh3.googleusercontent.com',
  'avatars.githubusercontent.com',
  'placehold.co',
];

type UrlStatus = 'empty' | 'invalid_format' | 'blocked_domain' | 'valid';

function checkImageUrl(url: string): UrlStatus {
  if (!url || url.trim() === '') return 'empty';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname) return 'invalid_format';
    if (!ALLOWED_HOSTNAMES.includes(parsed.hostname)) return 'blocked_domain';
    return 'valid';
  } catch {
    return 'invalid_format';
  }
}

export function BannerForm({ banner }: BannerFormProps) {
  const action = banner
    ? updateBanner.bind(null, banner.id)
    : createBanner;

  const [state, formAction, isPending] = useActionState(
    action as (state: ActionState, formData: FormData) => Promise<ActionState>,
    null
  );

  const [imagePreview, setImagePreview] = useState(banner?.image || '');
  const [imageLoadError, setImageLoadError] = useState(false);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImageLoadError(false);
    setImagePreview(e.target.value);
  }

  const urlStatus = checkImageUrl(imagePreview);
  const showPreview = urlStatus === 'valid' && !imageLoadError;

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
          placeholder="https://images.unsplash.com/photo-..."
          onChange={handleImageChange}
        />
        {state?.errors?.image && (
          <p className="text-destructive text-sm mt-1">{state.errors.image[0]}</p>
        )}

        {/* Panduan domain yang diizinkan */}
        <p className="text-muted-foreground text-xs mt-1.5">
          Domain yang didukung:{' '}
          <code className="bg-muted px-1 rounded">images.unsplash.com</code>{', '}
          <code className="bg-muted px-1 rounded">res.cloudinary.com</code>
        </p>

        {/* Status feedback berdasarkan URL */}
        {urlStatus === 'invalid_format' && (
          <p className="text-muted-foreground text-xs mt-1">
            Masukkan URL lengkap yang diawali <code className="bg-muted px-1 rounded">https://</code>
          </p>
        )}

        {urlStatus === 'blocked_domain' && (() => {
          let hostname = '';
          try { hostname = new URL(imagePreview).hostname; } catch {}
          return (
            <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p className="font-medium">Domain <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">{hostname}</code> tidak didukung.</p>
                <p className="mt-1">
                  Gunakan URL gambar langsung dari{' '}
                  <strong>Unsplash</strong> (<code>images.unsplash.com</code>) atau upload ke{' '}
                  <strong>Cloudinary</strong> lalu gunakan URL-nya.
                  Shortlink seperti <code>pin.it</code> atau link halaman web tidak bisa digunakan sebagai gambar.
                </p>
              </div>
            </div>
          );
        })()}

        {/* Preview gambar jika URL valid */}
        {showPreview && (
          <div className="mt-3 relative aspect-[3/1] rounded-xl overflow-hidden border border-border bg-muted">
            <Image
              src={imagePreview}
              alt="Preview banner"
              fill
              className="object-cover"
              onError={() => setImageLoadError(true)}
            />
          </div>
        )}

        {/* Gambar gagal load meski URL valid */}
        {urlStatus === 'valid' && imageLoadError && (
          <p className="text-muted-foreground text-xs mt-2">
            ⚠️ Gambar tidak bisa dimuat. Pastikan URL mengarah langsung ke file gambar (bukan halaman web).
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
