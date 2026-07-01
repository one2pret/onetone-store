// app/(admin)/dashboard/settings/_components/DataToolsCard.tsx
'use client';

import { useState, useTransition } from 'react';
import { Database, CheckCircle2, AlertCircle, Loader2, Tag, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { seedCategories, seedProducts } from '@/app/actions/seed';

type SeedResult = { inserted: number; skipped: number } | null;

type SeedItemProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  onRun: () => void;
  isPending: boolean;
  result: SeedResult;
  error: string | null;
  buttonLabel?: string;
};

function SeedItem({ icon, title, description, onRun, isPending, result, error, buttonLabel = 'Jalankan' }: SeedItemProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border bg-muted/30">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 text-primary">{icon}</div>
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <Button
          onClick={onRun}
          disabled={isPending}
          variant="outline"
          size="sm"
          className="shrink-0 border-primary/30 text-primary hover:bg-primary/10"
        >
          {isPending ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Memproses...</>
          ) : buttonLabel}
        </Button>
      </div>

      {result && (
        <div className="flex items-start gap-2 px-4 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
          <p className="text-sm text-green-700 dark:text-green-400">
            Selesai! <span className="font-semibold">{result.inserted} data</span> berhasil ditambahkan
            {result.skipped > 0 && <>, <span className="font-semibold">{result.skipped}</span> dilewati (sudah ada)</>}.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}

export function DataToolsCard() {
  // Category seed state
  const [catPending, startCatTransition] = useTransition();
  const [catResult, setCatResult] = useState<SeedResult>(null);
  const [catError, setCatError] = useState<string | null>(null);

  // Product seed state
  const [prodPending, startProdTransition] = useTransition();
  const [prodResult, setProdResult] = useState<SeedResult>(null);
  const [prodError, setProdError] = useState<string | null>(null);

  function handleSeedCategories() {
    setCatResult(null);
    setCatError(null);
    startCatTransition(async () => {
      const res = await seedCategories();
      if (res.success) setCatResult({ inserted: res.inserted, skipped: res.skipped });
      else setCatError(res.error ?? 'Terjadi kesalahan');
    });
  }

  function handleSeedProducts() {
    setProdResult(null);
    setProdError(null);
    startProdTransition(async () => {
      const res = await seedProducts();
      if (res.success) setProdResult({ inserted: res.inserted, skipped: res.skipped });
      else setProdError(res.error ?? 'Terjadi kesalahan');
    });
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center gap-2 mb-1">
        <Database className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">Data Tools</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Utilitas untuk mengisi data awal toko. Aman dijalankan berkali-kali — data yang sudah ada akan dilewati.
      </p>

      <div className="space-y-4">
        {/* Step 1 - Seed Kategori */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Langkah 1 — Kategori</p>
          <SeedItem
            icon={<Tag className="w-4 h-4" />}
            title="Seed Kategori Fashion ONETONE"
            description="Menambahkan 6 kategori: Pakaian Olahraga Wanita, Pakaian Olahraga Pria, Casual Wanita, Casual Pria, Aksesoris, Bundle & Set"
            onRun={handleSeedCategories}
            isPending={catPending}
            result={catResult}
            error={catError}
          />
        </div>

        <div className="border-t border-border" />

        {/* Step 2 - Seed Produk */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Langkah 2 — Produk</p>
          <SeedItem
            icon={<ShoppingBag className="w-4 h-4" />}
            title="Seed 12 Produk ONETONE (Harga Placeholder)"
            description="Menambahkan 12 produk nyata ONETONE: Legging, Legging Rok, Rompi Crop, Abaya Sports, Kaos Sports, Jaket Sports, Jogger, Batwing, Kulot, Hoodie, Hijab Sports, Bundle Set Gym. Jalankan setelah seed kategori."
            onRun={handleSeedProducts}
            isPending={prodPending}
            result={prodResult}
            error={prodError}
          />
        </div>
      </div>
    </div>
  );
}
