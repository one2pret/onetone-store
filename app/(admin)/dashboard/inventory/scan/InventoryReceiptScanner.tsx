"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Minus, PackageCheck, Plus, ScanBarcode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { lookupInventoryBarcode, receiveInventoryByScan } from "@/app/actions/inventory-scanning";
import { appendBarcodeCharacter, consumeBarcodeBuffer, EMPTY_BARCODE_BUFFER } from "@/lib/pos-barcode-scanner";
import { CameraBarcodeScanner } from "@/components/scanner/CameraBarcodeScanner";

type Location = { id: number; name: string; code: string };
type ScanItem = {
  code: string;
  productId: number;
  variantId: number | null;
  name: string;
  variantLabel: string | null;
  sku: string | null;
  image: string | null;
  currentStock: number;
  quantity: number;
};

export function InventoryReceiptScanner({ locations }: { locations: Location[] }) {
  const [locationId, setLocationId] = useState(locations[0]?.id ?? 0);
  const [sourceType, setSourceType] = useState<"external" | "internal">("external");
  const [sourceLocationId, setSourceLocationId] = useState(0);
  const [sourceName, setSourceName] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [items, setItems] = useState<ScanItem[]>([]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [isPending, startTransition] = useTransition();
  const barcodeBuffer = useRef(EMPTY_BARCODE_BUFFER);
  const scanQueue = useRef(Promise.resolve());

  const totalQuantity = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  function enqueueScan(rawCode: string) {
    const code = rawCode.trim();
    if (!code || !locationId) return;
    scanQueue.current = scanQueue.current.then(async () => {
      const result = await lookupInventoryBarcode(code, locationId);
      if (!result.success) {
        toast.error(result.error);
        navigator.vibrate?.(150);
        return;
      }
      setItems(current => {
        const existing = current.find(item => item.code === result.item.code);
        if (existing) return current.map(item => item.code === result.item.code ? { ...item, quantity: item.quantity + 1 } : item);
        return [{ ...result.item, quantity: 1 }, ...current];
      });
      navigator.vibrate?.(40);
      toast.success(`${result.item.name} ditambahkan`, { id: "inventory-scan-success", duration: 900 });
    }).catch(() => { toast.error("Scan gagal diproses"); });
  }

  useEffect(() => {
    function handleScannerKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']") || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const timestamp = performance.now();
      if (event.key === "Enter") {
        const code = consumeBarcodeBuffer(barcodeBuffer.current, timestamp);
        barcodeBuffer.current = EMPTY_BARCODE_BUFFER;
        if (code) {
          event.preventDefault();
          enqueueScan(code);
        }
        return;
      }
      if (event.key.length === 1) barcodeBuffer.current = appendBarcodeCharacter(barcodeBuffer.current, event.key, timestamp);
    }
    window.addEventListener("keydown", handleScannerKey, true);
    return () => window.removeEventListener("keydown", handleScannerKey, true);
  }, [locationId]); // eslint-disable-line react-hooks/exhaustive-deps

  function submitManualCode(event: FormEvent) {
    event.preventDefault();
    enqueueScan(manualCode);
    setManualCode("");
  }

  function changeQuantity(code: string, delta: number) {
    setItems(current => current
      .map(item => item.code === code ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)
      .filter(item => item.quantity > 0));
  }

  function confirmReceipt() {
    if (!locationId || items.length === 0) return;
    startTransition(async () => {
      const result = await receiveInventoryByScan({
        locationId,
        sourceType,
        sourceLocationId: sourceType === "internal" ? sourceLocationId : undefined,
        sourceName: sourceType === "external" ? sourceName : undefined,
        idempotencyKey,
        referenceNumber: referenceNumber || undefined,
        notes: notes || undefined,
        items: items.map(item => ({ code: item.code, quantity: item.quantity })),
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.receiptNumber} berhasil disimpan${result.reused ? " (permintaan sebelumnya)" : ""}`);
      setItems([]);
      setReferenceNumber("");
      setNotes("");
      setSourceName("");
      setIdempotencyKey(crypto.randomUUID());
    });
  }

  if (locations.length === 0) {
    return <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">Belum ada lokasi inventori aktif. Buat atau aktifkan lokasi terlebih dahulu.</div>;
  }

  return <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section className="min-w-0 space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <label className="space-y-1.5 text-sm font-medium text-foreground">Asal barang
            <select value={sourceType} onChange={event => { setSourceType(event.target.value as "external" | "internal"); setItems([]); }} className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
              <option value="external">Dari luar usaha</option>
              <option value="internal">Dari lokasi lain</option>
            </select>
          </label>
          {sourceType === "internal" ? <label className="space-y-1.5 text-sm font-medium text-foreground">Lokasi asal
            <select value={sourceLocationId} onChange={event => { setSourceLocationId(Number(event.target.value)); setItems([]); }} className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm">
              <option value={0}>Pilih lokasi asal</option>
              {locations.filter(item => item.id !== locationId).map(item => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
            </select>
          </label> : <label className="space-y-1.5 text-sm font-medium text-foreground">Nama sumber / supplier
            <input value={sourceName} onChange={event => setSourceName(event.target.value)} maxLength={150} placeholder="Contoh: Supplier A" className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" />
          </label>}
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(200px,320px)_minmax(0,1fr)]">
          <label className="space-y-1.5 text-sm font-medium text-foreground">Lokasi penerimaan
            <select disabled={locations.length === 1} value={locationId} onChange={event => { setLocationId(Number(event.target.value)); setSourceLocationId(0); setItems([]); }} className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:cursor-default disabled:opacity-80">
              {locations.map(location => <option key={location.id} value={location.id}>{location.name} · {location.code}</option>)}
            </select>
          </label>
          <form onSubmit={submitManualCode} className="space-y-1.5">
            <label htmlFor="manual-barcode" className="text-sm font-medium text-foreground">Barcode / QR</label>
            <div className="flex gap-2">
              <input id="manual-barcode" value={manualCode} onChange={event => setManualCode(event.target.value)} maxLength={100} autoComplete="off" placeholder="Scan atau ketik kode" className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm" />
              <CameraBarcodeScanner onScan={enqueueScan} label="Kamera" className="shrink-0" />
              <button disabled={!manualCode.trim()} className="rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">Tambah</button>
            </div>
          </form>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
          <ScanBarcode className="h-6 w-6 shrink-0 text-primary" />
          <div><p className="text-sm font-semibold text-foreground">Scanner siap</p><p className="text-xs text-muted-foreground">Klik area kosong lalu scan. Scan kode yang sama akan menambah quantity.</p></div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="font-semibold text-foreground">Item diterima</h2><p className="text-xs text-muted-foreground">{items.length} SKU/varian · {totalQuantity} unit</p></div>{items.length > 0 && <button type="button" onClick={() => setItems([])} className="text-xs font-semibold text-destructive hover:underline">Kosongkan</button>}</div>
        {items.length === 0 ? <div className="px-4 py-16 text-center"><PackageCheck className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-3 text-sm text-muted-foreground">Belum ada barang yang dipindai.</p></div> : <div className="divide-y divide-border">
          {items.map(item => <div key={item.code} className="flex min-w-0 items-center gap-3 p-3 md:p-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">{item.image ? <Image src={item.image} alt={item.variantLabel ? `${item.name} ${item.variantLabel}` : item.name} fill unoptimized sizes="56px" className="object-cover" /> : <PackageCheck className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{item.name}</p>{item.variantLabel && <p className="truncate text-xs text-muted-foreground">{item.variantLabel}</p>}<p className="truncate font-mono text-[11px] text-muted-foreground">{item.code}{item.sku ? ` · ${item.sku}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">Stok {item.currentStock} → <span className="font-semibold text-emerald-600">{item.currentStock + item.quantity}</span></p></div>
            <div className="flex shrink-0 items-center rounded-lg border border-border bg-background"><button type="button" aria-label="Kurangi quantity" onClick={() => changeQuantity(item.code, -1)} className="p-2 text-muted-foreground hover:text-foreground"><Minus className="h-3.5 w-3.5" /></button><input aria-label={`Quantity ${item.name}`} type="number" min={1} value={item.quantity} onChange={event => setItems(current => current.map(row => row.code === item.code ? { ...row, quantity: Math.max(1, Number(event.target.value) || 1) } : row))} className="w-12 border-x border-border bg-transparent py-2 text-center text-sm font-semibold outline-none" /><button type="button" aria-label="Tambah quantity" onClick={() => changeQuantity(item.code, 1)} className="p-2 text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button></div>
            <button type="button" aria-label={`Hapus ${item.name}`} onClick={() => setItems(current => current.filter(row => row.code !== item.code))} className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>)}
        </div>}
      </div>
    </section>

    <aside className="h-fit space-y-4 rounded-xl border border-border bg-card p-4 xl:sticky xl:top-20">
      <div><h2 className="font-semibold text-foreground">Konfirmasi penerimaan</h2><p className="mt-1 text-xs text-muted-foreground">Stok belum berubah sebelum tombol konfirmasi ditekan.</p></div>
      {sourceType === "internal" && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Konfirmasi langsung mengurangi stok lokasi asal dan menambah stok lokasi penerima. Anda perlu akses ke kedua lokasi.</p>}
      <label className="block space-y-1.5 text-sm font-medium text-foreground">Nomor referensi <span className="font-normal text-muted-foreground">(opsional)</span><input value={referenceNumber} onChange={event => setReferenceNumber(event.target.value)} maxLength={100} placeholder="PO, surat jalan, invoice" className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
      <label className="block space-y-1.5 text-sm font-medium text-foreground">Catatan <span className="font-normal text-muted-foreground">(opsional)</span><textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={500} rows={3} placeholder="Supplier atau kondisi barang" className="block w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm" /></label>
      <div className="rounded-lg bg-muted/50 p-3 text-sm"><div className="flex justify-between text-muted-foreground"><span>Jenis item</span><span>{items.length}</span></div><div className="mt-1 flex justify-between font-semibold text-foreground"><span>Total unit masuk</span><span>{totalQuantity}</span></div></div>
      <button type="button" disabled={isPending || items.length === 0 || !locationId || (sourceType === "internal" ? !sourceLocationId || sourceLocationId === locationId : !sourceName.trim())} onClick={confirmReceipt} className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50">{isPending ? "Menyimpan..." : `Konfirmasi ${totalQuantity} Unit`}</button>
    </aside>
  </div>;
}
