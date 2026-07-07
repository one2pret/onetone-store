// app/(admin)/dashboard/pos/sessions/page.tsx
// Admin: list semua sesi kasir POS.

import Link from "next/link";
import { getAllPosSessions } from "@/app/actions/pos-sessions";
import { formatRupiah } from "@/lib/utils";
import { Calculator, ChevronRight, CircleDot, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PosSessionsPage() {
  const sessions = await getAllPosSessions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Sesi Kasir POS</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {sessions.length} sesi total
          </p>
        </div>
        <Link
          href="/pos"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg shadow-sm hover:bg-primary/90 transition"
        >
          <Calculator className="w-4 h-4" />
          Buka Kasir
        </Link>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {sessions.length === 0 ? (
          <div className="py-16 text-center">
            <Calculator className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Belum ada sesi kasir</p>
            <Link href="/pos" className="text-primary hover:opacity-80 text-sm font-medium mt-2 inline-block">
              Buka sesi pertama
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table header */}
            <div className="hidden md:grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Status</span>
              <span>Sesi</span>
              <span>Kasir</span>
              <span>Modal Awal</span>
              <span>Total Penjualan</span>
              <span>Selisih Kas</span>
              <span className="sr-only">Aksi</span>
            </div>

            <div className="divide-y divide-border">
              {sessions.map((s) => {
                const isOpen = s.status === "open";
                const opened = s.openedAt ? new Date(s.openedAt) : null;
                const closed = s.closedAt ? new Date(s.closedAt) : null;
                const diff = s.cashDifference !== null ? Number(s.cashDifference) : null;

                return (
                  <Link
                    key={s.id}
                    href={`/dashboard/pos/sessions/${s.id}`}
                    className="flex flex-col md:grid md:grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_auto] gap-3 md:gap-4 md:items-center px-4 md:px-6 py-4 hover:bg-muted/20 transition"
                  >
                    {/* Status */}
                    <div className="flex items-center gap-2">
                      {isOpen ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                          <CircleDot className="w-3 h-3 animate-pulse" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                          <CheckCircle2 className="w-3 h-3" />
                          Ditutup
                        </span>
                      )}
                    </div>

                    {/* Sesi */}
                    <div>
                      <p className="font-semibold text-foreground text-sm">Sesi #{s.id}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {opened && opened.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                        {closed && ` → ${closed.toLocaleString("id-ID", { timeStyle: "short" })}`}
                      </p>
                    </div>

                    {/* Kasir */}
                    <div className="text-sm text-muted-foreground">
                      {s.cashierName ?? `User #${s.cashierId}`}
                    </div>

                    {/* Modal awal */}
                    <div className="text-sm">
                      <span className="md:hidden text-xs text-muted-foreground">Modal: </span>
                      {formatRupiah(Number(s.openingCash))}
                    </div>

                    {/* Total penjualan */}
                    <div className="text-sm">
                      <span className="md:hidden text-xs text-muted-foreground">Penjualan: </span>
                      <span className="font-semibold text-foreground">{formatRupiah(s.totalSales)}</span>
                      <span className="text-[11px] text-muted-foreground ml-1">
                        ({s.transactions} tx)
                      </span>
                    </div>

                    {/* Selisih */}
                    <div className="text-sm">
                      {isOpen ? (
                        <span className="text-muted-foreground italic">—</span>
                      ) : diff === null ? (
                        <span className="text-muted-foreground italic">—</span>
                      ) : diff === 0 ? (
                        <span className="text-emerald-600 font-medium">Cocok</span>
                      ) : diff > 0 ? (
                        <span className="text-amber-600 font-medium">+{formatRupiah(diff)}</span>
                      ) : (
                        <span className="text-rose-600 font-medium">{formatRupiah(diff)}</span>
                      )}
                    </div>

                    {/* Aksi */}
                    <ChevronRight className="hidden md:block w-4 h-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
