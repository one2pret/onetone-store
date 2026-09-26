// app/(admin)/dashboard/products/_components/VariantManager.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ChevronDown, ChevronUp, ShoppingBag, ShoppingCart } from 'lucide-react';
import type { ProductVariant } from '@/lib/db/schema';

// ---- Constants ----
const SIZE_OPTIONS = ['FREE SIZE', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const PRESET_COLORS: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#1a1a1a' },
  { name: 'White', hex: '#f5f5f5' },
  { name: 'Navy', hex: '#1b2d5b' },
  { name: 'Grey', hex: '#9ca3af' },
  { name: 'Mauve Wine', hex: '#7B3F5E' },
  { name: 'Dusty Rose', hex: '#c4a0a0' },
  { name: 'Sage Green', hex: '#8fa98f' },
  { name: 'Caramel', hex: '#c68642' },
  { name: 'Maroon', hex: '#800020' },
  { name: 'Olive', hex: '#7c7c3e' },
];

// ---- Types ----
export interface VariantRow {
  _key: string;
  id?: number;       // DB id jika sudah tersimpan
  size: string;
  color: string;
  colorHex: string;
  stock: number;
  priceModifier: number;
  salePriceOverride: number | null;
  sku: string;
  posLabel: string;
  barcode: string;
  isActive: boolean;
}

function makeKey() {
  return Math.random().toString(36).slice(2);
}

function rowFromVariant(v: ProductVariant, barcode = ''): VariantRow {
  return {
    _key: makeKey(),
    id: v.id,
    size: v.size,
    color: v.color,
    colorHex: v.colorHex ?? '',
    stock: v.stock,
    priceModifier: Number(v.priceModifier ?? 0),
    salePriceOverride: v.salePriceOverride === null ? null : Number(v.salePriceOverride),
    sku: v.sku ?? '',
    posLabel: v.posLabel ?? '',
    barcode,
    isActive: v.isActive ?? true,
  };
}

function emptyRow(): VariantRow {
  return {
    _key: makeKey(),
    size: 'M',
    color: '',
    colorHex: '',
    stock: 0,
    priceModifier: 0,
    salePriceOverride: null,
    sku: '',
    posLabel: '',
    barcode: '',
    isActive: true,
  };
}

// ---- Component ----
interface Props {
  initial?: ProductVariant[];
  basePrice?: number;
  barcodes?: { code: string; variantId: number | null }[];
  onChange: (rows: VariantRow[]) => void;
  /** ID varian yang sudah dipakai di order — tidak bisa dihapus, hanya bisa dinonaktifkan */
  usedInOrderIds?: number[];
  /** ID varian yang ada di cart aktif */
  usedInCartIds?: number[];
}

