// app/(admin)/dashboard/settings/_components/HeroSettingsCard.tsx
'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { upsertStoreSettings } from '@/app/actions/store-settings';
import type { HeroConfig } from '@/app/actions/store-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save, Image as ImageIcon, Sparkles, Link as LinkIcon, ShoppingBag } from 'lucide-react';
import type { ProductWithCategory } from '@/lib/db/schema';

interface Props {
  config: HeroConfig;
  featuredProducts: ProductWithCategory[];
}

const MODES: Array<{
  id: HeroConfig['mode'];
  label: string;
  desc: string;
  icon: typeof Sparkles;
}> = [
  {
    id: 'auto',
    label: 'Otomatis',
    desc: 'Pakai produk Unggulan terbaru.',
    icon: Sparkles,
  },
  {
    id: 'product',
    label: 'Pilih Produk',
    desc: 'Kunci ke satu produk tertentu.',
    icon: ShoppingBag,
  },
  {
    id: 'custom',
    label: 'URL Kustom',
    desc: 'Paste URL foto lookbook / campaign.',
    icon: LinkIcon,
  },
];

export function HeroSettingsCard({ config, featuredProducts }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<HeroConfig['mode']>(config.mode);
  const [productId, setProductId] = useState<string>(
    config.productId ? String(config.productId) : (featuredProducts[0]?.id ? String(featuredProducts[0].id) : '')
  );
  const [customUrl, setCustomUrl] = useState<string>(config.customImageUrl);

  // Preview image resolved dari mode aktif
  const previewImage =
    mode === 'custom'
      ? (customUrl || null)
      : mode === 'product'
        ? featuredProducts.find((p) => String(p.id) === productId)?.image ?? null
        : featuredProducts[0]?.image ?? null;

  const previewCaption =
    mode === 'product'
      ? featuredProducts.find((p) => String(p.id) === productId)?.name ?? null
      : mode === 'auto'
        ? featuredProducts[0]?.name ?? null
        : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const result = await upsertStoreSettings({
          hero_mode: mode,
          hero_product_id: mode === 'product' ? productId : '',
          hero_image_url: mode === 'custom' ? customUrl.trim() : '',
        });
        if (!result.success) {
          toast.error(result.error || 'Gagal menyimpan pengaturan hero');
          return;
        }
        toast.success('Pengaturan hero berhasil disimpan');
        router.refresh();
      } catch (err) {
        console.error(err);
        toast.error('Terjadi kesalahan saat menyimpan');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <ImageIcon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-foreground">Gambar Hero Landing</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Foto besar di bagian atas halaman utama. Pilih mode di bawah.
          </p>
        </div>
      </div>

      {/* Mode picker */}
      <div className="grid gap-3 md:grid-cols-3">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={[
                'text-left p-4 rounded-lg border-2 transition',
                active
                  ? 'border-primary bg-accent'
                  : 'border-border hover:border-primary/40 bg-background',
              ].join(' ')}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <m.icon className={active ? 'w-4 h-4 text-primary' : 'w-4 h-4 text-muted-foreground'} />
                <span className={active ? 'text-sm font-semibold text-primary' : 'text-sm font-semibold text-foreground'}>
                  {m.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Mode-specific input */}
      {mode === 'product' && (
        <div className="space-y-2">
          <Label htmlFor="hero-product" className="text-foreground">Pilih Produk Featured</Label>
          {featuredProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada produk yang di-flag <span className="text-foreground font-medium">Unggulan</span>. Tambahkan lewat halaman Produk.
            </p>
          ) : (
            <select
              id="hero-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {featuredProducts.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {mode === 'custom' && (
        <div className="space-y-2">
          <Label htmlFor="hero-url" className="text-foreground">URL Gambar</Label>
          <Input
            id="hero-url"
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://cdn.onetone.id/campaign/hero-2026.webp"
          />
          <p className="text-xs text-muted-foreground">
            Format disarankan: WebP atau JPG, rasio 16:9, lebar minimum 1600px, ukuran &lt; 400KB.
          </p>
        </div>
      )}

      {/* Preview */}
      <div>
        <Label className="text-foreground mb-2 block">Preview</Label>
        <div className="relative aspect-[16/9] rounded-lg overflow-hidden border border-border bg-muted">
          {previewImage ? (
            <Image
              src={previewImage}
              alt="Preview hero"
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-6">
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {mode === 'custom'
                  ? 'Masukkan URL untuk melihat preview.'
                  : 'Belum ada gambar tersedia.'}
              </p>
            </div>
          )}
          {previewImage && previewCaption && (
            <span className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm text-[11px] text-foreground border border-border">
              {previewCaption}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} size="lg">
          <span className="inline-flex items-center">
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            <span>Simpan Hero</span>
          </span>
        </Button>
      </div>
    </form>
  );
}
