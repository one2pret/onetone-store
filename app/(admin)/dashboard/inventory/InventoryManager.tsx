"use client";

import { configureOnlineInventoryLocation, createInventoryLocation, transferInventory, updateInventoryBalance } from "@/app/actions/inventory";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Data = Awaited<ReturnType<typeof import("@/app/actions/inventory").getInventoryAdminData>>;
type InventoryRow = { productId: number; variantId: number | null; name: string; detail: string };
const jakartaDateKey = (value: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));

export function InventoryManager({ data }: { data: NonNullable<Data> }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [locationId, setLocationId] = useState(data.locations[0]?.id ?? 0);
  const [search, setSearch] = useState("");
  const [fromLocationId, setFromLocationId] = useState(data.locations[0]?.id ?? 0);
  const [toLocationId, setToLocationId] = useState(data.locations[1]?.id ?? data.locations[0]?.id ?? 0);
  const [selectedItem, setSelectedItem] = useState("");
  const [movementLocation, setMovementLocation] = useState(0);
  const [movementType, setMovementType] = useState("");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementDate, setMovementDate] = useState("");
  const [onlineLocationId, setOnlineLocationId] = useState(data.locations.find(l => l.isOnlineDefault)?.id ?? data.locations.find(l => l.type === "online" && l.isActive)?.id ?? 0);
  const hasOnlineDefault = data.locations.some(l => l.isOnlineDefault && l.isActive);
  const balances = new Map(data.balances.filter(b => b.locationId === locationId).map(b => [`${b.productId}:${b.variantId ?? 0}`, b.quantity]));
  const variantsByProduct = useMemo(() => {
    const grouped = new Map<number, typeof data.variants>();
    for (const variant of data.variants) {
      const current = grouped.get(variant.productId) ?? [];
      current.push(variant);
      grouped.set(variant.productId, current);
    }
    return grouped;
  }, [data]);
  const rows: InventoryRow[] = data.products.flatMap<InventoryRow>(product => {
    const variants = variantsByProduct.get(product.id) ?? [];
    return variants.length ? variants.map(v => ({ productId: product.id, variantId: v.id, name: product.name, detail: `${v.size} / ${v.color}${v.sku ? ` · ${v.sku}` : ""}` })) : [{ productId: product.id, variantId: null, name: product.name, detail: "Tanpa varian" }];
  }).filter(row => `${row.name} ${row.detail}`.toLowerCase().includes(search.toLowerCase()));
  const allRows: InventoryRow[] = data.products.flatMap<InventoryRow>(product => {
    const variants = variantsByProduct.get(product.id) ?? [];
    return variants.length ? variants.map(v => ({ productId: product.id, variantId: v.id, name: product.name, detail: `${v.size} / ${v.color}${v.sku ? ` · ${v.sku}` : ""}` })) : [{ productId: product.id, variantId: null, name: product.name, detail: "Tanpa varian" }];
  });
  const productNames = new Map(data.products.map(product => [product.id, product.name]));
  const variantNames = new Map(data.variants.map(variant => [variant.id, `${variant.size} / ${variant.color}`]));
  const locationNames = new Map(data.locations.map(location => [location.id, location.name]));
  const movementLabels: Record<string, string> = { opening_balance: "Saldo awal", online_sale: "Penjualan online", pos_sale: "Penjualan POS", return: "Retur", transfer_in: "Transfer masuk", transfer_out: "Transfer keluar", adjustment: "Penyesuaian" };
  const filteredMovements = data.movements.filter(movement => {
    const haystack = `${productNames.get(movement.productId) ?? ""} ${movement.variantId ? variantNames.get(movement.variantId) ?? "" : ""} ${movement.notes ?? ""}`.toLowerCase();
    return (!movementLocation || movement.locationId === movementLocation)
      && (!movementType || movement.type === movementType)
      && (!movementSearch || haystack.includes(movementSearch.toLowerCase()))
      && (!movementDate || (movement.createdAt && jakartaDateKey(movement.createdAt) === movementDate));
  });

  function addLocation(formData: FormData) {
    startTransition(async () => {
      const result = await createInventoryLocation({ name: String(formData.get("name")), code: String(formData.get("code")), type: String(formData.get("type")) as "online" | "pos" | "warehouse" });
      if (result.success) { toast.success("Lokasi dibuat"); router.refresh(); }
      else toast.error(result.error);
    });
  }

  function configureOnline() {
    startTransition(async () => {
      const result = await configureOnlineInventoryLocation(onlineLocationId);
      if (result.success) { toast.success("Gudang Online utama ditetapkan"); router.refresh(); }
      else toast.error(result.error);
    });
  }

  function saveStock(productId: number, variantId: number | null, quantity: number) {
    startTransition(async () => {
      const result = await updateInventoryBalance({ locationId, productId, variantId, quantity });
      if (result.success) { toast.success("Stok diperbarui"); router.refresh(); }
      else toast.error(result.error);
    });
  }

  function submitTransfer(formData: FormData) {
    const [productIdText, variantIdText] = String(formData.get("item")).split(":");
    startTransition(async () => {
      const result = await transferInventory({
        fromLocationId,
        toLocationId,
        productId: Number(productIdText),
        variantId: Number(variantIdText) || null,
        quantity: Number(formData.get("quantity")),
        notes: String(formData.get("notes") ?? "") || undefined,
      });
      if (result.success) { toast.success(`Transfer #${result.transferId} berhasil`); router.refresh(); }
      else toast.error(result.error);
    });
  }

  return <div className="space-y-5">
    {!hasOnlineDefault && <div className="space-y-3 rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
      <p className="font-semibold">Gudang Online utama belum dikonfigurasi. Simpan produk akan ditolak sampai lokasi ditetapkan.</p>
      <p>Pilih lokasi Online aktif. Stok lama akan dipakai untuk saldo yang belum tercatat; saldo yang sudah ada tetap dipertahankan.</p>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Lokasi Online utama" value={onlineLocationId} onChange={e => setOnlineLocationId(Number(e.target.value))} className="rounded-lg border border-amber-400 bg-white px-3 py-2">
          <option value={0}>Pilih lokasi Online</option>
          {data.locations.filter(l => l.type === "online" && (l.isActive || l.isOnlineDefault)).map(l => <option key={l.id} value={l.id}>{l.name}{!l.isActive ? " (nonaktif — aktifkan kembali)" : ""}</option>)}
        </select>
        <button type="button" disabled={pending || !onlineLocationId} onClick={configureOnline} className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">Tetapkan Gudang Online</button>
      </div>
      {!data.locations.some(l => l.type === "online" && (l.isActive || l.isOnlineDefault)) && <p>Buat lokasi bertipe Online di bawah ini terlebih dahulu.</p>}
    </div>}
    <form action={addLocation} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_180px_160px_auto]">
      <input name="name" required placeholder="Contoh: POS Cimahi" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      <input name="code" required placeholder="POS-CIMAHI" className="rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase" />
      <select name="type" className="rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="pos">Lokasi POS</option><option value="warehouse">Gudang</option><option value="online">Online tambahan</option></select>
      <button disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Tambah lokasi</button>
    </form>

    <form action={submitTransfer} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div><h2 className="font-semibold text-foreground">Transfer stok</h2><p className="text-xs text-muted-foreground">Pemindahan dicatat sebagai transfer keluar dan transfer masuk.</p></div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <select value={fromLocationId} onChange={e => setFromLocationId(Number(e.target.value))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value={0}>Lokasi asal</option>{data.locations.filter(l => l.isActive).map(l => <option key={l.id} value={l.id}>Dari: {l.name}</option>)}</select>
        <select value={toLocationId} onChange={e => setToLocationId(Number(e.target.value))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value={0}>Lokasi tujuan</option>{data.locations.filter(l => l.isActive).map(l => <option key={l.id} value={l.id}>Ke: {l.name}</option>)}</select>
        <select name="item" required value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="">Pilih produk / varian</option>{allRows.map(row => <option key={`${row.productId}:${row.variantId ?? 0}`} value={`${row.productId}:${row.variantId ?? 0}`}>{row.name} · {row.detail}</option>)}</select>
        <input name="quantity" type="number" min={1} required placeholder="Jumlah" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-col gap-3 md:flex-row"><input name="notes" maxLength={500} placeholder="Catatan transfer (opsional)" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" /><button disabled={pending || !fromLocationId || !toLocationId || fromLocationId === toLocationId || !selectedItem} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{pending ? "Memproses..." : "Transfer stok"}</button></div>
    </form>

    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row">
        <select value={locationId} onChange={e => setLocationId(Number(e.target.value))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {data.locations.map(l => <option key={l.id} value={l.id}>{l.name}{l.isOnlineDefault ? " · sumber online" : ""}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari produk, varian, atau SKU" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </div>
      <div className="divide-y divide-border">
        {rows.map(row => <StockRow key={`${locationId}:${row.productId}:${row.variantId ?? 0}`} row={row} initial={balances.get(`${row.productId}:${row.variantId ?? 0}`) ?? 0} disabled={pending || !locationId} onSave={saveStock} />)}
      </div>
    </div>

    <div className="rounded-xl border border-border bg-card">
      <div className="space-y-3 border-b border-border p-4"><div><h2 className="font-semibold text-foreground">Histori mutasi</h2><p className="text-xs text-muted-foreground">Menampilkan maksimal 200 mutasi terbaru.</p></div><div className="grid gap-2 md:grid-cols-4">
        <select value={movementLocation} onChange={e => setMovementLocation(Number(e.target.value))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value={0}>Semua lokasi</option>{data.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <select value={movementType} onChange={e => setMovementType(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm"><option value="">Semua jenis</option>{Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <input value={movementSearch} onChange={e => setMovementSearch(e.target.value)} placeholder="Cari produk atau catatan" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <input type="date" value={movementDate} onChange={e => setMovementDate(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
      </div></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Waktu</th><th className="px-4 py-3">Lokasi</th><th className="px-4 py-3">Produk</th><th className="px-4 py-3">Jenis</th><th className="px-4 py-3 text-right">Perubahan</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3">Pelaksana / catatan</th></tr></thead><tbody className="divide-y divide-border">
        {filteredMovements.map(movement => <tr key={movement.id}><td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{movement.createdAt ? new Date(movement.createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : "-"}</td><td className="px-4 py-3">{locationNames.get(movement.locationId) ?? "-"}</td><td className="px-4 py-3"><p className="font-medium">{productNames.get(movement.productId) ?? `Produk #${movement.productId}`}</p>{movement.variantId && <p className="text-xs text-muted-foreground">{variantNames.get(movement.variantId)}</p>}</td><td className="px-4 py-3"><span className="whitespace-nowrap rounded-full bg-muted px-2 py-1 text-xs">{movementLabels[movement.type] ?? movement.type}{movement.referenceId ? ` #${movement.referenceId}` : ""}</span></td><td className={`px-4 py-3 text-right font-semibold ${movement.quantityDelta > 0 ? "text-emerald-600" : "text-rose-600"}`}>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}</td><td className="px-4 py-3 text-right">{movement.balanceAfter}</td><td className="max-w-64 px-4 py-3"><p>{movement.actorName ?? "Sistem"}</p>{movement.notes && <p className="truncate text-xs text-muted-foreground" title={movement.notes}>{movement.notes}</p>}</td></tr>)}
        {filteredMovements.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Belum ada mutasi yang sesuai filter.</td></tr>}
      </tbody></table></div>
    </div>
  </div>;
}

function StockRow({ row, initial, disabled, onSave }: { row: { productId: number; variantId: number | null; name: string; detail: string }; initial: number; disabled: boolean; onSave: (productId: number, variantId: number | null, quantity: number) => void }) {
  const [value, setValue] = useState(initial);
  return <div className="flex items-center gap-4 p-4">
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{row.name}</p><p className="text-xs text-muted-foreground">{row.detail}</p></div>
    <input type="number" min={0} value={value} onChange={e => setValue(Math.max(0, Number(e.target.value)))} className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-right text-sm" />
    <button type="button" disabled={disabled} onClick={() => onSave(row.productId, row.variantId, value)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50">Simpan</button>
  </div>;
}
