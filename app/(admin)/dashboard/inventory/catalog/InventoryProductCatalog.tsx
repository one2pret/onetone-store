"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { PackageSearch, Search } from "lucide-react";

type CatalogData = NonNullable<Awaited<ReturnType<typeof import("@/app/actions/inventory-workspace").getInventoryProductCatalog>>>;
type CatalogRow = {
  key: string;
  productId: number;
  variantId: number | null;
  name: string;
  detail: string;
  sku: string | null;
  barcode: string | null;
  image: string | null;
  active: boolean;
};

export function InventoryProductCatalog({ data }: { data: CatalogData }) {
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState(0);
  const [activeOnly, setActiveOnly] = useState(true);
  const balances = useMemo(() => new Map(data.balances.map(balance => [`${balance.locationId}:${balance.productId}:${balance.variantId ?? 0}`, balance])), [data.balances]);
  const rows = useMemo<CatalogRow[]>(() => data.products.flatMap<CatalogRow>(product => {
    const variants = data.variants.filter(variant => variant.productId === product.id);
    if (variants.length === 0) {
      return [{ key: `${product.id}:0`, productId: product.id, variantId: null, name: product.posName?.trim() || product.name, detail: "Tanpa varian", sku: null, barcode: data.barcodes.find(code => code.productId === product.id && code.variantId === null)?.code ?? null, image: product.image, active: Boolean(product.isActive) }];
    }
    return variants.map(variant => ({ key: `${product.id}:${variant.id}`, productId: product.id, variantId: variant.id, name: product.posName?.trim() || product.name, detail: variant.posLabel?.trim() || `${variant.size} / ${variant.color}`, sku: variant.sku, barcode: data.barcodes.find(code => code.variantId === variant.id)?.code ?? null, image: product.image, active: Boolean(product.isActive && variant.isActive) }));
  }), [data]);
  const filtered = useMemo(() => rows.filter(row => {
    const haystack = `${row.name} ${row.detail} ${row.sku ?? ""} ${row.barcode ?? ""}`.toLowerCase();
    return (!activeOnly || row.active) && (!search || haystack.includes(search.toLowerCase()));
  }), [activeOnly, rows, search]);
  const shownLocations = locationId ? data.locations.filter(location => location.id === locationId) : data.locations;

  return <div className="overflow-hidden rounded-xl border border-border bg-card">
    <div className="grid gap-2 border-b border-border p-4 md:grid-cols-[minmax(0,1fr)_240px_auto] md:items-center">
      <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari produk, varian, SKU, atau barcode" className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm" /></label>
      <select value={locationId} onChange={event => setLocationId(Number(event.target.value))} className="h-9 rounded-lg border border-border bg-background px-3 text-sm"><option value={0}>Semua lokasi saya</option>{data.locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
      <label className="flex items-center gap-2 whitespace-nowrap text-sm text-foreground"><input type="checkbox" checked={activeOnly} onChange={event => setActiveOnly(event.target.checked)} className="h-4 w-4 accent-primary" /> Produk aktif</label>
    </div>
    {filtered.length === 0 ? <div className="px-4 py-16 text-center"><PackageSearch className="mx-auto h-10 w-10 text-muted-foreground/40" /><p className="mt-3 text-sm text-muted-foreground">Produk tidak ditemukan.</p></div> : <div className="divide-y divide-border">{filtered.map(row => <div key={row.key} className="flex min-w-0 gap-3 p-3 md:p-4">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">{row.image ? <Image src={row.image} alt={`${row.name} ${row.detail}`} fill unoptimized sizes="56px" className="object-cover" /> : <PackageSearch className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground" />}</div>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-foreground">{row.name}</p>{!row.active && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Nonaktif</span>}</div><p className="text-xs text-muted-foreground">{row.detail}{row.sku ? ` · SKU ${row.sku}` : ""}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">{row.barcode || "Barcode belum diatur"}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">{shownLocations.map(location => { const balance = balances.get(`${location.id}:${row.productId}:${row.variantId ?? 0}`); const quantity = balance?.quantity ?? 0; const available = Math.max(0, quantity - (balance?.reserved ?? 0)); return <span key={location.id} className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground"><strong className="text-foreground">{location.name}</strong>: {quantity}{balance?.reserved ? ` · tersedia ${available}` : ""}</span>; })}</div>
      </div>
    </div>)}</div>}
  </div>;
}