export function VariantManager({ initial = [], basePrice = 0, barcodes = [], onChange, usedInOrderIds = [], usedInCartIds = [] }: Props) {
  const orderIdSet = new Set(usedInOrderIds);
  const cartIdSet = new Set(usedInCartIds);
  const [rows, setRows] = useState<VariantRow[]>(() =>
    initial.length > 0 ? initial.map(variant => rowFromVariant(variant, barcodes.find(barcode => barcode.variantId === variant.id)?.code ?? '')) : []
  );
  const [collapsed, setCollapsed] = useState(false);

  function sync(next: VariantRow[]) {
    setRows(next);
    onChange(next);
  }

  function add() {
    sync([...rows, emptyRow()]);
  }

  function remove(key: string) {
    sync(rows.filter((r) => r._key !== key));
  }

  function update(key: string, field: keyof VariantRow, value: unknown) {
    sync(rows.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
  }

  // FIX: apply both color + hex in one atomic sync call
  function applyPresetColor(pc: { name: string; hex: string }) {
    // Find first row with empty color, or target last row
    const idx = rows.findIndex((r) => r.color === '');
    const targetIdx = idx !== -1 ? idx : rows.length - 1;
    if (targetIdx < 0) return;
    const targetKey = rows[targetIdx]._key;
    sync(
      rows.map((r) =>
        r._key === targetKey
          ? { ...r, color: pc.name, colorHex: pc.hex }
          : r
      )
    );
  }

  const totalStock = rows.reduce((s, r) => s + (r.stock || 0), 0);
  const variantCount = rows.length;

  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
      {/* Header */}
      <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">Varian Produk</h2>
          {variantCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {variantCount} varian &bull; Total stok: {totalStock}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
            className="h-8 gap-1 px-2 text-xs"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            {collapsed ? 'Tampilkan' : 'Sembunyikan'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={add}
            className="h-8 gap-1 text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Varian
          </Button>
        </div>
      </div>

      {!collapsed && (
        <>
          {rows.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
              <p className="text-sm text-muted-foreground mb-3">
                Belum ada varian. Tambahkan ukuran &amp; warna produk.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> Tambah Varian Pertama
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {rows.map((row) => (
                <VariantRowItem
                  key={row._key}
                  row={row}
                  basePrice={basePrice}
                  onUpdate={(field, value) => update(row._key, field, value)}
                  onRemove={() => remove(row._key)}
                  isUsedInOrder={row.id !== undefined && orderIdSet.has(row.id)}
                  isUsedInCart={row.id !== undefined && cartIdSet.has(row.id)}
                />
              ))}
            </div>
          )}

          {/* Preset Color Quick-Pick */}
          {rows.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">
                Preset Warna ONETONE. Klik untuk mengisi baris kosong atau baris terakhir:
              </p>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((pc) => (
                  <button
                    key={pc.name}
                    type="button"
                    title={`Isi warna: ${pc.name}`}
                    className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-border bg-background hover:bg-muted transition-colors"
                    onClick={() => applyPresetColor(pc)}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-border/60 inline-block shrink-0"
                      style={{ background: pc.hex }}
                    />
                    {pc.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---- Single row ----
function VariantRowItem({
  row,
  basePrice,
  onUpdate,
  onRemove,
  isUsedInOrder = false,
  isUsedInCart = false,
}: {
  row: VariantRow;
  basePrice: number;
  onUpdate: (field: keyof VariantRow, value: unknown) => void;
  onRemove: () => void;
  isUsedInOrder?: boolean;
  isUsedInCart?: boolean;
}) {
  const hasBadge = isUsedInOrder || isUsedInCart;

  return (
    <div
      className={`min-w-0 space-y-4 rounded-lg border p-4 transition-colors sm:p-5 ${
        !row.isActive
          ? 'border-destructive/20 bg-destructive/5 opacity-60'
          : isUsedInOrder
          ? 'border-amber-500/40 bg-amber-500/5'
          : isUsedInCart
          ? 'border-blue-500/30 bg-blue-500/5'
          : 'border-border'
      }`}
    >
      {/* Identitas dan stok */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
        {/* Ukuran */}
        <div className="min-w-0 xl:col-span-2">
          <Label className="mb-1.5 block text-xs font-medium text-foreground">Ukuran <span className="text-destructive">*</span></Label>
          <select
            value={row.size}
            onChange={(e) => onUpdate('size', e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Warna */}
        <div className="min-w-0 xl:col-span-4">
          <Label className="mb-1.5 block text-xs font-medium text-foreground">Warna <span className="text-destructive">*</span></Label>
          <Input
            value={row.color}
            onChange={(e) => onUpdate('color', e.target.value)}
            placeholder="Mauve Wine"
            className="h-9 min-w-0 text-sm"
          />
        </div>

        {/* Color Hex */}
        <div className="min-w-0 xl:col-span-3">
          <Label className="mb-1.5 block text-xs font-medium text-foreground">Warna Hex</Label>
          <div className="flex min-w-0 items-center gap-2">
            <input
              type="color"
              value={row.colorHex || '#888888'}
              onChange={(e) => onUpdate('colorHex', e.target.value)}
              className="h-9 w-10 shrink-0 cursor-pointer rounded border border-input bg-background p-1"
              title="Pilih warna"
            />
            <Input
              value={row.colorHex}
              onChange={(e) => onUpdate('colorHex', e.target.value)}
              placeholder="#7B3F5E"
              className="h-9 min-w-0 flex-1 font-mono text-sm"
              maxLength={7}
            />
          </div>
        </div>

        {/* Stok */}
        <div className="min-w-0 xl:col-span-3">
          <Label className="mb-1.5 block text-xs font-medium text-foreground">Stok <span className="text-destructive">*</span></Label>
          <Input
            type="number"
            min={0}
            value={row.stock}
            onChange={(e) => onUpdate('stock', Number(e.target.value))}
            className="h-9 min-w-0 text-sm tabular-nums"
          />
        </div>
      </div>

      {/* Harga, SKU, dan status */}
      <div className="grid min-w-0 grid-cols-1 gap-4 border-t border-border/70 pt-4 sm:grid-cols-2 xl:grid-cols-12">
        {/* Price Modifier */}
        <div className="min-w-0 xl:col-span-3">
          <Label className="mb-1.5 block text-xs font-medium text-foreground">Selisih harga</Label>
          <Input
            type="number"
            value={row.priceModifier}
            onChange={(e) => onUpdate('priceModifier', Number(e.target.value))}
            placeholder="0"
            className="h-9 min-w-0 text-sm tabular-nums"
            title={`Bukan harga final. Harga varian saat ini: Rp ${(basePrice + row.priceModifier).toLocaleString('id-ID')}`}
          />
          <p className="mt-1.5 text-xs leading-4 text-muted-foreground">Harga akhir: Rp {(basePrice + row.priceModifier).toLocaleString('id-ID')}</p>
        </div>

        {/* Harga Promo */}
        <div className="min-w-0 xl:col-span-3">
          <Label className="mb-1.5 block text-xs font-medium text-foreground">Harga Promo</Label>
          <Input
            type="number"
            min={0}
            value={row.salePriceOverride ?? ''}
            onChange={(e) => onUpdate('salePriceOverride', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="Ikuti produk"
            className="h-9 min-w-0 text-sm tabular-nums"
            title="Harga final promo varian; kosongkan untuk mengikuti promo produk"
          />
        </div>

        {/* SKU */}
        <div className="min-w-0 xl:col-span-3">
          <Label className="mb-1.5 block text-xs font-medium text-foreground">SKU</Label>
          <Input
            value={row.sku}
            onChange={(e) => onUpdate('sku', e.target.value)}
            placeholder="OT-001-M-BK"
            className="h-9 min-w-0 font-mono text-sm"
          />
        </div>

        {/* Status dan aksi */}
        <div className="flex min-w-0 items-end justify-between gap-3 sm:col-span-2 xl:col-span-3 xl:justify-end">
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground xl:flex-1 xl:justify-center">
            <input
              type="checkbox"
              checked={row.isActive}
              onChange={(e) => onUpdate('isActive', e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
            />
            Aktif
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={isUsedInOrder}
            title={isUsedInOrder ? 'Tidak bisa dihapus karena sudah ada di pesanan. Nonaktifkan saja.' : 'Hapus varian'}
            className="h-9 shrink-0 gap-1.5 px-3 text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Trash2 className="w-4 h-4" />
            Hapus
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 border-t border-border/70 pt-4 md:grid-cols-2">
        <div className="min-w-0">
          <Label className="mb-1.5 block text-xs font-medium text-foreground">Label pendek POS</Label>
          <Input value={row.posLabel} maxLength={60} onChange={(e) => onUpdate('posLabel', e.target.value)} placeholder={`${row.size} / ${row.color || 'Warna'}`} className="h-9 min-w-0 text-sm" />
          <p className="mt-1.5 text-xs leading-4 text-muted-foreground">Nama ringkas untuk layar kasir dan struk.</p>
        </div>
        <div className="min-w-0">
          <Label className="mb-1.5 block text-xs font-medium text-foreground">Barcode varian</Label>
          <Input value={row.barcode} maxLength={100} onChange={(e) => onUpdate('barcode', e.target.value)} placeholder="899000000001" className="h-9 min-w-0 font-mono text-sm" />
          <p className="mt-1.5 text-xs leading-4 text-muted-foreground">Opsional dan harus unik untuk setiap varian.</p>
        </div>
      </div>

      {/* Badge usage — di dalam row, di bawah inputs */}
      {hasBadge && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {isUsedInOrder && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <ShoppingBag className="w-2.5 h-2.5" /> Ada di pesanan. Nonaktifkan saja, jangan hapus
            </span>
          )}
          {isUsedInCart && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
              <ShoppingCart className="w-2.5 h-2.5" /> Ada di keranjang pembeli. Nonaktifkan saja jika ingin menyembunyikannya
            </span>
          )}
        </div>
      )}
    </div>
  );
}
