"use client";

// components/pos/CloseSessionForm.tsx
// Z-report + input uang tunai fisik → hitung selisih → tutup sesi.
// Filosofi: transparansi audit — kasir input berapa uang fisik di laci,
// sistem hitung expected (opening + cash sales), tampilkan selisih.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Banknote, QrCode, ArrowRightLeft, ArrowLeft, Receipt,
  Wallet, TrendingUp, AlertCircle, CheckCircle2,
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { closeSession } from "@/app/actions/pos-sessions";
import type { PosSession } from "@/lib/db/schema";

interface Summary {
  session: PosSession;
  breakdown: {
    cash: { total: number; count: number };
    qris: { total: number; count: number };
    transfer: { total: number; count: number };
  };
  totalSales: number;
  totalTransactions: number;
  openingCash: number;
  expectedCash: number;
}

interface Props {
  summary: Summary;
}

export function CloseSessionForm({ summary }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [closingCash, setClosingCash] = useState<string>("");
  const [notes, setNotes] = useState("");

  const closingCashNum = Number(closingCash) || 0;
  const cashDifference = useMemo(
    () => closingCashNum - summary.expectedCash,
    [closingCashNum, summary.expectedCash]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (closingCash === "") {
      toast.error("Masukkan hitungan uang tunai fisik");
      return;
    }
    startTransition(async () => {
      const result = await closeSession({
        sessionId: summary.session.id,
        closingCash: closingCashNum,
        notes: notes || undefined,
      });
      if (result.success) {
        toast.success("Sesi kasir ditutup");
        router.push("/pos");
      } else {
        toast.error(result.error ?? "Gagal tutup sesi");
      }
    });
  }

  const openedAt = summary.session.openedAt
    ? new Date(summary.session.openedAt)
    : null;

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-slate-900">Tutup Sesi Kasir</h1>
          <p className="text-xs text-slate-500">
            Sesi #{summary.session.id}
            {openedAt && ` • Dibuka ${openedAt.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}`}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-32 max-w-2xl w-full mx-auto space-y-4">
        {/* Z-Report */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-slate-900">Ringkasan Sesi (Z-Report)</h2>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <MetricCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Total Transaksi"
              value={String(summary.totalTransactions)}
              color="bg-blue-50 text-blue-700"
            />
            <MetricCard
              icon={<Wallet className="w-4 h-4" />}
              label="Total Penjualan"
              value={formatRupiah(summary.totalSales)}
              color="bg-emerald-50 text-emerald-700"
            />
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
              Rincian per Metode
            </p>
            <BreakdownRow
              icon={<Banknote className="w-4 h-4" />}
              label="Tunai"
              total={summary.breakdown.cash.total}
              count={summary.breakdown.cash.count}
            />
            <BreakdownRow
              icon={<QrCode className="w-4 h-4" />}
              label="QRIS"
              total={summary.breakdown.qris.total}
              count={summary.breakdown.qris.count}
            />
            <BreakdownRow
              icon={<ArrowRightLeft className="w-4 h-4" />}
              label="Transfer"
              total={summary.breakdown.transfer.total}
              count={summary.breakdown.transfer.count}
            />
          </div>
        </section>

        {/* Cash reconciliation */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Rekonsiliasi Kas</h2>

          <div className="space-y-2 mb-5">
            <ReconciliationRow
              label="Modal Awal"
              value={summary.openingCash}
              hint="Uang di laci saat buka sesi"
            />
            <ReconciliationRow
              label="+ Penjualan Tunai"
              value={summary.breakdown.cash.total}
              hint={`${summary.breakdown.cash.count} transaksi`}
            />
            <div className="border-t border-slate-200 pt-2">
              <ReconciliationRow
                label="Kas Seharusnya"
                value={summary.expectedCash}
                bold
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="closingCash"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Hitungan Uang Tunai Fisik
              </label>
              <input
                id="closingCash"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Hitung uang di laci, lalu masukkan di sini"
                className="w-full px-4 py-3 text-lg font-semibold bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
                required
              />
              {closingCash !== "" && (
                <p className="mt-1.5 text-xs text-slate-500">
                  {formatRupiah(closingCashNum)}
                </p>
              )}
            </div>

            {/* Difference indicator */}
            {closingCash !== "" && (
              <div
                className={
                  "rounded-xl p-4 flex items-center gap-3 " +
                  (cashDifference === 0
                    ? "bg-emerald-50 border border-emerald-200"
                    : cashDifference > 0
                      ? "bg-amber-50 border border-amber-200"
                      : "bg-rose-50 border border-rose-200")
                }
              >
                {cashDifference === 0 ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle
                    className={
                      "w-6 h-6 shrink-0 " +
                      (cashDifference > 0 ? "text-amber-600" : "text-rose-600")
                    }
                  />
                )}
                <div className="flex-1">
                  <p
                    className={
                      "text-sm font-semibold " +
                      (cashDifference === 0
                        ? "text-emerald-800"
                        : cashDifference > 0
                          ? "text-amber-800"
                          : "text-rose-800")
                    }
                  >
                    {cashDifference === 0
                      ? "Kas Cocok"
                      : cashDifference > 0
                        ? `Lebih ${formatRupiah(cashDifference)}`
                        : `Kurang ${formatRupiah(Math.abs(cashDifference))}`}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Selisih: {formatRupiah(cashDifference)}
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Catatan (opsional)
              </label>
              <textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition resize-none"
                placeholder="Misal: selisih karena kembalian, dll"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isPending || closingCash === ""}
              className="w-full py-3.5 bg-primary text-primary-foreground font-semibold rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isPending ? "Menutup Sesi..." : "Tutup Sesi Kasir"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-3 bg-slate-50 rounded-xl">
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${color}`}>
        {icon}
        {label}
      </div>
      <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function BreakdownRow({
  icon,
  label,
  total,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  total: number;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white text-slate-600 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-800">{label}</p>
          <p className="text-[11px] text-slate-500">{count} transaksi</p>
        </div>
      </div>
      <p className="text-sm font-bold text-slate-900">{formatRupiah(total)}</p>
    </div>
  );
}

function ReconciliationRow({
  label,
  value,
  hint,
  bold,
}: {
  label: string;
  value: number;
  hint?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className={"text-sm " + (bold ? "font-bold text-slate-900" : "text-slate-600")}>
          {label}
        </p>
        {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      </div>
      <p className={"text-sm tabular-nums " + (bold ? "font-bold text-slate-900" : "font-semibold text-slate-700")}>
        {formatRupiah(value)}
      </p>
    </div>
  );
}
