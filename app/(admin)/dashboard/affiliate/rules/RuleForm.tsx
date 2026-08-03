'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createCommissionRule } from '@/app/actions/affiliate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Category, Product } from '@/lib/db/schema';

type Scope = 'global' | 'tier' | 'category' | 'product';

export function RuleForm({ categories, products }: { categories: Category[]; products: Product[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>('global');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('scope', scope);

    startTransition(async () => {
      const result = await createCommissionRule(null, formData);
      if (!result.success) {
        toast.error(result.error ?? 'Gagal membuat rule');
        return;
      }
      toast.success('Rule dibuat');
      (e.target as HTMLFormElement).reset();
      setScope('global');
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return <Button size="sm" onClick={() => setOpen(true)}>+ Rule Baru</Button>;
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border p-5 space-y-4 max-w-md">
      <p className="text-sm font-semibold text-foreground">Rule Komisi Baru</p>

      <div className="space-y-1.5">
        <Label htmlFor="scope">Scope</Label>
        <select id="scope" value={scope} onChange={(e) => setScope(e.target.value as Scope)} className="w-full h-9 px-3 rounded-md border border-border bg-input text-sm text-foreground">
          <option value="global">Global (default)</option>
          <option value="tier">Per Tier</option>
          <option value="category">Per Kategori</option>
          <option value="product">Per Produk</option>
        </select>
      </div>

      {scope === 'tier' && (
        <div className="space-y-1.5">
          <Label htmlFor="scopeTier">Tier</Label>
          <select id="scopeTier" name="scopeTier" required className="w-full h-9 px-3 rounded-md border border-border bg-input text-sm text-foreground">
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="elite">Elite</option>
          </select>
        </div>
      )}

      {scope === 'category' && (
        <div className="space-y-1.5">
          <Label htmlFor="categoryId">Kategori</Label>
          <select id="categoryId" name="categoryId" required className="w-full h-9 px-3 rounded-md border border-border bg-input text-sm text-foreground">
            <option value="">— Pilih —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {scope === 'product' && (
        <div className="space-y-1.5">
          <Label htmlFor="productId">Produk</Label>
          <select id="productId" name="productId" required className="w-full h-9 px-3 rounded-md border border-border bg-input text-sm text-foreground">
            <option value="">— Pilih —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ratePercent">Rate (%)</Label>
          <Input id="ratePercent" name="ratePercent" type="number" step="0.01" required placeholder="7.5" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxCommission">Cap (opsional)</Label>
          <Input id="maxCommission" name="maxCommission" type="number" placeholder="50000" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="priority">Priority (makin besar makin menang saat seri)</Label>
        <Input id="priority" name="priority" type="number" defaultValue={0} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>Simpan</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
      </div>
    </form>
  );
}
