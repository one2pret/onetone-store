import Link from "next/link";
import { getEventSalesReport } from "@/app/actions/pos-event-reports";
import { formatRupiah } from "@/lib/utils";
import type { CashierReportMetrics } from "@/lib/pos-reporting";
import { SALES_EVENT_LABELS } from "@/lib/sales-events";

export const dynamic = "force-dynamic";
const route = "/dashboard/reports/events/sales";
const field = "mt-1.5 block min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground";
const link = "inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground";
const dateLabel = (value: Date | string) => new Date(value).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });

export default async function EventSalesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const keys = ["from", "to", "eventId", "cashierId", "locationId", "page"] as const;
  const input = Object.fromEntries(keys.map(key => [key, typeof params[key] === "string" ? params[key] : undefined]));
  const result = keys.some(key => Array.isArray(params[key]))
    ? { success: false, error: "Gunakan satu nilai untuk setiap filter laporan" } as const
    : await getEventSalesReport(input);
  if (!result.success) return <div role="alert" className="space-y-4 rounded-xl border border-border bg-card p-5">
    <h1 className="text-balance text-lg font-semibold text-foreground">Laporan omzet event tidak dapat ditampilkan</h1>
    <p className="text-sm text-foreground">{result.error}</p><Link href={route} className={link}>Gunakan filter awal</Link>
  </div>;
  const data = result.data;
  const f = data.filters;
  function query(overrides: { page?: number; eventId?: number } = {}) {
    const values = new URLSearchParams({ from: f.from, to: f.to, page: String(overrides.page ?? f.page) });
    if (overrides.eventId ?? f.eventId) values.set("eventId", String(overrides.eventId ?? f.eventId));
    if (f.cashierId) values.set("cashierId", String(f.cashierId));
    if (f.locationId) values.set("locationId", String(f.locationId));
    return values;
  }
  return <div className="min-w-0 space-y-6">
    <header>
      <Link href="/dashboard/reports/events" className={link}>Kelola event</Link>
      <h1 className="mt-3 text-balance text-xl font-bold text-foreground md:text-2xl">Omzet Sales Event / Bazaar</h1>
      <p className="mt-1 text-sm text-foreground">Bandingkan hasil penjualan acara, lalu pilih satu event untuk melihat kontribusi kasir dan hasil harian.</p>
    </header>
    <form action={route} method="get" className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-3">
      <label className="text-sm font-medium text-foreground">Mulai (WIB)<input type="date" name="from" required defaultValue={f.from} className={field} /></label>
      <label className="text-sm font-medium text-foreground">Sampai (WIB)<input type="date" name="to" required defaultValue={f.to} className={field} /></label>
      <label className="text-sm font-medium text-foreground">Event<select name="eventId" defaultValue={f.eventId ?? ""} className={field}><option value="">Semua event</option>{data.events.map(event => <option key={event.id} value={event.id}>{event.name} · {event.code} ({SALES_EVENT_LABELS[event.status]})</option>)}</select></label>
      <label className="text-sm font-medium text-foreground">Pemilik sesi<select name="cashierId" defaultValue={f.cashierId ?? ""} className={field}><option value="">Semua kasir</option>{data.cashiers.map(cashier => <option key={cashier.id} value={cashier.id}>{cashier.name} · #{cashier.id}</option>)}</select></label>
      <label className="text-sm font-medium text-foreground">Lokasi stok<select name="locationId" defaultValue={f.locationId ?? ""} className={field}><option value="">Semua lokasi</option>{data.locations.map(location => <option key={location.id} value={location.id}>{location.name} · {location.code}</option>)}</select></label>
      <button type="submit" className="min-h-11 self-end rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground">Tampilkan laporan</button>
    </form>
    {data.selectedEvent && <section aria-label="Event terpilih" className="space-y-2 rounded-xl border border-border bg-card p-5 text-sm text-foreground">
      <h2 className="text-balance text-lg font-semibold">{data.selectedEvent.name} · {data.selectedEvent.code}</h2>
      <p>{SALES_EVENT_LABELS[data.selectedEvent.status]} · Venue: {data.selectedEvent.venueName ?? "Belum diisi"}</p>
      <p>Periode acara: {dateLabel(data.selectedEvent.startsAt)} sampai {dateLabel(data.selectedEvent.endsAt)} WIB. Filter tanggal laporan mengikuti pembayaran, bukan periode acara.</p>
    </section>}
    <section aria-labelledby="event-summary" className="rounded-xl border border-border bg-card p-5">
      <h2 id="event-summary" className="text-balance text-sm font-medium text-foreground">Omzet bersih sesuai filter</h2>
      <p className="mt-2 break-words text-3xl font-bold tabular-nums text-foreground">{formatRupiah(data.summary.netSales)}</p>
      <p className="mt-3 text-sm text-foreground">Penjualan berdasarkan pembayaran {f.from} sampai {f.to} WIB. Refund mengikuti event dan kasir penjualan asal, termasuk refund sesudah periode, sampai {dateLabel(data.asOf)} WIB. Sesi tanpa event tidak disertakan.</p>
      <Metrics metrics={data.summary} />
    </section>
    {(data.excludedOrders > 0 || data.summary.legacyPriceOrders > 0 || data.summary.missingItemOrders > 0) && <section aria-label="Kelengkapan data" className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm text-foreground">
      <h2 className="text-balance font-semibold">Data yang perlu diperiksa</h2>
      {data.excludedOrders > 0 && <p>{data.excludedOrders} order event tanpa tanggal pembayaran atau berstatus selain delivered tidak masuk omzet.</p>}
      {data.summary.legacyPriceOrders > 0 && <p>{data.summary.legacyPriceOrders} order memiliki harga reguler legacy; bruto hanya mencakup promo yang snapshot-nya tersedia.</p>}
      {data.summary.missingItemOrders > 0 && <p>{data.summary.missingItemOrders} order tanpa rincian item; unit dan diskon promo belum lengkap.</p>}
    </section>}
    <section aria-labelledby="event-results" className="space-y-4">
      <h2 id="event-results" className="text-balance font-semibold text-foreground">Hasil per event ({data.totalEvents})</h2>
      <p className="text-sm text-foreground">Hanya event dengan penjualan sesuai filter. Urutan omzet bersih terbesar; ringkasan mencakup semua halaman.</p>
      {!data.rows.length && <div className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm text-foreground"><p>{data.totalEvents ? "Halaman ini berada di luar hasil laporan." : "Belum ada penjualan event yang cocok. Sesuaikan tanggal/filter, atau pastikan sesi penjualan terhubung ke event."}</p><Link href={`${route}?${query({ page: 1 })}`} className={link}>Buka halaman pertama</Link></div>}
      {data.rows.map(row => <article key={row.id} className="min-w-0 rounded-xl border border-border bg-card p-5">
        <h3 className="break-words text-balance font-semibold text-foreground"><Link href={`${route}?${query({ eventId: row.id, page: 1 })}`} className="block min-h-11 max-w-full break-words py-2 underline underline-offset-4 [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground">{row.event?.name ?? `Event #${row.id}`} · {row.event?.code ?? row.id}</Link></h3>
        <p className="break-words text-xl font-semibold tabular-nums text-foreground">{formatRupiah(row.metrics.netSales)} bersih</p><Metrics metrics={row.metrics} compact />
      </article>)}
      <nav aria-label="Halaman laporan event" className="flex flex-wrap items-center gap-3 text-sm text-foreground">
        {f.page > 1 && <Link href={`${route}?${query({ page: f.page - 1 })}`} className={link}>Sebelumnya</Link>}
        <span>Halaman {f.page} / {Math.max(1, Math.ceil(data.totalEvents / data.pageSize))}</span>
        {f.page * data.pageSize < data.totalEvents && <Link href={`${route}?${query({ page: f.page + 1 })}`} className={link}>Berikutnya</Link>}
      </nav>
    </section>
    {f.eventId && <>
      <section aria-labelledby="event-cashiers" className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 id="event-cashiers" className="text-balance font-semibold text-foreground">Kontribusi kasir ({data.totalCashiers})</h2>
        <p className="text-sm text-foreground">Pemilik akun sesi, bukan nama kasir bebas. Menampilkan maksimal 25 kasir pertama; laporan kasir menyediakan halaman lanjutan.</p>
        <Link href={`/dashboard/reports/cashiers?${query({ page: 1 })}`} className={link}>Lihat seluruh kasir event</Link>
        {!data.cashierRows.length && <p className="text-sm text-foreground">Belum ada penjualan atau sesi ditutup sesuai filter.</p>}
        {data.cashierRows.map(cashier => <div key={cashier.id} className="border-t border-border pt-3 text-sm text-foreground"><p className="break-words font-semibold">{cashier.name} · #{cashier.id}</p><p>{formatRupiah(cashier.metrics.netSales)} bersih · {cashier.metrics.transactions} transaksi · refund {formatRupiah(cashier.metrics.refunds)}</p></div>)}
      </section>
      <section aria-labelledby="event-days" className="rounded-xl border border-border bg-card p-5">
        <h2 id="event-days" className="text-balance font-semibold text-foreground">Penjualan per hari (WIB)</h2>
        <p className="mt-2 text-sm text-foreground">Hari mengikuti pembayaran order asal. Refund belakangan mengurangi hari penjualan asal; ini bukan arus kas refund harian.</p>
        {!data.days.length && <p className="mt-3 text-sm text-foreground">Belum ada penjualan harian sesuai filter.</p>}
        <div className="mt-4 divide-y divide-border">{data.days.map(day => <div key={day.date} className="flex flex-wrap justify-between gap-3 py-3 text-sm text-foreground"><span>{day.date} · {day.metrics.transactions} transaksi</span><span className="tabular-nums">{formatRupiah(day.metrics.netSales)} bersih · refund {formatRupiah(day.metrics.refunds)}</span></div>)}</div>
      </section>
    </>}
  </div>;
}

function Metrics({ metrics: m, compact = false }: { metrics: CashierReportMetrics; compact?: boolean }) {
  const values = [["Bruto tercatat", formatRupiah(m.grossSales)], ["Diskon promo + manual/voucher", formatRupiah(m.totalDiscounts)], ["Sebelum refund", formatRupiah(m.salesBeforeRefunds)], ["Refund asal", formatRupiah(m.refunds)], ["Transaksi", m.transactions.toLocaleString("id-ID")], ["Unit jual / retur", `${m.itemsSold} / ${m.returnedItems}`], ["Rata-rata sebelum refund", formatRupiah(m.averageTransaction)], ["Sesi penjualan", String(m.salesSessionCount)]];
  return <>
    <dl className="mt-4 grid min-w-0 gap-4 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-4">{values.map(([label, value]) => <div key={label} className="min-w-0 text-sm text-foreground"><dt>{label}</dt><dd className="mt-1 break-words font-semibold tabular-nums">{value}</dd></div>)}</dl>
    {!compact && <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm text-foreground">
      <h3 className="text-balance font-semibold">Pembayaran: penjualan / refund</h3>
      <p>Cash: {formatRupiah(m.cashSales)} / {formatRupiah(m.cashRefunds)}</p><p>QRIS: {formatRupiah(m.qrisSales)} / {formatRupiah(m.qrisRefunds)}</p><p>Transfer: {formatRupiah(m.transferSales)} / {formatRupiah(m.transferRefunds)}</p>
      {m.unknownPaymentSales !== 0 && <p>Metode penjualan belum diketahui: {formatRupiah(m.unknownPaymentSales)}</p>}
      <p>Metode refund ditampilkan terpisah dari metode penjualan. Penjualan bersih bukan selisih kas laci.</p>
    </div>}
  </>;
}
