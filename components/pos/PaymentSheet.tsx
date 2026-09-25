"use client";

// components/pos/PaymentSheet.tsx
// Overlay pembayaran: pilih metode → konfirmasi → panggil createPosOrder.

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { X, Banknote, QrCode, ArrowRightLeft, ArrowLeft, Tag } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { createPosOrder } from "@/app/actions/pos-orders";
import { calculatePosDiscountPricing, type PosDiscount } from "@/lib/pos-discounts";
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
  maxDiscountPercent: number;
  qrisUrl: string | null;
  onClose: () => void;
  onSuccess: (orderId: number) => void;
}

export function PaymentSheet({ sessionId, cart, total, maxDiscountPercent, qrisUrl, onClose, onSuccess }: Props) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [cashInput, setCashInput] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [lineDiscounts, setLineDiscounts] = useState<Record<string, PosDiscount>>({});
  const [orderDiscount, setOrderDiscount] = useState<PosDiscount>({ type: "percent", value: 0 });
  const [isPending, startTransition] = useTransition();

  const discountPricing = useMemo(() => {
    try {
      return {
        value: calculatePosDiscountPricing(
          cart.map(line => ({
            key: line.key,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            discount: lineDiscounts[line.key],
          })),
          orderDiscount,
          maxDiscountPercent,
        ),
        error: null,
      };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : "Diskon tidak valid",
      };
    }
  }, [cart, lineDiscounts, maxDiscountPercent, orderDiscount]);
  const payableTotal = discountPricing.value?.total ?? total;
  const cashReceived = Number(cashInput) || 0;
  const change = useMemo(
    () => (method === "cash" ? cashReceived - payableTotal : 0),
    [method, cashReceived, payableTotal]
  );
  const cashOk = method !== "cash" || cashReceived >= payableTotal;

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
    if (!discountPricing.value) {
      toast.error(discountPricing.error ?? "Diskon tidak valid");
      return;
    }
    if (!cashOk) {
      toast.error(`Uang kurang. Butuh ${formatRupiah(payableTotal)}`);
      return;
    }

    startTransition(async () => {
      const result = await createPosOrder({
        sessionId,
        items: cart.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
          discount: lineDiscounts[l.key]?.value > 0 ? lineDiscounts[l.key] : undefined,
        })),
        paymentMethod: method,
        cashReceived: method === "cash" ? cashReceived : undefined,
        customerName: customerName || undefined,
        orderDiscount: orderDiscount.value > 0 ? orderDiscount : undefined,
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
          <p className="text-4xl md:text-5xl font-bold mt-1">{formatRupiah(payableTotal)}</p>
          {discountPricing.value && discountPricing.value.discountTotal > 0 && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs">
              <span className="text-slate-400 line-through">{formatRupiah(discountPricing.value.subtotal)}</span>
              <span className="font-semibold text-emerald-300">
                Hemat {formatRupiah(discountPricing.value.discountTotal)}
              </span>
            </div>
          )}
        </section>

        {/* Discounts */}
        <section className="border-b border-slate-200 px-4 py-4">
          <button
            type="button"
            onClick={() => setDiscountOpen(value => !value)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Tag className="h-4 w-4" />
              Diskon POS
            </span>
            <span className="text-xs font-medium text-slate-500">
              {discountPricing.value?.discountTotal
                ? `-${formatRupiah(discountPricing.value.discountTotal)}`
                : discountOpen ? "Tutup" : "Tambah"}
            </span>
          </button>

          {discountOpen && (
            <div className="mt-3 space-y-3">
              <p className="text-[11px] text-slate-500">
                Batas diskon gabungan akun ini {maxDiscountPercent}% dari subtotal.
              </p>
              {cart.map(line => (
                <div key={line.key} className="rounded-xl bg-slate-50 p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-800">{line.productName}</p>
                      {line.variantLabel && <p className="text-[10px] text-slate-500">{line.variantLabel}</p>}
                    </div>
                    <span className="shrink-0 text-xs font-medium text-slate-700">
                      {formatRupiah(line.unitPrice * line.quantity)}
                    </span>
                  </div>
                  <DiscountInput
                    label="Diskon item"
                    discount={lineDiscounts[line.key] ?? { type: "percent", value: 0 }}
                    onChange={discount => setLineDiscounts(current => ({ ...current, [line.key]: discount }))}
                  />
                </div>
              ))}

              <div className="rounded-xl border border-slate-200 p-3">
                <DiscountInput
                  label="Diskon transaksi"
                  discount={orderDiscount}
                  onChange={setOrderDiscount}
                />
              </div>

              {discountPricing.error && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {discountPricing.error}
                </p>
              )}
            </div>
          )}
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
                const val = "value" in q ? q.value : q.getValue!(payableTotal);
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
              <p className="text-lg font-bold text-slate-900 mt-2">{formatRupiah(payableTotal)}</p>
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
              <p className="text-lg font-bold text-slate-900 mt-3">{formatRupiah(payableTotal)}</p>
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
          disabled={isPending || !cashOk || !discountPricing.value}
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

function DiscountInput({
  label,
  discount,
  onChange,
}: {
  label: string;
  discount: PosDiscount;
  onChange: (discount: PosDiscount) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="flex shrink-0 rounded-lg border border-slate-200 bg-white p-0.5">
          {(["percent", "fixed"] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => onChange({ type, value: discount.value })}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                discount.type === type ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {type === "percent" ? "%" : "Rp"}
            </button>
          ))}
        </div>
        <input
          type="number"
          min="0"
          step="1"
          value={discount.value || ""}
          onChange={event => onChange({ ...discount, value: Math.max(0, Number(event.target.value) || 0) })}
          placeholder="0"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold tabular-nums text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        {discount.value > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...discount, value: 0 })}
            className="rounded-lg px-2 text-xs font-medium text-rose-600 hover:bg-rose-50"
          >
            Hapus
          </button>
        )}
      </div>
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
