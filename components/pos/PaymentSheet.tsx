"use client";

// components/pos/PaymentSheet.tsx
// Overlay pembayaran: pilih metode → konfirmasi → panggil createPosOrder.

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { X, Banknote, QrCode, ArrowRightLeft, ArrowLeft } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { createPosOrder } from "@/app/actions/pos-orders";
import type { CartLine } from "./CashierScreen";

const QUICK_CASH = [
  { label: "Uang Pas", getValue: (t: number) => t },
  { label: "20K", value: 20000 },
  { label: "50K", value: 50000 },
  { label: "100K", value: 100000 },
  { label: "200K", value: 200000 },
  { label: "500K", value: 500000 },
];

type PaymentMethod = "cash" | "qris" | "transfer";

interface Props {
  sessionId: number;
  cart: CartLine[];
  total: number;
  qrisUrl: string | null;
  onClose: () => void;
  onSuccess: (orderId: number) => void;
}

export function PaymentSheet({ sessionId, cart, total, qrisUrl, onClose, onSuccess }: Props) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashInput, setCashInput] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [isPending, startTransition] = useTransition();

  const cashReceived = Number(cashInput) || 0;
  const change = useMemo(
    () => (method === "cash" ? cashReceived - total : 0),
    [method, cashReceived, total]
  );
  const cashOk = method !== "cash" || cashReceived >= total;

  function numpadPress(key: string) {
    if (key === "back") {
      setCashInput((v) => v.slice(0, -1));
    } else if (key === "clear") {
      setCashInput("");
    } else if (key === "000") {
      setCashInput((v) => (v === "" ? "000" : v + "000"));
    } else {
      setCashInput((v) => (v + key).replace(/^0+(?=\d)/, ""));
    }
  }

  function handleConfirm() {
    if (!cashOk) {
      toast.error(`Uang kurang. Butuh ${formatRupiah(total)}`);
      return;
    }

    startTransition(async () => {
      const result = await createPosOrder({
        sessionId,
        items: cart.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
        })),
        paymentMethod: method,
        cashReceived: method === "cash" ? cashReceived : undefined,
        customerName: customerName || undefined,
      });

      if (result.success && result.orderId) {
        toast.success("Transaksi berhasil");
        onSuccess(result.orderId);
      } else {
        toast.error(result.error ?? "Gagal proses pembayaran");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
        <button
          onClick={onClose}
          className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-slate-900">Pembayaran</h1>
          <p className="text-xs text-slate-500">{cart.length} item</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-500 hover:text-slate-700 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Total */}
        <section className="px-4 py-6 bg-slate-900 text-white text-center">
          <p className="text-xs uppercase tracking-wide text-slate-400">Total Belanja</p>
          <p className="text-4xl md:text-5xl font-bold mt-1">{formatRupiah(total)}</p>
        </section>

        {/* Payment method tabs */}
        <section className="px-4 py-4">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Metode Pembayaran
          </p>
          <div className="grid grid-cols-3 gap-2">
            <MethodButton
              icon={<Banknote className="w-5 h-5" />}
              label="Tunai"
              active={method === "cash"}
              onClick={() => setMethod("cash")}
            />
            <MethodButton
              icon={<QrCode className="w-5 h-5" />}
              label="QRIS"
              active={method === "qris"}
              onClick={() => setMethod("qris")}
            />
            <MethodButton
              icon={<ArrowRightLeft className="w-5 h-5" />}
              label="Transfer"
              active={method === "transfer"}
              onClick={() => setMethod("transfer")}
            />
          </div>
        </section>

        {/* Method content */}
        {method === "cash" && (
          <section className="px-4 pb-4 space-y-3">
            {/* Input display */}
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-[11px] text-slate-500">Uang Diterima</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {formatRupiah(cashReceived)}
              </p>
              {cashReceived > 0 && change >= 0 && (
                <p className="mt-2 text-sm font-semibold text-emerald-600">
                  Kembalian: {formatRupiah(change)}
                </p>
              )}
              {cashReceived > 0 && change < 0 && (
                <p className="mt-2 text-sm font-semibold text-rose-600">
                  Kurang: {formatRupiah(Math.abs(change))}
                </p>
              )}
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-3 gap-2">
              {QUICK_CASH.map((q, i) => {
                const val = "value" in q ? q.value : q.getValue!(total);
                return (
                  <button
                    key={i}
                    onClick={() => setCashInput(String(val))}
                    className="py-2.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-primary/10 hover:text-primary transition"
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"].map(
                (k) => (
                  <button
                    key={k}
                    onClick={() => numpadPress(k)}
                    className="py-3.5 text-lg font-semibold bg-white border border-slate-200 rounded-lg hover:bg-slate-50 active:bg-slate-100 transition"
                  >
                    {k === "back" ? "⌫" : k}
                  </button>
                )
              )}
            </div>
          </section>
        )}

        {method === "qris" && (
          <section className="px-4 pb-4">
            <div className="p-6 bg-slate-50 rounded-xl text-center">
              {qrisUrl ? (
                <div className="relative w-56 h-56 mx-auto mb-4 bg-white rounded-xl overflow-hidden border border-slate-200">
                  <Image
                    src={qrisUrl}
                    alt="QRIS Merchant"
                    fill
                    unoptimized
                    sizes="224px"
                    className="object-contain p-2"
                  />
                </div>
              ) : (
                <div className="w-40 h-40 mx-auto mb-4 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center">
                  <div className="text-center px-2">
                    <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-[10px] text-slate-500">
                      Upload QRIS di<br />Pengaturan Toko
                    </p>
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-600 mb-1">
                {qrisUrl
                  ? "Tunjukkan QRIS ke customer, lalu konfirmasi setelah dibayar"
                  : "Upload gambar QRIS di /dashboard/settings dulu"}
              </p>
              <p className="text-lg font-bold text-slate-900 mt-2">{formatRupiah(total)}</p>
            </div>
          </section>
        )}

        {method === "transfer" && (
          <section className="px-4 pb-4">
            <div className="p-6 bg-slate-50 rounded-xl">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Transfer Bank
              </p>
              <p className="text-sm text-slate-600">
                Pastikan customer sudah transfer dan dana masuk sebelum konfirmasi.
              </p>
              <p className="text-lg font-bold text-slate-900 mt-3">{formatRupiah(total)}</p>
            </div>
          </section>
        )}

        {/* Optional customer name */}
        <section className="px-4 pb-6">
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Nama Pelanggan (opsional)
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Misal: Ibu Rina"
            className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </section>
      </div>

      {/* Footer confirm button */}
      <footer className="px-4 py-3 border-t border-slate-200 bg-white">
        <button
          onClick={handleConfirm}
          disabled={isPending || !cashOk}
          className="w-full py-4 text-base font-bold bg-primary text-primary-foreground rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {isPending
            ? "Memproses..."
            : method === "cash"
              ? "Konfirmasi & Cetak Struk"
              : "Sudah Dibayar → Cetak Struk"}
        </button>
      </footer>
    </div>
  );
}

function MethodButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition " +
        (active
          ? "border-primary bg-primary/5 text-primary"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")
      }
    >
      {icon}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
