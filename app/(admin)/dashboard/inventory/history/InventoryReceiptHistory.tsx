"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileClock, Search } from "lucide-react";

type Receipt = Awaited<ReturnType<typeof import("@/app/actions/inventory-workspace").getMyInventoryReceiptHistory>>[number];

export function InventoryReceiptHistory({ history }: { history: Receipt[] }) {
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState(0);
  const [date, setDate] = useState("");
  const locations = useMemo(() => Array.from(new Map(history.map(item => [item.locationId, item.locationName])).entries()), [history]);
  const filtered = useMemo(() => history.filter(item => {
    const haystack = `${item.receiptNumber} ${item.referenceNumber ?? ""} ${item.locationName} ${item.notes ?? ""}`.toLowerCase();
    const dateKey = item.createdAt ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(item.createdAt)) : "";
    return (!search || haystack.includes(search.toLowerCase())) && (!locationId || item.locationId === locationId) && (!date || dateKey === date);
  }), [date, history, locationId, search]);

  return <div className="overflow-hidden rounded-xl border border-border bg-card">
    <div className="grid gap-2 border-b border-border p-4 md:grid-cols-[minmax(0,1fr)_220px_180px]">
      <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nomor dokumen atau referensi" className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" /></label>
      <select value={locationId} onChange={event => setLocationId(Number(event.target.value))} className="h-9 rounded-lg border border-border bg-background px-3 text-sm"><option value={0}>Semua lokasi</option>{locations.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <input type="date" value={date} onChange={event => setDate(event.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm" />
    </div>
    {filtered.length === 0 ? <div className="px-4 py-16 text-center"><FileClock className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-3 text-sm text-muted-foreground">Belum ada riwayat penerimaan yang sesuai.</p></div> : <div className="divide-y divide-border">{filtered.map(item => <Link key={item.id} href={`/dashboard/inventory/history/${item.id}`} className="grid gap-2 p-4 transition hover:bg-accent/50 md:grid-cols-[minmax(180px,1fr)_minmax(160px,1fr)_120px_160px] md:items-center">
      <div><p className="font-mono text-sm font-semibold text-foreground">{item.receiptNumber}</p><p className="text-xs text-muted-foreground">{item.referenceNumber || "Tanpa referensi"}</p></div>
      <div><p className="text-sm font-medium text-foreground">{item.locationName}</p><p className="text-xs text-muted-foreground">{item.locationCode}</p></div>
      <p className="text-sm text-foreground">{item.itemCount} item · <strong>{item.totalQuantity}</strong> unit</p>
      <p className="text-xs text-muted-foreground md:text-right">{item.createdAt ? new Date(item.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }) : "-"}</p>
    </Link>)}</div>}
  </div>;
}
