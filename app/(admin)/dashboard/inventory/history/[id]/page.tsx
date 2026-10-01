import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getInventoryReceiptDetail } from "@/app/actions/inventory-workspace";
import { InventoryWorkspaceNav } from "../../_components/InventoryWorkspaceNav";

export default async function InventoryReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receipt = await getInventoryReceiptDetail(Number(id));
  if (!receipt) notFound();
  const total = receipt.items.reduce((sum, item) => sum + item.quantity, 0);
  return <div className="space-y-6">
    <InventoryWorkspaceNav />
    <div className="flex items-start gap-3"><Link href="/dashboard/inventory/history" className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-accent"><ArrowLeft className="h-4 w-4" /></Link><div><h1 className="font-mono text-xl font-bold text-foreground">{receipt.receiptNumber}</h1><p className="mt-1 text-sm text-muted-foreground">Detail dokumen penerimaan barang</p></div></div>
    <section className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Info label="Asal" value={receipt.sourceType === "internal" ? receipt.sourceLocationName ?? "Lokasi asal" : receipt.sourceType === "external" ? receipt.sourceName ?? "Sumber luar" : "Tidak tercatat"} /><Info label="Tujuan" value={`${receipt.locationName} · ${receipt.locationCode}`} /><Info label="Pelaksana" value={receipt.actorName} /><Info label="Referensi" value={receipt.referenceNumber || "—"} /><Info label="Waktu" value={receipt.createdAt ? new Date(receipt.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "—"} />
      {receipt.notes && <div className="sm:col-span-2 lg:col-span-4"><p className="text-xs text-muted-foreground">Catatan</p><p className="mt-1 text-sm text-foreground">{receipt.notes}</p></div>}
    </section>
    <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="flex items-center justify-between border-b border-border p-4"><h2 className="font-semibold text-foreground">Item diterima</h2><span className="text-sm font-semibold text-emerald-600">{total} unit</span></div><div className="divide-y divide-border">{receipt.items.map(item => <div key={item.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_140px_110px_110px] sm:items-center"><div><p className="text-sm font-semibold text-foreground">{item.posName?.trim() || item.productName}</p>{item.variantId && <p className="text-xs text-muted-foreground">{item.size} / {item.color}{item.sku ? ` · ${item.sku}` : ""}</p>}<p className="font-mono text-[11px] text-muted-foreground">{item.barcode || "Tanpa barcode"}</p></div><p className="text-sm text-muted-foreground sm:text-right">Sebelum {item.balanceAfter - item.quantity}</p><p className="font-semibold text-emerald-600 sm:text-right">+{item.quantity}</p><p className="text-sm font-semibold text-foreground sm:text-right">Saldo {item.balanceAfter}</p></div>)}</div></section>
  </div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold text-foreground">{value}</p></div>; }
