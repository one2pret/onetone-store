"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSalesEvent, updateSalesEvent } from "@/app/actions/sales-events";
import type { salesEvents } from "@/lib/db/schema";
import { SALES_EVENT_LABELS, SALES_EVENT_STATUSES, salesEventCanTransition, salesEventLocalDate, type SalesEventInput } from "@/lib/sales-events";

type Event = typeof salesEvents.$inferSelect;
type Location = { id: number; name: string; code: string; isActive: boolean };
const fieldClass = "mt-1.5 block min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SalesEventForm({ event, used = false, locations }: { event?: Event; used?: boolean; locations: Location[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const frozen = used || event?.status === "closed" || event?.status === "cancelled";
  const terminal = event?.status === "closed" || event?.status === "cancelled";
  const prefix = event ? `event-${event.id}` : "new-event";

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const values: SalesEventInput = {
      code: frozen && event ? event.code : String(data.get("code") ?? ""),
      name: frozen && event ? event.name : String(data.get("name") ?? ""),
      startsAt: frozen && event ? salesEventLocalDate(event.startsAt) : String(data.get("startsAt") ?? ""),
      endsAt: frozen && event ? salesEventLocalDate(event.endsAt) : String(data.get("endsAt") ?? ""),
      venueName: frozen && event ? event.venueName ?? "" : String(data.get("venueName") ?? ""),
      inventoryLocationId: frozen && event ? event.inventoryLocationId : data.get("inventoryLocationId") ? Number(data.get("inventoryLocationId")) : null,
      notes: frozen && event ? event.notes ?? "" : String(data.get("notes") ?? ""),
      status: String(data.get("status")) as SalesEventInput["status"],
    };
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        const result = event ? await updateSalesEvent(event.id, values) : await createSalesEvent(values);
        if (!result.success) { setError(result.error); return; }
        if (!event) form.reset();
        setSaved(true);
        router.refresh();
      } catch {
        setError("Event belum dapat disimpan. Periksa koneksi lalu coba lagi.");
      }
    });
  }

  return <form onSubmit={submit} className="space-y-4">
    {used && <p className="text-sm text-muted-foreground">Detail terkunci karena sudah dipakai sesi POS. Untuk event berbeda, buat event dan sesi baru.</p>}
    <fieldset disabled={frozen || pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label htmlFor={`${prefix}-code`} className="text-sm font-medium text-foreground">Kode event<input id={`${prefix}-code`} name="code" required minLength={2} maxLength={50} defaultValue={event?.code ?? ""} placeholder="Kode unik event" className={fieldClass} /></label>
      <label htmlFor={`${prefix}-name`} className="text-sm font-medium text-foreground">Nama event<input id={`${prefix}-name`} name="name" required minLength={3} maxLength={150} defaultValue={event?.name ?? ""} className={fieldClass} /></label>
      <label htmlFor={`${prefix}-start`} className="text-sm font-medium text-foreground">Mulai (WIB)<input id={`${prefix}-start`} name="startsAt" type="datetime-local" step={1} required defaultValue={event ? salesEventLocalDate(event.startsAt) : ""} className={fieldClass} /></label>
      <label htmlFor={`${prefix}-end`} className="text-sm font-medium text-foreground">Selesai (WIB)<input id={`${prefix}-end`} name="endsAt" type="datetime-local" step={1} required defaultValue={event ? salesEventLocalDate(event.endsAt) : ""} className={fieldClass} /></label>
      <label htmlFor={`${prefix}-venue`} className="text-sm font-medium text-foreground">Venue (opsional)<input id={`${prefix}-venue`} name="venueName" maxLength={150} defaultValue={event?.venueName ?? ""} className={fieldClass} /></label>
      <label htmlFor={`${prefix}-location`} className="text-sm font-medium text-foreground">Lokasi stok default<select id={`${prefix}-location`} name="inventoryLocationId" defaultValue={event?.inventoryLocationId ?? ""} className={fieldClass}>
        <option value="">Kasir memilih lokasi stok</option>
        {locations.map(location => <option key={location.id} value={location.id} disabled={!location.isActive}>{location.name} · {location.code}{!location.isActive ? " (nonaktif)" : ""}</option>)}
      </select></label>
      <label htmlFor={`${prefix}-notes`} className="text-sm font-medium text-foreground sm:col-span-2">Catatan (opsional)<textarea id={`${prefix}-notes`} name="notes" maxLength={500} rows={2} defaultValue={event?.notes ?? ""} className={`${fieldClass} py-2`} /></label>
    </fieldset>
    <label htmlFor={`${prefix}-status`} className="block text-sm font-medium text-foreground">Status<select id={`${prefix}-status`} name="status" defaultValue={event?.status ?? "draft"} disabled={terminal || pending} className={fieldClass}>
      {SALES_EVENT_STATUSES.filter(status => event ? salesEventCanTransition(event.status, status) : status === "draft" || status === "active").map(status => <option key={status} value={status}>{SALES_EVENT_LABELS[status]}</option>)}
    </select></label>
    {error && <p role="alert" className="text-sm text-foreground">{error}</p>}
    {saved && <p role="status" className="text-sm text-foreground">{event ? "Event tersimpan." : "Event dibuat. Aktifkan dan pastikan periode berlangsung agar dapat dipilih di POS."}</p>}
    {!terminal && <button type="submit" disabled={pending} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">{pending ? "Menyimpan..." : event ? "Simpan event" : "Buat event"}</button>}
  </form>;
}
