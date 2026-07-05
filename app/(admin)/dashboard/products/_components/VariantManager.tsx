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
  sku: string;
  isActive: boolean;
}

function makeKey() {
  return Math.random().toString(36).slice(2);
}

function rowFromVariant(v: ProductVariant): VariantRow {
  return {
    _key: makeKey(),
    id: v.id,
    size: v.size,
    color: v.color,
    colorHex: v.colorHex ?? '',
    stock: v.stock,
    priceModifier: Number(v.priceModifier ?? 0),
    sku: v.sku ?? '',
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
    sku: '',
    isActive: true,
  };
}

// ---- Component ----
interface Props {
  initial?: ProductVariant[];
  onChange: (rows: VariantRow[]) => void;
  /** ID varian yang sudah dipakai di order — tidak bisa dihapus, hanya bisa dinonaktifkan */
  usedInOrderIds?: number[];
  /** ID varian yang ada di cart aktif */
  usedInCartIds?: number[];
}

export function VariantManager({ initial = [], onChange, usedInOrderIds = [], usedInCartIds = [] }: Props) {
  const orderIdSet = new Set(usedInOrderIds);
  const cartIdSet = new Set(usedInCartIds);
  const [rows, setRows] = useState<VariantRow[]>(() =>
    initial.length > 0 ? initial.map(rowFromVariant) : []
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
    <div className="bg-card border border-border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Varian Produk</h2>
          {variantCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {variantCount} varian &bull; Total stok: {totalStock}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
            className="h-7 px-2 text-xs gap-1"
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            {collapsed ? 'Tampilkan' : 'Sembunyikan'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={add}
            className="h-7 text-xs gap-1"
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
            <div className="space-y-3 mt-4">
              {/* Column headers */}
              <div className="hidden md:grid grid-cols-[100px_1fr_80px_80px_80px_80px_40px_32px] gap-2 text-xs text-muted-foreground font-medium px-1">
                <span>Ukuran *</span>
                <span>Warna *</span>
                <span>Warna Hex</span>
                <span>Stok *</span>
                <span>+/- Harga</span>
                <span>SKU</span>
                <span className="text-center">Aktif</span>
                <span></span>
              </div>

              {rows.map((row) => (
                <VariantRowItem
                  key={row._key}
                  row={row}
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
                Preset Warna ONETONE — klik untuk mengisi baris kosong (atau baris terakhir):
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
  onUpdate,
  onRemove,
  isUsedInOrder = false,
  isUsedInCart = false,
}: {
  row: VariantRow;
  onUpdate: (field: keyof VariantRow, value: unknown) => void;
  onRemove: () => void;
  isUsedInOrder?: boolean;
  isUsedInCart?: boolean;
}) {
  const hasBadge = isUsedInOrder || isUsedInCart;

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 space-y-2 transition-colors ${
        !row.isActive
          ? 'border-destructive/20 bg-destructive/5 opacity-60'
          : isUsedInOrder
          ? 'border-amber-500/40 bg-amber-500/5'
          : isUsedInCart
          ? 'border-blue-500/30 bg-blue-500/5'
          : 'border-border'
      }`}
    >
      {/* Input baris */}
      <div className="grid grid-cols-2 md:grid-cols-[100px_1fr_80px_80px_80px_80px_40px_32px] gap-2 items-center">
        {/* Ukuran */}
        <div className="md:col-span-1">
          <Label className="text-xs text-muted-foreground md:hidden mb-1 block">Ukuran</Label>
          <select
            value={row.size}
            onChange={(e) => onUpdate('size', e.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background text-foreground px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Warna */}
        <div>
          <Label className="text-xs text-muted-foreground md:hidden mb-1 block">Warna</Label>
          <Input
            value={row.color}
            onChange={(e) => onUpdate('color', e.target.value)}
            placeholder="Mauve Wine"
            className="h-8 text-sm"
          />
        </div>

        {/* Color Hex */}
        <div className="flex gap-1 items-center">
          <Label className="text-xs text-muted-foreground md:hidden mb-1 block">Hex</Label>
          <input
            type="color"
            value={row.colorHex || '#888888'}
            onChange={(e) => onUpdate('colorHex', e.target.value)}
            className="w-8 h-8 rounded border border-input cursor-pointer"
            title="Pilih warna"
          />
          <Input
            value={row.colorHex}
            onChange={(e) => onUpdate('colorHex', e.target.value)}
            placeholder="#7B3F5E"
            className="h-8 text-xs flex-1 font-mono"
            maxLength={7}
          />
        </div>

        {/* Stok */}
        <div>
          <Label className="text-xs text-muted-foreground md:hidden mb-1 block">Stok</Label>
          <Input
            type="number"
            min={0}
            value={row.stock}
            onChange={(e) => onUpdate('stock', Number(e.target.value))}
            className="h-8 text-sm"
          />
        </div>

        {/* Price Modifier */}
        <div>
          <Label className="text-xs text-muted-foreground md:hidden mb-1 block">+/- Harga</Label>
          <Input
            type="number"
            value={row.priceModifier}
            onChange={(e) => onUpdate('priceModifier', Number(e.target.value))}
            placeholder="0"
            className="h-8 text-sm"
          />
        </div>

        {/* SKU */}
        <div>
          <Label className="text-xs text-muted-foreground md:hidden mb-1 block">SKU</Label>
          <Input
            value={row.sku}
            onChange={(e) => onUpdate('sku', e.target.value)}
            placeholder="OT-001-M-BK"
            className="h-8 text-xs font-mono"
          />
        </div>

        {/* Active Toggle */}
        <div className="flex items-center justify-center h-8">
          <input
            type="checkbox"
            checked={row.isActive}
            onChange={(e) => onUpdate('isActive', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
        </div>

        {/* Remove */}
        <div className="flex items-center justify-center h-8">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={isUsedInOrder}
            title={isUsedInOrder ? 'Tidak bisa dihapus — ada di pesanan. Nonaktifkan saja.' : 'Hapus varian'}
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Badge usage — di dalam row, di bawah inputs */}
      {hasBadge && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {isUsedInOrder && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <ShoppingBag className="w-2.5 h-2.5" /> Ada di pesanan — nonaktifkan saja, jangan hapus
            </span>
          )}
          {isUsedInCart && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
              <ShoppingCart className="w-2.5 h-2.5" /> Ada di keranjang pembeli — nonaktifkan saja kalau ingin tidak tampil, jangan hapus
            </span>
          )}
        </div>
      )}
    </div>
  );
}
