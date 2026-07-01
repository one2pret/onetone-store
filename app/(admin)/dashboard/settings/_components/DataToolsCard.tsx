// app/(admin)/dashboard/settings/_components/DataToolsCard.tsx
'use client';

import { useState, useTransition } from 'react';
import { Database, CheckCircle2, AlertCircle, Loader2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { seedCategories } from '@/app/actions/seed';

type SeedResult = { inserted: number; skipped: number } | null;

export function DataToolsCard() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SeedResult>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSeed() {
    setResult(null);
    setError(null);
    startTransition(async () => {
      const res = await seedCategories();
      if (res.success) {
        setResult({ inserted: res.inserted, skipped: res.skipped });
      } else {
        setError(res.error ?? 'Terjadi kesalahan');
      }
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

      <div className="space-y-3">
        {/* Seed Kategori */}
        <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border bg-muted/30">
          <div className="flex items-start gap-3">
            <Tag className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Seed Kategori Fashion ONETONE</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Menambahkan 6 kategori: Pakaian Olahraga Wanita, Pakaian Olahraga Pria, Casual Wanita, Casual Pria, Aksesoris, Bundle &amp; Set
              </p>
            </div>
          </div>
          <Button
            onClick={handleSeed}
            disabled={isPending}
            variant="outline"
            size="sm"
            className="shrink-0 border-primary/30 text-primary hover:bg-primary/10"
          >
            {isPending ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Memproses...</>
            ) : (
              'Jalankan'
            )}
          </Button>
        </div>

        {/* Hasil */}
        {result && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
            <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
            <p className="text-sm text-success">
              Selesai! <span className="font-semibold">{result.inserted} kategori</span> berhasil ditambahkan
              {result.skipped > 0 && <>, <span className="font-semibold">{result.skipped}</span> dilewati (sudah ada)</>}.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
