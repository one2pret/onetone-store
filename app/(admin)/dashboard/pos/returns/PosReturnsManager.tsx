"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { createPosReturn, getPosReturnAdminData } from "@/app/actions/pos-returns";
import { calculatePosReturn } from "@/lib/pos-return-pricing";
import { formatRupiah } from "@/lib/utils";

type Data = NonNullable<Awaited<ReturnType<typeof getPosReturnAdminData>>>;
type RefundMethod = "cash" | "qris" | "transfer";

export function PosReturnsManager({ data }: { data: Data }) {
  const router = useRouter();
  const [selectedOrderId, setSelectedOrderId] = useState<number>(data.sales[0]?.id ?? 0);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [restocks, setRestocks] = useState<Record<number, boolean>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("cash");
  const [refundSessionId, setRefundSessionId] = useState<number | null>(() =>
    data.activeSessions.find(session => session.locationId === data.sales[0]?.locationId)?.id ?? null
  );
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const sale = data.sales.find(row => row.id === selectedOrderId);
  const items = data.items.filter(item => item.orderId === selectedOrderId);
  const returned = data.returnedItems.filter(item => items.some(orderItem => orderItem.id === item.orderItemId));
  const remainingByItem = useMemo(() => new Map(items.map(item => [
    item.id,
    item.quantity - returned.filter(row => row.orderItemId === item.id).reduce((sum, row) => sum + row.quantity, 0),
  ])), [items, returned]);

  const preview = useMemo(() => {
    if (!sale) return null;
    try {
      return calculatePosReturn(
        items.map(item => ({ id: item.id, quantity: item.quantity, unitPrice: Number(item.price), netSubtotal: Number(item.subtotal) })),
        returned.map(item => ({ orderItemId: item.orderItemId, quantity: item.quantity, refundAmount: Number(item.refundAmount) })),
        items.filter(item => (quantities[item.id] ?? 0) > 0).map(item => ({ orderItemId: item.id, quantity: quantities[item.id] })),
        Number(sale.discountAmount ?? 0),
      );
    } catch {
      return null;
    }
  }, [items, quantities, returned, sale]);

  function selectOrder(orderId: number) {
    setSelectedOrderId(orderId);
    setQuantities({});
    setRestocks({});
    const selected = data.sales.find(row => row.id === orderId);
    setRefundMethod(selected?.paymentMethod ?? "cash");
    setRefundSessionId(data.activeSessions.find(session => session.locationId === selected?.locationId)?.id ?? null);
  }

  function submit() {
    const selectedItems = items.filter(item => (quantities[item.id] ?? 0) > 0).map(item => ({
      orderItemId: item.id,
      quantity: quantities[item.id],
      restock: restocks[item.id] ?? true,
    }));
    startTransition(async () => {
      const result = await createPosReturn({ orderId: selectedOrderId, items: selectedItems, refundMethod, refundSessionId, reason });
      if (!result.success || !("refundAmount" in result)) {
        toast.error(result.error ?? "Retur gagal");
        return;
      }
      toast.success(`Retur tersimpan. Refund ${formatRupiah(result.refundAmount)}`);
      setQuantities({});
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-5">
        <section className="rounded-xl border border-border bg-card p-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transaksi POS</label>
          <select value={selectedOrderId} onChange={event => selectOrder(Number(event.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
            {data.sales.map(row => <option key={row.id} value={row.id}>{row.orderNumber} · {formatRupiah(row.total)} · {row.locationName ?? "Lokasi POS"}</option>)}
          </select>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Pilih item yang dikembalikan</h2></div>
          <div className="divide-y divide-border">
            {items.map(item => {
              const remaining = remainingByItem.get(item.id) ?? 0;
              return (
                <div key={item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_110px_130px] sm:items-center">
                  <div>
                    <p className="text-sm font-semibold">{item.productName}</p>
                    {item.variantLabel && <p className="text-xs text-muted-foreground">{item.variantLabel}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">Dibeli {item.quantity} · tersisa untuk retur {remaining}</p>
                  </div>
                  <input type="number" min={0} max={remaining} value={quantities[item.id] ?? 0} disabled={remaining === 0} onChange={event => setQuantities(current => ({ ...current, [item.id]: Math.min(remaining, Math.max(0, Number(event.target.value) || 0)) }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={restocks[item.id] ?? true} disabled={remaining === 0} onChange={event => setRestocks(current => ({ ...current, [item.id]: event.target.checked }))} />
                    Layak restock
                  </label>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="space-y-5">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Konfirmasi refund</h2>
          <div className="mt-4 space-y-4">
            <div><label className="mb-1.5 block text-xs text-muted-foreground">Metode refund</label><select value={refundMethod} onChange={event => setRefundMethod(event.target.value as RefundMethod)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"><option value="cash">Tunai</option><option value="qris">QRIS (manual)</option><option value="transfer">Transfer (manual)</option></select></div>
            {refundMethod === "cash" && <div><label className="mb-1.5 block text-xs text-muted-foreground">Sesi kasir untuk pengeluaran tunai</label><select value={refundSessionId ?? ""} onChange={event => setRefundSessionId(event.target.value ? Number(event.target.value) : null)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"><option value="">Pilih sesi aktif</option>{data.activeSessions.filter(session => session.locationId === sale?.locationId).map(session => <option key={session.id} value={session.id}>Sesi #{session.id} · {session.cashierName} · {session.locationName}</option>)}</select></div>}
            <div><label className="mb-1.5 block text-xs text-muted-foreground">Alasan retur</label><textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={500} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm" placeholder="Minimal 5 karakter" /></div>
            <div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Nominal refund otomatis</p><p className="mt-1 text-2xl font-bold">{formatRupiah(preview?.refundAmount ?? 0)}</p><p className="mt-1 text-[11px] text-muted-foreground">QRIS/transfer hanya dicatat; pengiriman dana tetap dilakukan manual.</p></div>
            <button onClick={submit} disabled={isPending || !preview?.lines.length || reason.trim().length < 5 || (refundMethod === "cash" && !refundSessionId)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"><RotateCcw className="h-4 w-4" />{isPending ? "Memproses..." : "Proses Retur"}</button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Histori terbaru</h2>
          <div className="mt-3 space-y-3">
            {data.history.length === 0 && <p className="text-sm text-muted-foreground">Belum ada retur.</p>}
            {data.history.slice(0, 10).map(row => <div key={row.id} className="border-b border-border pb-3 last:border-0"><div className="flex justify-between gap-3"><p className="font-mono text-xs font-semibold">{row.returnNumber}</p><p className="text-xs font-bold">{formatRupiah(row.refundAmount)}</p></div><p className="mt-1 text-[11px] text-muted-foreground">{row.orderNumber} · {row.actorName} · {row.locationName}</p><p className="mt-1 text-xs">{row.reason}</p></div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
