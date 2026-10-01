import Link from "next/link";
import { getInventoryReport } from "@/app/actions/inventory-report";
import { formatRupiah } from "@/lib/utils";

const movementLabels: Record<string, string> = {
  opening_balance: "Saldo awal", receipt: "Penerimaan", online_sale: "Stok keluar online",
  pos_sale: "Penjualan POS", return: "Stok kembali", transfer_in: "Transfer masuk",
  transfer_out: "Transfer keluar", adjustment: "Penyesuaian",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const value = (params: Record<string, string | string[] | undefined>, key: string) => typeof params[key] === "string" ? params[key] as string : "";
const quantity = (amount: number) => amount.toLocaleString("id-ID");

export default async function InventoryReportPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const report = await getInventoryReport({
    from: value(params, "from"), to: value(params, "to"),
    locationId: Number(value(params, "locationId")), search: value(params, "search"),
    type: value(params, "type"), movementPage: Number(value(params, "movementPage")), stockPage: Number(value(params, "stockPage")),
  });
  if (!report) return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Laporan tidak tersedia. Periksa akses atau rentang tanggal.</div>;

  const { filters, locations } = report;
  const locationNames = new Map(locations.map(item => [item.id, item.name]));
  const selectedLocations = filters.locationId ? locations.filter(item => item.id === filters.locationId) : locations;
  const stockSummary = report.stockByLocation.filter(item => !filters.locationId || item.locationId === filters.locationId);
  const stockUnits = stockSummary.reduce((sum, item) => sum + item.quantity, 0);
  const availableUnits = stockSummary.reduce((sum, item) => sum + item.quantity - item.reserved, 0);
  const lowStock = stockSummary.reduce((sum, item) => sum + item.lowStock, 0);
  const outOfStock = stockSummary.reduce((sum, item) => sum + item.outOfStock, 0);
  const movementUnits = new Map(report.movementByType.map(item => [item.type, item.units]));
  const externalReceipts = report.receiptOrigins.find(item => item.sourceType === "external")?.units ?? 0;
  const unknownReceipts = report.receiptOrigins.find(item => item.sourceType === null)?.units ?? 0;
  const sales = report.salesRows.reduce((sum, item) => sum + item.revenue, 0);
  const refunds = report.refundRows.reduce((sum, item) => sum + item.amount, 0);
  const grossSoldUnits = report.soldUnitsRows.reduce((sum, item) => sum + item.units, 0);
  const returnedUnits = report.returnedItems.reduce((sum, item) => sum + item.units, 0);
  const query = (overrides: Record<string, string | number>) => {
    const next = new URLSearchParams({ from: filters.from, to: filters.to });
    if (filters.locationId) next.set("locationId", String(filters.locationId));
    if (filters.search) next.set("search", filters.search);
    if (filters.type) next.set("type", filters.type);
    if (filters.movementPage > 1) next.set("movementPage", String(filters.movementPage));
    if (filters.stockPage > 1) next.set("stockPage", String(filters.stockPage));
    for (const [key, item] of Object.entries(overrides)) next.set(key, String(item));
    return `/dashboard/inventory/report?${next}`;
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-xl font-bold text-foreground md:text-2xl">Laporan Inventory</h1><p className="mt-1 text-sm text-muted-foreground">Stok per lokasi, arus barang, dan penjualan yang sudah dibayar.</p></div>
      <Link href="/dashboard/inventory" className="rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-accent">Kelola stok</Link>
    </div>

    <form action="/dashboard/inventory/report" className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr_1.5fr_1.3fr_auto]">
      <label className="text-xs font-semibold text-muted-foreground">Dari tanggal<input type="date" name="from" defaultValue={filters.from} className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
      <label className="text-xs font-semibold text-muted-foreground">Sampai tanggal<input type="date" name="to" defaultValue={filters.to} className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
      <label className="text-xs font-semibold text-muted-foreground">Lokasi<select name="locationId" defaultValue={filters.locationId} className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value={0}>Semua lokasi</option>{locations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-xs font-semibold text-muted-foreground">Cari stok / mutasi<input name="search" defaultValue={filters.search} placeholder="Produk, SKU, warna" className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label>
      <label className="text-xs font-semibold text-muted-foreground">Jenis mutasi<select name="type" defaultValue={filters.type} className="mt-1 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"><option value="">Semua jenis</option>{Object.entries(movementLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button className="self-end rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Tampilkan</button>
    </form>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan inventori">
      <Metric label="Stok tercatat saat ini" value={`${quantity(stockUnits)} unit`} detail={`${quantity(availableUnits)} tersedia setelah reservasi`} />
      <Metric label="Unit terjual (bruto)" value={`${quantity(grossSoldUnits)} unit`} detail={`Retur ${quantity(returnedUnits)} unit pada periode ini`} />
      <Metric label="Omzet bersih" value={formatRupiah(sales - refunds)} detail={`Penjualan ${formatRupiah(sales)} · refund ${formatRupiah(refunds)}`} />
      <Metric label="Perlu perhatian" value={`${quantity(lowStock)} menipis`} detail={`${quantity(outOfStock)} baris stok habis`} />
    </section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Arus stok">
      <Metric label="Masuk dari luar" value={`${quantity(externalReceipts)} unit`} detail={`${quantity(unknownReceipts)} unit penerimaan lama tanpa asal tercatat`} />
      <Metric label="Transfer masuk / keluar" value={`${quantity(movementUnits.get("transfer_in") ?? 0)} / ${quantity(Math.abs(movementUnits.get("transfer_out") ?? 0))} unit`} />
      <Metric label="Stok keluar POS / online" value={`${quantity(Math.abs(movementUnits.get("pos_sale") ?? 0))} / ${quantity(Math.abs(movementUnits.get("online_sale") ?? 0))} unit`} detail="Online termasuk order menunggu pembayaran yang stoknya telah dikurangi" />
      <Metric label="Stok kembali / penyesuaian" value={`${quantity(movementUnits.get("return") ?? 0)} / ${quantity(movementUnits.get("adjustment") ?? 0)} unit`} detail="Stok kembali termasuk order online batal dan retur yang direstok" />
    </section>

    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4"><h2 className="font-semibold">Rekap per lokasi</h2><p className="text-xs text-muted-foreground">Stok adalah posisi saat ini; penjualan dan refund mengikuti tanggal pembayaran/refund pada periode.</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3 text-left">Lokasi</th><th className="px-4 py-3 text-right">Stok tercatat</th><th className="px-4 py-3 text-right">Tersedia</th><th className="px-4 py-3 text-right">Unit terjual</th><th className="px-4 py-3 text-right">Order POS</th><th className="px-4 py-3 text-right">Omzet bersih</th><th className="px-4 py-3 text-right">Menipis / habis</th></tr></thead><tbody className="divide-y divide-border">{selectedLocations.map(location => {
        const stock = report.stockByLocation.find(item => item.locationId === location.id);
        const salesAtLocation = report.salesRows.filter(item => item.locationId === location.id);
        const refund = report.refundRows.find(item => item.locationId === location.id)?.amount ?? 0;
        return <tr key={location.id}><td className="px-4 py-3 font-medium">{location.name}<span className="ml-2 text-xs text-muted-foreground">{location.code}</span></td><td className="px-4 py-3 text-right">{quantity(stock?.quantity ?? 0)}</td><td className="px-4 py-3 text-right">{quantity((stock?.quantity ?? 0) - (stock?.reserved ?? 0))}</td><td className="px-4 py-3 text-right">{quantity(report.soldUnitsRows.find(item => item.locationId === location.id)?.units ?? 0)}</td><td className="px-4 py-3 text-right">{quantity(salesAtLocation.filter(item => item.channel === "pos").reduce((sum, item) => sum + item.orders, 0))}</td><td className="px-4 py-3 text-right font-semibold">{formatRupiah(salesAtLocation.reduce((sum, item) => sum + item.revenue, 0) - refund)}</td><td className="px-4 py-3 text-right">{quantity(stock?.lowStock ?? 0)} / {quantity(stock?.outOfStock ?? 0)}</td></tr>;
      })}</tbody></table></div>
    </section>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">Alur transfer</h2><p className="mb-3 text-xs text-muted-foreground">Perpindahan antar lokasi dalam periode ini; tidak menambah total stok usaha.</p><div className="space-y-2">{report.transferFlows.length ? report.transferFlows.map(item => <div key={`${item.fromLocationId}:${item.toLocationId}`} className="flex justify-between gap-3 border-b border-border pb-2 text-sm"><span>{locationNames.get(item.fromLocationId) ?? `#${item.fromLocationId}`} → {locationNames.get(item.toLocationId) ?? `#${item.toLocationId}`}</span><strong>{quantity(item.units)} unit</strong></div>) : <p className="text-sm text-muted-foreground">Belum ada transfer.</p>}</div></section>
      <section className="rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">Produk paling banyak terjual</h2><p className="mb-3 text-xs text-muted-foreground">Unit dari order yang sudah dibayar; sebelum retur.</p><div className="space-y-2">{report.soldItems.slice(0, 10).length ? report.soldItems.slice(0, 10).map((item, index) => <div key={`${item.locationId}:${item.productId}:${item.variantId ?? 0}:${index}`} className="flex justify-between gap-3 border-b border-border pb-2 text-sm"><span className="min-w-0 truncate">{item.productName}{item.variantLabel ? ` · ${item.variantLabel}` : ""}<span className="block text-xs text-muted-foreground">{locationNames.get(item.locationId) ?? "Lokasi tidak diketahui"}</span></span><strong>{quantity(item.units)} unit</strong></div>) : <p className="text-sm text-muted-foreground">Belum ada penjualan.</p>}</div></section>
    </div>

    <section className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4"><div><h2 className="font-semibold">Stok per produk dan lokasi</h2><p className="text-xs text-muted-foreground">{quantity(report.stockTotal)} baris; tersedia = fisik − reservasi.</p></div><Pager current={filters.stockPage} total={report.stockTotal} size={report.pageSize} href={page => query({ stockPage: page })} /></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3 text-left">Produk / varian</th><th className="px-4 py-3 text-left">Lokasi</th><th className="px-4 py-3 text-right">Tercatat</th><th className="px-4 py-3 text-right">Reservasi</th><th className="px-4 py-3 text-right">Tersedia</th></tr></thead><tbody className="divide-y divide-border">{report.stockRows.map(item => <tr key={`${item.locationId}:${item.productId}:${item.variantId ?? 0}`}><td className="px-4 py-3"><p className="font-medium">{item.productName}</p>{item.variantId && <p className="text-xs text-muted-foreground">{item.size} / {item.color}{item.sku ? ` · ${item.sku}` : ""}</p>}</td><td className="px-4 py-3">{locationNames.get(item.locationId) ?? "—"}</td><td className="px-4 py-3 text-right">{quantity(item.quantity)}</td><td className="px-4 py-3 text-right">{quantity(item.reserved)}</td><td className={`px-4 py-3 text-right font-semibold ${item.quantity - item.reserved <= 5 ? "text-amber-700" : ""}`}>{quantity(item.quantity - item.reserved)}</td></tr>)}{!report.stockRows.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Tidak ada stok sesuai filter.</td></tr>}</tbody></table></div>
    </section>

    <section className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4"><div><h2 className="font-semibold">Riwayat mutasi</h2><p className="text-xs text-muted-foreground">{quantity(report.movementTotal)} baris sesuai filter; ditampilkan per 50 baris.</p></div><Pager current={filters.movementPage} total={report.movementTotal} size={report.pageSize} href={page => query({ movementPage: page })} /></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3 text-left">Waktu</th><th className="px-4 py-3 text-left">Lokasi</th><th className="px-4 py-3 text-left">Produk</th><th className="px-4 py-3 text-left">Jenis / referensi</th><th className="px-4 py-3 text-right">Mutasi</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3 text-left">Pelaksana</th></tr></thead><tbody className="divide-y divide-border">{report.movementRows.map(item => <tr key={item.id}><td className="whitespace-nowrap px-4 py-3 text-xs">{item.createdAt ? new Date(item.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" }) : "—"}</td><td className="px-4 py-3">{locationNames.get(item.locationId) ?? "—"}</td><td className="px-4 py-3"><p className="font-medium">{item.productName}</p>{item.variantId && <p className="text-xs text-muted-foreground">{item.size} / {item.color}{item.sku ? ` · ${item.sku}` : ""}</p>}</td><td className="px-4 py-3">{item.type === "receipt" ? item.receiptSourceType === "external" ? "Penerimaan luar" : "Penerimaan (asal tidak tercatat)" : movementLabels[item.type] ?? item.type}{item.referenceType === "inventory_receipt" && item.referenceId ? <Link href={`/dashboard/inventory/history/${item.referenceId}`} className="block text-xs text-primary hover:underline">Dokumen #{item.referenceId}</Link> : item.referenceType === "order" && item.referenceId ? <Link href={`/dashboard/orders/${item.referenceId}`} className="block text-xs text-primary hover:underline">Order #{item.referenceId}</Link> : item.referenceId ? <span className="block text-xs text-muted-foreground">#{item.referenceId}</span> : null}{item.notes && <p className="max-w-40 truncate text-xs text-muted-foreground" title={item.notes}>{item.notes}</p>}</td><td className={`px-4 py-3 text-right font-semibold ${item.quantityDelta < 0 ? "text-rose-700" : "text-emerald-700"}`}>{item.quantityDelta > 0 ? "+" : ""}{quantity(item.quantityDelta)}</td><td className="px-4 py-3 text-right">{quantity(item.balanceAfter)}</td><td className="px-4 py-3">{item.actorName ?? "Sistem"}</td></tr>)}{!report.movementRows.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Tidak ada mutasi sesuai filter.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-bold text-foreground">{value}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>;
}

function Pager({ current, total, size, href }: { current: number; total: number; size: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <div className="flex items-center gap-2 text-xs"><Link aria-disabled={current <= 1} href={href(Math.max(1, current - 1))} className={`rounded-md border border-border px-2 py-1 ${current <= 1 ? "pointer-events-none opacity-50" : "hover:bg-accent"}`}>Sebelumnya</Link><span>{current} / {pages}</span><Link aria-disabled={current >= pages} href={href(Math.min(pages, current + 1))} className={`rounded-md border border-border px-2 py-1 ${current >= pages ? "pointer-events-none opacity-50" : "hover:bg-accent"}`}>Berikutnya</Link></div>;
}
