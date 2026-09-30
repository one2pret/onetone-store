"use client";

import QRCode from "qrcode";
import { Printer, QrCode, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addAdditionalProductBarcode, deleteAdditionalProductBarcode } from "@/app/actions/product-barcodes";
import { CameraBarcodeScanner } from "@/components/scanner/CameraBarcodeScanner";

type Barcode = { id: number; code: string; productId: number; variantId: number | null };
type Variant = { id: number; size: string; color: string; sku: string | null };

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);

export function ProductBarcodeManager({ productId, productName, barcodes, variants }: { productId: number; productName: string; barcodes: Barcode[]; variants: Variant[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [variantId, setVariantId] = useState(0);
  const [qrUrls, setQrUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(barcodes.map(async barcode => [barcode.id, await QRCode.toDataURL(barcode.code, { width: 220, margin: 1 })] as const))
      .then(entries => { if (!cancelled) setQrUrls(Object.fromEntries(entries)); })
      .catch(() => { if (!cancelled) setQrUrls({}); });
    return () => { cancelled = true; };
  }, [barcodes]);

  function add() {
    startTransition(async () => {
      const result = await addAdditionalProductBarcode({ productId, variantId: variantId || null, code });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Barcode ditambahkan");
      setCode("");
      router.refresh();
    });
  }

  function remove(id: number) {
    startTransition(async () => {
      const result = await deleteAdditionalProductBarcode(id, productId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Barcode dihapus");
      router.refresh();
    });
  }

  function printLabels() {
    const popup = window.open("", "_blank", "width=800,height=700");
    if (!popup) return toast.error("Popup diblokir browser");
    const labels = barcodes.map(barcode => {
      const variant = variants.find(item => item.id === barcode.variantId);
      const label = variant ? `${variant.size} / ${variant.color}${variant.sku ? ` — ${variant.sku}` : ""}` : "Produk umum";
      return `<article><img src="${qrUrls[barcode.id] ?? ""}" alt=""><strong>${escapeHtml(productName)}</strong><span>${escapeHtml(label)}</span><code>${escapeHtml(barcode.code)}</code></article>`;
    }).join("");
    popup.document.write(`<!doctype html><html><head><title>Label ${escapeHtml(productName)}</title><style>@page{size:auto;margin:8mm}body{font-family:Arial,sans-serif;display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;margin:0}article{border:1px solid #bbb;border-radius:8px;padding:4mm;text-align:center;break-inside:avoid;display:flex;flex-direction:column;align-items:center;gap:2mm}img{width:28mm;height:28mm}strong{font-size:11px}span{font-size:9px;color:#444}code{font-size:9px;word-break:break-all}@media print{article{border-color:#ddd}}</style></head><body>${labels}</body></html>`);
    popup.document.close();
    popup.onload = () => { popup.focus(); popup.print(); };
  }

  return <section className="rounded-xl border border-border bg-card p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-semibold text-foreground">Barcode tambahan & label QR</h2><p className="mt-1 text-xs text-muted-foreground">Satu produk/varian dapat memiliki beberapa kode unik, misalnya kode internal dan supplier.</p></div><button type="button" onClick={printLabels} disabled={!barcodes.length || Object.keys(qrUrls).length !== barcodes.length} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-50"><Printer className="h-4 w-4" />Cetak semua label</button></div>
    <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_240px_auto_auto]">
      <input value={code} onChange={event => setCode(event.target.value)} maxLength={100} placeholder="Kode barcode / QR tambahan" className="h-10 rounded-lg border border-border bg-background px-3 font-mono text-sm" />
      <select value={variantId} onChange={event => setVariantId(Number(event.target.value))} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value={0}>Produk umum</option>{variants.map(variant => <option key={variant.id} value={variant.id}>{variant.size} / {variant.color}{variant.sku ? ` — ${variant.sku}` : ""}</option>)}</select>
      <CameraBarcodeScanner onScan={setCode} label="Kamera" />
      <button type="button" onClick={add} disabled={pending || code.trim().length < 3} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Tambah</button>
    </div>
    <div className="mt-4 divide-y divide-border rounded-lg border border-border">{barcodes.map(barcode => { const variant = variants.find(item => item.id === barcode.variantId); return <div key={barcode.id} className="flex items-center gap-3 p-3"><QrCode className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="truncate font-mono text-sm">{barcode.code}</p><p className="text-xs text-muted-foreground">{variant ? `${variant.size} / ${variant.color}${variant.sku ? ` — ${variant.sku}` : ""}` : "Produk umum"}</p></div><button type="button" onClick={() => remove(barcode.id)} disabled={pending} aria-label={`Hapus ${barcode.code}`} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button></div>; })}{!barcodes.length && <p className="p-5 text-center text-sm text-muted-foreground">Belum ada barcode.</p>}</div>
  </section>;
}
