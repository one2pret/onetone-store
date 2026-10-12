"use client";

export default function ReportsError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="max-w-xl space-y-3 rounded-xl border border-border bg-card p-6">
      <h2 className="font-semibold text-foreground">Laporan belum dapat dimuat</h2>
      <p className="text-sm text-muted-foreground">Data penjualan tidak berubah. Coba muat ulang laporan; bila masih gagal, hubungi admin teknis.</p>
      <button type="button" onClick={reset} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Muat ulang laporan</button>
    </div>
  );
}
