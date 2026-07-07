// app/(admin)/dashboard/pos/sessions/[id]/page.tsx
// Detail sesi kasir + Z-report + daftar transaksi.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getPosSessionDetail } from "@/app/actions/pos-sessions";
import { formatRupiah } from "@/lib/utils";
import {
  ArrowLeft, Banknote, QrCode, ArrowRightLeft, Receipt,
  Wallet, TrendingUp, CircleDot, CheckCircle2, User,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
  transfer: "Transfer",
};

export default async function PosSessionDetailPage({ params }: Props) {
  const { id } = await params;
  const sessionId = Number(id);
  if (Number.isNaN(sessionId)) notFound();

  const detail = await getPosSessionDetail(sessionId);
  if (!detail) notFound();

  const isOpen = detail.session.status === "open";
  const openedAt = detail.session.openedAt ? new Date(detail.session.openedAt) : null;
  const closedAt = detail.session.closedAt ? new Date(detail.session.closedAt) : null;
  const closingCash = detail.session.closingCash ? Number(detail.session.closingCash) : null;
  const cashDifference = detail.session.cashDifference ? Number(detail.session.cashDifference) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/pos/sessions"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            Sesi Kasir #{detail.session.id}
          </h1>
          {isOpen ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
              <CircleDot className="w-3 h-3 animate-pulse" />
              Aktif
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
              <CheckCircle2 className="w-3 h-3" />
              Ditutup
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          <User className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
          Kasir: {detail.cashier?.name ?? "-"}
          {" · "}
          Dibuka {openedAt?.toLocaleString("id-ID") ?? "-"}
          {closedAt && ` → Ditutup ${closedAt.toLocaleString("id-ID")}`}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* ── Z-Report ── */}
        <div className="md:col-span-2 space-y-6">
          {/* Summary metrics */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Z-Report</h2>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-3 bg-muted/40 rounded-xl">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                  <TrendingUp className="w-3 h-3" />
                  Transaksi
                </div>
                <p className="mt-2 text-xl font-bold text-foreground">{detail.totalTransactions}</p>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                  <Wallet className="w-3 h-3" />
                  Penjualan
                </div>
                <p className="mt-2 text-xl font-bold text-foreground">
                  {formatRupiah(detail.totalSales)}
                </p>
              </div>
            </div>

            {/* Breakdown */}
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Rincian per Metode
            </p>
            <div className="space-y-2">
              <BreakdownRow
                icon={<Banknote className="w-4 h-4" />}
                label="Tunai"
                data={detail.breakdown.cash}
              />
              <BreakdownRow
                icon={<QrCode className="w-4 h-4" />}
                label="QRIS"
                data={detail.breakdown.qris}
              />
              <BreakdownRow
                icon={<ArrowRightLeft className="w-4 h-4" />}
                label="Transfer"
                data={detail.breakdown.transfer}
              />
            </div>
          </div>

          {/* Transactions */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">Daftar Transaksi</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {detail.transactions.length} transaksi di sesi ini
              </p>
            </div>

            {detail.transactions.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Belum ada transaksi
              </div>
            ) : (
              <div className="divide-y divide-border">
                {detail.transactions.map((t) => (
                  <div
                    key={t.id}
                    className="px-5 py-3 flex items-center gap-4 hover:bg-muted/20 transition"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-semibold text-foreground">
                        {t.orderNumber}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.createdAt
                          ? new Date(t.createdAt).toLocaleString("id-ID", {
                              timeStyle: "short",
                            })
                          : "-"}
                        {t.shippingName && ` · ${t.shippingName}`}
                        {" · "}
                        {t.itemCount} item
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">
                        {formatRupiah(Number(t.total))}
                      </p>
                      {t.posPaymentMethod && (
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {PAYMENT_LABELS[t.posPaymentMethod]}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar: Cash reconciliation ── */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-sm p-5">
            <h2 className="font-semibold text-foreground mb-4">Rekonsiliasi Kas</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modal Awal</span>
                <span className="font-medium">{formatRupiah(detail.openingCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">+ Penjualan Tunai</span>
                <span className="font-medium">{formatRupiah(detail.breakdown.cash.total)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold">Kas Seharusnya</span>
                <span className="font-bold">{formatRupiah(detail.expectedCash)}</span>
              </div>
              {closingCash !== null && (
                <>
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-muted-foreground">Uang Fisik</span>
                    <span className="font-medium">{formatRupiah(closingCash)}</span>
                  </div>
                  {cashDifference !== null && (
                    <div
                      className={
                        "flex justify-between items-center px-3 py-2 rounded-lg mt-2 " +
                        (cashDifference === 0
                          ? "bg-emerald-50 text-emerald-800"
                          : cashDifference > 0
                            ? "bg-amber-50 text-amber-800"
                            : "bg-rose-50 text-rose-800")
                      }
                    >
                      <span className="font-semibold text-xs uppercase">Selisih</span>
                      <span className="font-bold">
                        {cashDifference === 0
                          ? "Cocok"
                          : (cashDifference > 0 ? "+" : "") + formatRupiah(cashDifference)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {detail.session.notes && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Catatan
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {detail.session.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({
  icon,
  label,
  data,
}: {
  icon: React.ReactNode;
  label: string;
  data: { total: number; count: number };
}) {
  return (
    <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-background text-muted-foreground flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground">{data.count} transaksi</p>
        </div>
      </div>
      <p className="text-sm font-bold text-foreground">{formatRupiah(data.total)}</p>
    </div>
  );
}
