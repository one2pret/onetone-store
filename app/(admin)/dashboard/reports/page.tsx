import Link from "next/link";

export default function ReportsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-balance text-xl font-bold text-foreground md:text-2xl">Laporan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Penjualan POS dan hasil kerja kasir berdasarkan transaksi yang tercatat.</p>
      </div>
      <Link href="/dashboard/reports/cashiers" className="block rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <h2 className="text-lg font-semibold text-foreground">Penjualan Kasir</h2>
        <p className="mt-2 text-sm text-muted-foreground">Bandingkan penjualan, diskon, retur, pembayaran, dan selisih kas per pemilik sesi POS.</p>
        <span className="mt-4 inline-block text-sm font-medium text-foreground underline underline-offset-4">Buka laporan kasir</span>
      </Link>
    </div>
  );
}
