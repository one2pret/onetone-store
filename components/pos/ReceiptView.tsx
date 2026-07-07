"use client";

// components/pos/ReceiptView.tsx
// Layar sukses + struk. Ambil detail order dari server action getPosOrder.
// Support: print via browser (CSS @media print, 58mm) + share WA.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Printer, MessageCircle, Plus } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { getPosOrder } from "@/app/actions/pos-orders";

type ReceiptData = {
  orderNumber: string;
  total: number;
  cashReceived: number | null;
  cashChange: number | null;
  paymentMethod: "cash" | "qris" | "transfer" | null;
  customerName: string | null;
  createdAt: Date | null;
  items: {
    productName: string;
    variantLabel: string | null;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
};

interface Props {
  orderId: number;
  footer: string | null;
  onDone: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "TUNAI",
  qris: "QRIS",
  transfer: "TRANSFER",
};

export function ReceiptView({ orderId, footer, onDone }: Props) {
  const [data, setData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const order = await getPosOrder(orderId);
      if (cancelled) return;
      if (!order) {
        toast.error("Order tidak ditemukan");
        onDone();
        return;
      }
      setData({
        orderNumber: order.orderNumber,
        total: Number(order.total),
        cashReceived: order.cashReceived ? Number(order.cashReceived) : null,
        cashChange: order.cashChange ? Number(order.cashChange) : null,
        paymentMethod: order.posPaymentMethod,
        customerName: order.shippingName,
        createdAt: order.createdAt,
        items: order.items.map((it) => ({
          productName: it.productName,
          variantLabel: it.variantLabel,
          quantity: it.quantity,
          unitPrice: Number(it.price),
          subtotal: Number(it.subtotal),
        })),
      });
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId, onDone]);

  function handlePrint() {
    window.print();
  }

  function handleShareWA() {
    if (!data) return;
    const lines = [
      "*STRUK ONETONE*",
      `No: ${data.orderNumber}`,
      data.createdAt ? `Tanggal: ${new Date(data.createdAt).toLocaleString("id-ID")}` : "",
      "",
      ...data.items.map(
        (it) =>
          `${it.productName}${it.variantLabel ? ` (${it.variantLabel})` : ""}\n` +
          `  ${it.quantity} × ${formatRupiah(it.unitPrice)} = ${formatRupiah(it.subtotal)}`
      ),
      "",
      `*TOTAL: ${formatRupiah(data.total)}*`,
      data.paymentMethod ? `Bayar: ${PAYMENT_LABELS[data.paymentMethod]}` : "",
      data.cashReceived !== null ? `Diterima: ${formatRupiah(data.cashReceived)}` : "",
      data.cashChange !== null ? `Kembalian: ${formatRupiah(data.cashChange)}` : "",
      "",
      footer && footer.trim() !== "" ? footer : "Terima kasih!",
    ]
      .filter(Boolean)
      .join("\n");

    const url = `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, "_blank");
  }

  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-500 text-sm">Menyiapkan struk...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-100">
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-receipt,
          #print-receipt * {
            visibility: visible;
          }
          #print-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 58mm;
            padding: 4mm;
            font-size: 10pt;
            color: #000;
          }
          #print-receipt h1,
          #print-receipt h2 {
            font-size: 12pt;
          }
        }
      `}</style>

      {/* Header sukses */}
      <div className="bg-emerald-500 text-white px-4 py-6 text-center print:hidden">
        <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-white/20 flex items-center justify-center">
          <Check className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold">Transaksi Berhasil</h1>
        <p className="text-sm text-emerald-50 mt-0.5">{data.orderNumber}</p>
      </div>

      {/* Struk preview */}
      <div className="flex-1 overflow-y-auto p-4">
        <div
          id="print-receipt"
          className="max-w-sm mx-auto bg-white rounded-xl shadow-sm p-5 font-mono text-xs text-slate-800"
        >
          <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-3">
            <h2 className="text-base font-bold tracking-wide">ONETONE</h2>
            <p className="text-[10px] text-slate-500">Fashion Store</p>
          </div>

          <div className="space-y-0.5 mb-3 text-[11px]">
            <div className="flex justify-between">
              <span>No.</span>
              <span className="font-semibold">{data.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Tgl.</span>
              <span>
                {data.createdAt
                  ? new Date(data.createdAt).toLocaleString("id-ID", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "-"}
              </span>
            </div>
            {data.customerName && (
              <div className="flex justify-between">
                <span>Pelanggan</span>
                <span>{data.customerName}</span>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-slate-300 pt-2 mb-2 space-y-2">
            {data.items.map((it, i) => (
              <div key={i}>
                <p className="font-semibold text-slate-900 leading-tight">
                  {it.productName}
                </p>
                {it.variantLabel && (
                  <p className="text-[10px] text-slate-500">{it.variantLabel}</p>
                )}
                <div className="flex justify-between mt-0.5">
                  <span className="text-slate-600">
                    {it.quantity} × {formatRupiah(it.unitPrice)}
                  </span>
                  <span className="font-semibold">{formatRupiah(it.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
            <div className="flex justify-between font-bold text-sm">
              <span>TOTAL</span>
              <span>{formatRupiah(data.total)}</span>
            </div>
            {data.paymentMethod && (
              <div className="flex justify-between">
                <span>Bayar</span>
                <span>{PAYMENT_LABELS[data.paymentMethod]}</span>
              </div>
            )}
            {data.cashReceived !== null && (
              <div className="flex justify-between">
                <span>Diterima</span>
                <span>{formatRupiah(data.cashReceived)}</span>
              </div>
            )}
            {data.cashChange !== null && (
              <div className="flex justify-between">
                <span>Kembalian</span>
                <span>{formatRupiah(data.cashChange)}</span>
              </div>
            )}
          </div>

          <div className="text-center border-t border-dashed border-slate-300 pt-3 mt-3 text-[10px] text-slate-500 whitespace-pre-line">
            {footer && footer.trim() !== ""
              ? footer
              : "Terima kasih atas kunjungan Anda!\nBarang sudah dibeli tidak dapat ditukar."}
          </div>
        </div>
      </div>

      {/* Actions */}
      <footer className="p-4 bg-white border-t border-slate-200 space-y-2 print:hidden">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 py-3 text-sm font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleShareWA}
            className="flex items-center justify-center gap-2 py-3 text-sm font-semibold border border-slate-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition"
          >
            <MessageCircle className="w-4 h-4" />
            Kirim WA
          </button>
        </div>
        <button
          onClick={onDone}
          className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold bg-primary text-primary-foreground rounded-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition"
        >
          <Plus className="w-4 h-4" />
          Transaksi Baru
        </button>
      </footer>
    </div>
  );
}
