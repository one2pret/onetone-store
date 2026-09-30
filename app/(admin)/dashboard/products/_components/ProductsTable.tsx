// app/(admin)/dashboard/products/_components/ProductsTable.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Pencil, ShoppingBag, Search, X, SlidersHorizontal, ScanBarcode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRupiah, cn } from '@/lib/utils';
import { DeleteProductButton } from './DeleteProductButton';
import { useQueryState } from 'nuqs';
import { useCallback, useMemo } from 'react';
import type { Product, Category } from '@/lib/db/schema';
import { useBarcodeScanner } from '@/components/hooks/use-barcode-scanner';
import { toast } from 'sonner';
import { CameraBarcodeScanner } from '@/components/scanner/CameraBarcodeScanner';

type ProductWithCategory = Product & { category: Category | null };

function isValidImageUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const p = new URL(url);
    return p.protocol === 'https:' && p.hostname.length > 0;
  } catch { return false; }
}

const STATUS_FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'featured', label: 'Unggulan' },
];

interface Props {
  data: ProductWithCategory[];
  categories: Category[];
  searchData: {
    variants: { id: number; productId: number; size: string; color: string; sku: string | null; posLabel: string | null; isActive: boolean | null }[];
    barcodes: { code: string; productId: number; variantId: number | null }[];
  };
}

