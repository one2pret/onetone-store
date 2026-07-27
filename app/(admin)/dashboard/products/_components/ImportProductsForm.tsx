'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { importProductsFromCsv, type ImportResult } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, FileWarning } from 'lucide-react';

export function ImportProductsForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.set('file', file);

    startTransition(async () => {
      const res = await importProductsFromCsv(null, formData);
      setResult(res);
      if (res.formError) {
        toast.error(res.formError);
        return;
      }
      if (res.imported > 0) {
        toast.success(`${res.imported} produk berhasil diimport sebagai draft`);
        router.refresh();
      } else if (res.errors.length > 0) {
        toast.error('Tidak ada produk yang berhasil diimport, cek daftar error di bawah');
      }
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="csv-file">File CSV</Label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-secondary file:text-secondary-foreground file:text-sm file:font-medium hover:file:bg-secondary/80 cursor-pointer"
          />
        </div>
        <Button type="submit" disabled={!file || isPending}>
          <Upload className="w-4 h-4 mr-1.5" />
          {isPending ? 'Mengimport...' : 'Import Produk'}
        </Button>
      </form>

      {result && (result.imported > 0 || result.errors.length > 0) && (
        <div className="space-y-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold text-success">{result.imported} produk</span> berhasil diimport sebagai draft (belum tampil di toko — lengkapi gambar lalu aktifkan manual).
            {result.errors.length > 0 && (
              <span className="text-muted-foreground"> {result.errors.length} baris gagal.</span>
            )}
          </p>

          {result.errors.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Baris</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nama</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Masalah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.errors.map((err, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-muted-foreground">{err.row}</td>
                      <td className="px-3 py-2 text-foreground">{err.name}</td>
                      <td className="px-3 py-2 text-destructive flex items-center gap-1.5">
                        <FileWarning className="w-3.5 h-3.5 shrink-0" />
                        {err.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
