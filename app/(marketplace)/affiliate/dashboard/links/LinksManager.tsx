'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createAffiliateLink, deactivateAffiliateLink } from '@/app/actions/affiliate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Trash2, Plus, MousePointerClick } from 'lucide-react';
import type { AffiliateLink, Product, Category } from '@/lib/db/schema';

type TargetType = 'home' | 'product' | 'category' | 'custom';

export function LinksManager({
  links, products, categories, baseUrl,
}: {
  links: AffiliateLink[];
  products: Product[];
  categories: Category[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [targetType, setTargetType] = useState<TargetType>('home');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('targetType', targetType);

    startTransition(async () => {
      const result = await createAffiliateLink(null, formData);
      if (!result.success) {
        toast.error(result.error ?? 'Gagal membuat link');
        return;
      }
      toast.success('Link dibuat');
      (e.target as HTMLFormElement).reset();
      setTargetType('home');
      router.refresh();
    });
  }

  function handleDeactivate(id: number) {
    startTransition(async () => {
      const result = await deactivateAffiliateLink(id);
      if (!result.success) {
        toast.error(result.error ?? 'Gagal menonaktifkan link');
        return;
      }
      toast.success('Link dinonaktifkan');
      router.refresh();
    });
  }

  function handleCopy(slug: string) {
    navigator.clipboard.writeText(`${baseUrl}/r/${slug}`).then(() => {
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="bg-card rounded-xl border border-border p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">Buat Link Baru</p>

        <div className="space-y-1.5">
          <Label>Tujuan link</Label>
          <Select value={targetType} onValueChange={(v) => setTargetType(v as TargetType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="home">Halaman utama toko</SelectItem>
              <SelectItem value="product">Produk tertentu</SelectItem>
              <SelectItem value="category">Kategori tertentu</SelectItem>
              <SelectItem value="custom">Path custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {targetType === 'product' && (
          <div className="space-y-1.5">
            <Label htmlFor="targetId">Pilih produk</Label>
            <select id="targetId" name="targetId" required className="w-full h-9 px-3 rounded-md border border-border bg-input text-sm text-foreground">
              <option value="">— Pilih produk —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        {targetType === 'category' && (
          <div className="space-y-1.5">
            <Label htmlFor="targetId">Pilih kategori</Label>
            <select id="targetId" name="targetId" required className="w-full h-9 px-3 rounded-md border border-border bg-input text-sm text-foreground">
              <option value="">— Pilih kategori —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {targetType === 'custom' && (
          <div className="space-y-1.5">
            <Label htmlFor="targetPath">Path (contoh: /products?category=sepatu)</Label>
            <Input id="targetPath" name="targetPath" required placeholder="/products?category=sepatu" />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="label">Catatan (opsional)</Label>
          <Input id="label" name="label" placeholder="IG Story Januari" />
        </div>

        <Button type="submit" disabled={isPending} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          Buat Link
        </Button>
      </form>

      <div className="space-y-3">
        {links.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Belum ada link. Buat link pertamamu di atas.</p>
        )}
        {links.map((link) => (
          <div key={link.id} className={`bg-card rounded-xl border border-border p-4 flex items-center justify-between gap-4 ${!link.isActive ? 'opacity-50' : ''}`}>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground font-mono truncate">/r/{link.slug}</p>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-xs text-muted-foreground">{link.label || link.targetType}</p>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MousePointerClick className="w-3 h-3" />
                  {link.clickCount}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => handleCopy(link.slug)}>
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                {copiedSlug === link.slug ? 'Tersalin' : 'Salin'}
              </Button>
              {link.isActive && (
                <Button variant="ghost" size="sm" onClick={() => handleDeactivate(link.id)} disabled={isPending}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
