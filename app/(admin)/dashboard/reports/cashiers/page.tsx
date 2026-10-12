import Link from "next/link";
import { getCashierSalesReport } from "@/app/actions/pos-reports";
import { formatRupiah } from "@/lib/utils";
import type { CashierReportMetrics, CashierReportRow } from "@/lib/pos-reporting";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const count = (value: number) => value.toLocaleString("id-ID");
const fieldClass = "mt-1.5 block min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const linkClass = "inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function CashierReportPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === "string" ? params[key] : undefined;
  const duplicatedFilter = ["from", "to", "cashierId", "locationId", "page"].some(key => Array.isArray(params[key]));
  const result = duplicatedFilter
    ? { success: false, error: "Gunakan satu nilai untuk setiap filter laporan" } as const
    : await getCashierSalesReport({ from: value("from"), to: value("to"), cashierId: value("cashierId"), locationId: value("locationId"), page: value("page") });

  if (!result.success) {
    return <div role="alert" className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-5">
      <h1 className="text-lg font-semibold text-foreground">Laporan kasir tidak dapat ditampilkan</h1>
      <p className="text-sm text-muted-foreground">{result.error}</p>
      <Link href="/dashboard/reports/cashiers" className={linkClass}>Gunakan filter awal</Link>
    </div>;
  }

  const { filters, summary, rows, cashiers, locations, quality, asOf, pageSize, totalCashiers } = result.data;
  const pages = Math.max(1, Math.ceil(totalCashiers / pageSize));
  const reportUrl = (overrides: { page?: number; cashierId?: number } = {}) => {
    const query = new URLSearchParams({ from: filters.from, to: filters.to, page: String(overrides.page ?? filters.page) });
    if (overrides.cashierId ?? filters.cashierId) query.set("cashierId", String(overrides.cashierId ?? filters.cashierId));
    if (filters.locationId) query.set("locationId", String(filters.locationId));
    return `/dashboard/reports/cashiers?${query}`;
  };
  const issues = [
    quality.missingSessionOrders > 0 && `${count(quality.missingSessionOrders)} order tanpa sesi penjualan tidak dapat diatribusikan`,
    quality.missingPaymentDateOrders > 0 && `${count(quality.missingPaymentDateOrders)} order tanpa tanggal pembayaran tidak masuk penjualan`,
    quality.unexpectedStatusOrders > 0 && `${count(quality.unexpectedStatusOrders)} order dibayar dengan status selain delivered tidak masuk penjualan`,
    quality.missingLocationOrders > 0 && `${count(quality.missingLocationOrders)} order memiliki sesi tanpa lokasi stok`,
    summary.legacyPriceOrders > 0 && `${count(summary.legacyPriceOrders)} order memakai snapshot harga lama; bruto tercatat belum mencakup promo yang tidak tersimpan`,
    summary.missingItemOrders > 0 && `${count(summary.missingItemOrders)} order tanpa rincian item; jumlah unit dan promo belum lengkap`,
    summary.cashDifferenceMissing > 0 && `${count(summary.cashDifferenceMissing)} sesi ditutup tanpa selisih kas tersimpan`,
  ].filter(Boolean);

  return (
    <div className="min-w-0 space-y-6">
      <header>
        <Link href="/dashboard/reports" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Kembali ke laporan</Link>
        <h1 className="text-balance text-xl font-bold text-foreground md:text-2xl">Penjualan Kasir</h1>
        <p className="mt-1 text-sm text-muted-foreground">Berdasarkan ID pemilik sesi POS. Akun admin yang dipakai bersama belum menunjukkan kasir bertugas sebenarnya.</p>
      </header>

      <form action="/dashboard/reports/cashiers" method="get" className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm font-medium text-foreground">Mulai (WIB)<input type="date" name="from" required defaultValue={filters.from} className={fieldClass} /></label>
        <label className="text-sm font-medium text-foreground">Sampai (WIB)<input type="date" name="to" required defaultValue={filters.to} className={fieldClass} /></label>
        <label className="text-sm font-medium text-foreground">Pemilik sesi<select name="cashierId" defaultValue={filters.cashierId ?? ""} className={fieldClass}>
          <option value="">Semua kasir</option>
          {cashiers.map(cashier => <option key={cashier.id} value={cashier.id}>{cashier.name} · #{cashier.id}{cashier.inactive ? " (nonaktif)" : ""}</option>)}
        </select></label>
        <label className="text-sm font-medium text-foreground">Lokasi stok<select name="locationId" defaultValue={filters.locationId ?? ""} className={fieldClass}>
          <option value="">Semua lokasi</option>
          {locations.map(location => <option key={location.id} value={location.id}>{location.name} · {location.code}{!location.isActive ? " (nonaktif)" : ""}</option>)}
        </select></label>
        <button type="submit" className="min-h-11 self-end rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">Tampilkan laporan</button>
      </form>

      <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="sales-summary">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="sales-summary" className="text-sm font-medium text-muted-foreground">Penjualan bersih periode terpilih</h2>
            <p className="mt-2 break-words text-3xl font-bold tabular-nums text-foreground">{formatRupiah(summary.netSales)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{count(summary.transactions)} transaksi · {count(summary.netItems)} unit setelah retur</p>
          </div>
          <p className="max-w-lg text-sm text-muted-foreground">
            Penjualan mengikuti tanggal pembayaran {filters.from} sampai {filters.to} (WIB).
            Refund mengikuti order penjualan asal, termasuk retur setelah periode, sampai {new Date(asOf).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" })} WIB.
          </p>
        </div>
        <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Bruto tercatat" value={formatRupiah(summary.grossSales)} />
          <Metric label="Seluruh diskon tercatat" value={formatRupiah(summary.totalDiscounts)} />
          <Metric label="Penjualan sebelum refund" value={formatRupiah(summary.salesBeforeRefunds)} />
          <Metric label="Refund penjualan asal" value={formatRupiah(summary.refunds)} />
          <Metric label="Rata-rata transaksi sebelum refund" value={formatRupiah(summary.averageTransaction)} />
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">Diskon promo {formatRupiah(summary.automaticDiscounts)}; diskon manual/voucher {formatRupiah(summary.additionalDiscounts)}. Unit terjual {count(summary.itemsSold)}; dikembalikan {count(summary.returnedItems)}.</p>
      </section>

      {issues.length > 0 && <section aria-label="Kelengkapan data" className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-foreground">Data yang perlu diperiksa</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{issues.map(issue => <li key={String(issue)}>{issue}.</li>)}</ul>
      </section>}

      <section className="min-w-0 rounded-xl border border-border bg-card" aria-labelledby="cashier-table">
        <div className="border-b border-border p-4">
          <h2 id="cashier-table" className="font-semibold text-foreground">Hasil per pemilik sesi</h2>
          <p className="mt-1 text-sm text-muted-foreground">{count(totalCashiers)} kasir dengan penjualan atau sesi ditutup sesuai filter. Diurutkan menurut penjualan bersih.</p>
        </div>
        {rows.length === 0 ? <div className="space-y-3 p-6 text-sm text-muted-foreground">
          <p>{totalCashiers > 0 ? "Halaman ini berada di luar hasil laporan." : "Belum ada penjualan atau sesi ditutup yang cocok. Pilih tanggal lain atau tampilkan semua kasir/lokasi."}</p>
          <Link href={reportUrl({ page: 1 })} className={linkClass}>Buka halaman pertama</Link>
        </div> : <>
          <div className="hidden overflow-x-auto lg:block" tabIndex={0} role="region" aria-label="Tabel penjualan kasir, dapat digulir horizontal">
            <table className="w-full min-w-[1400px] text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground"><tr>
                {["Pemilik sesi", "Transaksi", "Bruto tercatat", "Diskon", "Refund asal", "Penjualan bersih", "Unit jual / retur", "Rata-rata transaksi", "Sesi penjualan", "Sesi ditutup", "Selisih kas"].map((label, index) => <th key={label} scope="col" className={`whitespace-nowrap px-4 py-3 ${index ? "text-right" : "text-left"}`}>{label}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-border">{rows.map(row => <tr key={row.cashierId}>
                <td className="px-4 py-4"><CashierName row={row} href={reportUrl({ cashierId: row.cashierId, page: 1 })} /></td>
                <td className="px-4 py-4 text-right tabular-nums">{count(row.transactions)}</td>
                <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">{formatRupiah(row.grossSales)}</td>
                <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">{formatRupiah(row.totalDiscounts)}</td>
                <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">{formatRupiah(row.refunds)}</td>
                <td className="whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums">{formatRupiah(row.netSales)}</td>
                <td className="px-4 py-4 text-right tabular-nums">{count(row.itemsSold)} / {count(row.returnedItems)}</td>
                <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">{formatRupiah(row.averageTransaction)}</td>
                <td className="px-4 py-4 text-right tabular-nums">{count(row.salesSessionCount)}</td>
                <td className="px-4 py-4 text-right tabular-nums">{count(row.closedSessionCount)}</td>
                <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">{cashDifference(row)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="divide-y divide-border lg:hidden">{rows.map(row => <article key={row.cashierId} className="min-w-0 p-4">
            <CashierName row={row} href={reportUrl({ cashierId: row.cashierId, page: 1 })} />
            <p className="mt-2 break-words text-xl font-semibold tabular-nums text-foreground">{formatRupiah(row.netSales)}</p>
            <p className="text-xs text-muted-foreground">Penjualan bersih · {count(row.transactions)} transaksi</p>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Bruto tercatat" value={formatRupiah(row.grossSales)} />
              <Metric label="Diskon" value={formatRupiah(row.totalDiscounts)} />
              <Metric label="Refund asal" value={formatRupiah(row.refunds)} />
              <Metric label="Rata-rata transaksi" value={formatRupiah(row.averageTransaction)} />
              <Metric label="Unit jual / retur" value={`${count(row.itemsSold)} / ${count(row.returnedItems)}`} />
              <Metric label="Sesi penjualan / ditutup" value={`${count(row.salesSessionCount)} / ${count(row.closedSessionCount)}`} />
              <Metric label="Selisih kas" value={cashDifference(row)} />
            </dl>
          </article>)}</div>
        </>}
        <div className="space-y-4 border-t border-border p-4">
          <p className="text-xs text-muted-foreground">Sesi penjualan dihitung dari order dalam periode. Sesi ditutup dan selisih kas mengikuti tanggal penutupan dalam periode, dihitung sekali per sesi. Sesi aktif tidak dianggap berselisih nol. Refund dari sesi lain tetap memengaruhi kas pada sesi pembayaran refund tersebut.</p>
          <nav aria-label="Halaman laporan kasir" className="flex flex-wrap items-center gap-3">
            {filters.page > 1 && <Link href={reportUrl({ page: filters.page - 1 })} className={linkClass}>Sebelumnya</Link>}
            <span className="text-sm text-muted-foreground">Halaman {filters.page} / {pages}</span>
            {filters.page < pages && <Link href={reportUrl({ page: filters.page + 1 })} className={linkClass}>Berikutnya</Link>}
          </nav>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4" aria-labelledby="payments">
        <h2 id="payments" className="font-semibold text-foreground">Rincian pembayaran</h2>
        <p className="mt-1 text-sm text-muted-foreground">Total seluruh hasil filter, bukan hanya halaman ini. Metode refund bisa berbeda dari metode penjualan asal.</p>
        <PaymentBreakdown metrics={summary} />
        {filters.cashierId && <p className="mt-3 text-xs text-muted-foreground">Rincian ini mengikuti pemilik sesi yang dipilih.</p>}
        <p className="mt-3 text-xs text-muted-foreground">QRIS dan transfer mengikuti pencatatan POS; konfirmasi dana masuk/keluar tetap diperiksa pada rekening.</p>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-semibold tabular-nums text-foreground">{value}</dd></div>;
}

function CashierName({ row, href }: { row: CashierReportRow; href: string }) {
  return <div className="min-w-0">
    <Link href={href} className="inline-flex min-h-11 items-center break-words font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{row.cashierName}</Link>
    <p className="text-xs text-muted-foreground">Akun #{row.cashierId}{row.inactive ? " · nonaktif" : ""}</p>
  </div>;
}

function cashDifference(row: CashierReportMetrics) {
  if (!row.closedSessionCount) return "Belum ada sesi ditutup";
  if (row.cashDifferenceMissing === row.closedSessionCount) return "Belum tercatat";
  return `${formatRupiah(row.cashDifference)}${row.cashDifferenceMissing ? " (sebagian)" : ""}`;
}

function PaymentBreakdown({ metrics }: { metrics: CashierReportMetrics }) {
  const methods = [
    { name: "Tunai", sales: metrics.cashSales, refunds: metrics.cashRefunds },
    { name: "QRIS", sales: metrics.qrisSales, refunds: metrics.qrisRefunds },
    { name: "Transfer", sales: metrics.transferSales, refunds: metrics.transferRefunds },
    ...(metrics.unknownPaymentSales ? [{ name: "Metode belum tercatat", sales: metrics.unknownPaymentSales, refunds: 0 }] : []),
  ];
  return <dl className="mt-4 grid gap-4 md:grid-cols-3">{methods.map(method => <div key={method.name} className="min-w-0 rounded-lg bg-muted p-4">
    <dt className="font-medium text-foreground">{method.name}</dt>
    <dd className="mt-2 space-y-1 text-sm text-muted-foreground">
      <p className="break-words">Penjualan {formatRupiah(method.sales)}</p>
      <p className="break-words">Refund {formatRupiah(method.refunds)}</p>
      <p className="break-words font-semibold text-foreground">Selisih {formatRupiah(method.sales - method.refunds)}</p>
    </dd>
  </div>)}</dl>;
}
