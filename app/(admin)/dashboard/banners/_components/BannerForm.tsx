// app/(admin)/dashboard/banners/_components/BannerForm.tsx
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { createBanner, updateBanner } from '@/app/actions/banners';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Banner } from '@/lib/db/schema';
import Image from 'next/image';
import { AlertCircle, ImageIcon, UploadCloud, X } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    let cdnHostname = '';
    try {
      cdnHostname = process.env.NEXT_PUBLIC_CDN_URL ? new URL(process.env.NEXT_PUBLIC_CDN_URL).hostname : '';
    } catch {}
    if (!ALLOWED_HOSTNAMES.includes(parsed.hostname) && parsed.hostname !== cdnHostname) return 'blocked_domain';
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
  const [selectedPreview, setSelectedPreview] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState('');
  const [externalImageUrl, setExternalImageUrl] = useState(banner?.imageObjectKey ? '' : banner?.image || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (selectedPreview) URL.revokeObjectURL(selectedPreview);
    };
  }, [selectedPreview]);

  function clearSelectedFile() {
    if (inputRef.current) inputRef.current.value = '';
    setSelectedPreview('');
    setSelectedFileName('');
    setFileError('');
    setImageLoadError(false);
  }

  function selectFile(file: File, syncInput = false) {
    const supportedExtension = /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
    if ((!file.type.startsWith('image/') && !supportedExtension) || file.size > 10 * 1024 * 1024) {
      if (inputRef.current) inputRef.current.value = '';
      setSelectedPreview('');
      setSelectedFileName('');
      setFileError('Gunakan JPEG, PNG, WebP, atau HEIC dengan ukuran maksimal 10 MB.');
      return;
    }
    if (syncInput && inputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      inputRef.current.files = transfer.files;
    }
    setFileError('');
    setSelectedFileName(file.name);
    setSelectedPreview(URL.createObjectURL(file));
    setImageLoadError(false);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImageLoadError(false);
    setExternalImageUrl(e.target.value);
    setImagePreview(e.target.value || banner?.image || '');
    if (selectedPreview) clearSelectedFile();
  }

  const urlStatus = checkImageUrl(externalImageUrl);
  const activePreview = selectedPreview || imagePreview;
  const showPreview = Boolean(activePreview) && (Boolean(selectedPreview) || Boolean(banner?.imageObjectKey) || urlStatus === 'valid') && !imageLoadError;

  return (
    <form action={formAction} className="max-w-4xl space-y-6">
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

      <section className="space-y-4">
        <div>
          <Label className="text-foreground">Gambar Banner <span className="text-destructive">*</span></Label>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Rekomendasi rasio 3:1, minimal 1200 × 400 piksel. Area sisi gambar dapat terpotong pada layar ponsel.
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
          }}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) selectFile(file, true);
          }}
          className={cn(
            'cursor-pointer rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:border-primary/60 hover:bg-muted/40',
            isPending && 'pointer-events-none opacity-60',
          )}
        >
          <input
            ref={inputRef}
            id="imageFile"
            name="imageFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) selectFile(file);
            }}
          />
          <UploadCloud className="mx-auto h-9 w-9 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-foreground">
            Tarik gambar ke sini atau klik untuk memilih
          </p>
          <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, WebP, atau HEIC · maksimal 10 MB</p>
          {selectedFileName && (
            <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{selectedFileName}</span>
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); clearSelectedFile(); }}
                className="rounded p-0.5 hover:bg-primary/10"
                aria-label="Batalkan gambar yang dipilih"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {(fileError || state?.errors?.image) && (
          <p className="text-sm text-destructive">{fileError || state?.errors?.image?.[0]}</p>
        )}

        {showPreview && (
          <div className="space-y-2">
            <div className="relative aspect-[3/1] overflow-hidden rounded-xl border border-border bg-muted">
              <Image
                src={activePreview}
                alt="Preview banner desktop"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 896px"
                className="object-cover"
                onError={() => setImageLoadError(true)}
              />
            </div>
            <p className="text-xs text-muted-foreground">Preview desktop · gambar disimpan dalam format WebP teroptimasi.</p>
          </div>
        )}

        {imageLoadError && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Gambar lama tidak bisa dimuat. Pilih file baru atau gunakan URL eksternal yang valid.
          </div>
        )}

        <details className="rounded-lg border border-border bg-muted/20 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Gunakan URL eksternal (opsional)</summary>
          <div className="mt-3">
            <Label htmlFor="externalImageUrl" className="text-foreground">URL gambar langsung</Label>
            <Input
              id="externalImageUrl"
              name="externalImageUrl"
              type="url"
              value={externalImageUrl}
              className="mt-1"
              placeholder="https://images.unsplash.com/photo-..."
              onChange={handleImageChange}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">Didukung untuk kompatibilitas banner lama: Unsplash, Cloudinary, dan placehold.co. File upload akan diprioritaskan.</p>
            {state?.errors?.externalImageUrl && <p className="mt-1 text-sm text-destructive">{state.errors.externalImageUrl[0]}</p>}
            {urlStatus === 'invalid_format' && <p className="mt-1 text-xs text-muted-foreground">Masukkan URL lengkap yang diawali https://</p>}
            {urlStatus === 'blocked_domain' && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Domain URL ini tidak didukung.</p>}
          </div>
        </details>
      </section>

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
