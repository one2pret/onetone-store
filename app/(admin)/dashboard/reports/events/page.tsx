import Link from "next/link";
import { getSalesEventsAdminData } from "@/app/actions/sales-events";
import { SalesEventForm } from "../_components/SalesEventForm";
import { SALES_EVENT_LABELS } from "@/lib/sales-events";

export const dynamic = "force-dynamic";
const dateLabel = (value: Date) => value.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
const linkClass = "inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function SalesEventsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const data = await getSalesEventsAdminData(params.page === undefined ? 1 : Number(params.page));
  if (!data) return <div role="alert" className="space-y-3 rounded-xl border border-border bg-card p-5"><h1 className="font-semibold text-foreground">Daftar event tidak dapat ditampilkan</h1><Link href="/dashboard/reports/events" className={linkClass}>Buka halaman pertama</Link></div>;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return <div className="min-w-0 space-y-6">
    <header>
      <Link href="/dashboard/reports" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Kembali ke laporan</Link>
      <h1 className="text-balance text-xl font-bold text-foreground md:text-2xl">Sales Event / Bazaar</h1>
      <p className="mt-1 text-sm text-muted-foreground">Siapkan acara penjualan dan hubungkan sesi POS saat kasir membuka sesi.</p>
      <Link href="/dashboard/reports/events/sales" className={`${linkClass} mt-3`}>Lihat laporan omzet event</Link>
    </header>
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 font-semibold text-foreground">Buat event</h2>
      <SalesEventForm locations={data.locations} />
    </section>
    <p className="text-sm text-muted-foreground">Event aktif hanya dapat dipilih saat periode berlangsung. Periode membatasi pembukaan sesi baru; sesi yang sudah dibuka tetap berjalan sampai ditutup. Selesaikan semua sesi sebelum mengubah status menjadi Selesai atau Dibatalkan. Sesi reguler tidak wajib memakai event.</p>
    <section className="space-y-4" aria-labelledby="event-list">
      <h2 id="event-list" className="font-semibold text-foreground">Event tercatat ({data.total.toLocaleString("id-ID")})</h2>
      {!data.events.length && <div className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground"><p>{data.total ? "Tidak ada event di halaman ini. Buka halaman pertama." : "Belum ada event. Buat event melalui form di atas; kasir tetap bisa menjalankan penjualan reguler."}</p>{data.total > 0 && <Link href="/dashboard/reports/events" className={linkClass}>Buka halaman pertama</Link>}</div>}
      {data.events.map(row => <article key={row.event.id} className="min-w-0 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><h3 className="break-words font-semibold text-foreground">{row.event.name}</h3><p className="mt-1 text-xs text-muted-foreground">{row.event.code} · {SALES_EVENT_LABELS[row.event.status]}</p></div>
          <p className="text-sm text-muted-foreground">{row.sessionCount} sesi · {row.openSessions} aktif</p>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{dateLabel(row.event.startsAt)} sampai {dateLabel(row.event.endsAt)} WIB</p>
        <p className="mt-1 text-sm text-muted-foreground">Venue: {row.event.venueName ?? "Belum diisi"} · Stok default: {row.locationName ?? "Dipilih kasir"}</p>
        <details className="mt-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{row.event.status === "closed" || row.event.status === "cancelled" ? "Lihat detail" : "Kelola detail dan status"}</summary>
          <div className="mt-4"><SalesEventForm event={row.event} used={row.sessionCount > 0} locations={data.locations} /></div>
        </details>
      </article>)}
      <nav aria-label="Halaman daftar event" className="flex flex-wrap items-center gap-3">
        {data.page > 1 && <Link href={`/dashboard/reports/events?page=${data.page - 1}`} className={linkClass}>Sebelumnya</Link>}
        <span className="text-sm text-muted-foreground">Halaman {data.page} / {pages}</span>
        {data.page < pages && <Link href={`/dashboard/reports/events?page=${data.page + 1}`} className={linkClass}>Berikutnya</Link>}
      </nav>
    </section>
  </div>;
}