export function ProductsTable({ data, categories, searchData }: Props) {
  const [search, setSearch] = useQueryState('search', { defaultValue: '' });
  const [categoryId, setCategoryId] = useQueryState('category', { defaultValue: '' });
  const [status, setStatus] = useQueryState('status', { defaultValue: '' });
  const { variants, barcodes } = searchData;

  const hasFilter = search !== '' || categoryId !== '' || status !== '';

  const variantsByProduct = useMemo(() => {
    const grouped = new Map<number, typeof variants>();
    for (const variant of variants) {
      const current = grouped.get(variant.productId) ?? [];
      current.push(variant);
      grouped.set(variant.productId, current);
    }
    return grouped;
  }, [variants]);

  const barcodesByProduct = useMemo(() => {
    const grouped = new Map<number, typeof barcodes>();
    for (const barcode of barcodes) {
      const current = grouped.get(barcode.productId) ?? [];
      current.push(barcode);
      grouped.set(barcode.productId, current);
    }
    return grouped;
  }, [barcodes]);

  const barcodeTargets = useMemo(() => new Map(barcodes.map(barcode => {
    const product = data.find(item => item.id === barcode.productId);
    const variant = barcode.variantId ? variants.find(item => item.id === barcode.variantId) : null;
    return [barcode.code, { product, variant }] as const;
  })), [barcodes, data, variants]);

  const handleScan = useCallback((code: string) => {
    const target = barcodeTargets.get(code);
    setCategoryId(null);
    setStatus(null);
    setSearch(code);
    if (!target?.product) {
      toast.error(`Barcode ${code} tidak ditemukan`);
      return;
    }
    const variantLabel = target.variant ? ` · ${target.variant.size} / ${target.variant.color}` : '';
    toast.success(`${target.product.name}${variantLabel} ditemukan`);
  }, [barcodeTargets, setCategoryId, setSearch, setStatus]);

  useBarcodeScanner(handleScan);

  function resetAll() {
    setSearch(null);
    setCategoryId(null);
    setStatus(null);
  }

  const filtered = useMemo(() => {
    return data.filter(p => {
      const variants = variantsByProduct.get(p.id) ?? [];
      const barcodes = barcodesByProduct.get(p.id) ?? [];
      const haystack = [
        p.name,
        p.posName,
        p.slug,
        p.category?.name,
        ...variants.flatMap(variant => [variant.size, variant.color, variant.sku, variant.posLabel]),
        ...barcodes.map(barcode => barcode.code),
      ].filter(Boolean).join(' ').toLowerCase();
      const matchSearch = !search || haystack.includes(search.toLowerCase());
      const matchCat = !categoryId || String(p.categoryId) === categoryId;
      const matchStatus =
        !status ? true
        : status === 'active' ? p.isActive === true
        : status === 'inactive' ? p.isActive === false
        : status === 'featured' ? p.isFeatured === true
        : true;
      return matchSearch && matchCat && matchStatus;
    });
  }, [barcodesByProduct, categoryId, data, search, status, variantsByProduct]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="px-4 md:px-6 py-3 border-b border-border space-y-3">
        {/* Baris 1: search + kategori + reset */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value || null)}
              placeholder="Cari nama, SKU, varian, atau barcode..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch(null)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <CameraBarcodeScanner onScan={handleScan} className="shrink-0" />

          {/* Filter Kategori */}
          <div className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value || null)}
              className="pl-9 pr-8 py-2 text-sm bg-input border border-border rounded-lg text-foreground outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all appearance-none cursor-pointer min-w-[160px]"
            >
              <option value="">Semua Kategori</option>
              {categories.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Reset button */}
          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAll}
              className="text-muted-foreground hover:text-foreground shrink-0 gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Reset
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <ScanBarcode className="h-4 w-4 shrink-0 text-primary" />
          <span>Scanner USB/Bluetooth siap. Scan barcode atau QR dari area kosong untuk menemukan produk.</span>
        </div>

        {/* Baris 2: filter status + counter */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value || null)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                  status === f.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground shrink-0">
            Menampilkan <span className="font-semibold text-foreground">{filtered.length}</span> dari <span className="font-semibold text-foreground">{data.length}</span> produk
          </p>
        </div>
      </div>

      {/* ── Empty state ── */}
      {filtered.length === 0 && (
        <div className="py-16 text-center">
          <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          {hasFilter ? (
            <>
              <p className="text-muted-foreground mb-2">Tidak ada produk yang cocok</p>
              <button onClick={resetAll} className="text-primary hover:opacity-80 text-sm font-medium">
                Reset filter
              </button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mb-2">Belum ada produk</p>
              <Link href="/dashboard/products/create" className="text-primary hover:opacity-80 text-sm font-medium">
                Tambah Produk Pertama
              </Link>
            </>
          )}
        </div>
      )}

      {/* ── Tabel header ── */}
      {filtered.length > 0 && (
        <>
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-muted/50 border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produk</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kategori</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Harga</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stok</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
            <span className="sr-only">Aksi</span>
          </div>

          <div className="divide-y divide-border">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="flex flex-col md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 md:gap-4 items-start md:items-center px-4 md:px-6 py-4 hover:bg-muted/20 transition"
              >
                {/* Produk */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                    {isValidImageUrl(product.image) ? (
                      <Image src={product.image!} alt={product.name} fill unoptimized className="object-cover" />
                    ) : (
                      <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{product.slug}</p>
                  </div>
                </div>

                {/* Kategori */}
                <div>
                  <span className="text-sm text-muted-foreground">
                    {product.category?.name || <span className="italic text-muted-foreground/60">Tanpa kategori</span>}
                  </span>
                </div>

                {/* Harga */}
                <div>
                  <span className="font-medium text-foreground">{formatRupiah(product.price as string)}</span>
                </div>

                {/* Stok */}
                <div>
                  <span className={cn(
                    'text-sm font-medium',
                    (product.stock ?? 0) === 0 ? 'text-destructive'
                    : (product.stock ?? 0) <= 5 ? 'text-amber-500'
                    : 'text-foreground'
                  )}>
                    {product.stock ?? 0}
                    {(product.stock ?? 0) === 0 && <span className="ml-1 text-xs font-normal">(Habis)</span>}
                  </span>
                </div>

                {/* Status */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    variant={product.isActive ? 'default' : 'secondary'}
                    className={product.isActive
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100'
                      : 'bg-muted text-muted-foreground'
                    }
                  >
                    {product.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                  {product.isFeatured && (
                    <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-100">
                      Unggulan
                    </Badge>
                  )}
                </div>

                {/* Aksi */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" asChild title="Edit produk">
                    <Link href={`/dashboard/products/${product.id}/edit`}>
                      <Pencil className="w-4 h-4 text-primary" />
                    </Link>
                  </Button>
                  <DeleteProductButton id={product.id} name={product.name} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
