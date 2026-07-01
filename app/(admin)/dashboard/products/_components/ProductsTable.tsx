// app/(admin)/dashboard/products/_components/ProductsTable.tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Pencil, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRupiah } from '@/lib/utils';
import { DeleteProductButton } from './DeleteProductButton';
import type { Product, Category } from '@/lib/db/schema';

type ProductWithCategory = Product & { category: Category | null };

function isValidImageUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const p = new URL(url);
    return p.protocol === 'https:' && p.hostname.length > 0;
  } catch { return false; }
}

interface Props {
  data: ProductWithCategory[];
}

export function ProductsTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <ShoppingBag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground mb-2">Belum ada produk</p>
        <Link href="/dashboard/products/create" className="text-primary hover:opacity-80 text-sm font-medium">
          Tambah Produk Pertama
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header tabel */}
      <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-muted/50 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produk</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kategori</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Harga</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stok</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
        <span className="sr-only">Aksi</span>
      </div>

      {/* Baris produk */}
      <div className="divide-y divide-border">
        {data.map((product) => (
          <div
            key={product.id}
            className="flex flex-col md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-3 md:gap-4 items-start md:items-center px-4 md:px-6 py-4 hover:bg-muted/20 transition"
          >
            {/* Kolom: Produk */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                {isValidImageUrl(product.image) ? (
                  <Image
                    src={product.image!}
                    alt={product.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{product.slug}</p>
              </div>
            </div>

            {/* Kolom: Kategori */}
            <div className="md:block">
              <span className="text-sm text-muted-foreground">
                {product.category?.name || <span className="italic text-muted-foreground/60">Tanpa kategori</span>}
              </span>
            </div>

            {/* Kolom: Harga */}
            <div>
              <span className="font-medium text-foreground">
                {formatRupiah(product.price as string)}
              </span>
            </div>

            {/* Kolom: Stok */}
            <div>
              <span className={`text-sm font-medium ${
                (product.stock ?? 0) === 0
                  ? 'text-destructive'
                  : (product.stock ?? 0) <= 5
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-foreground'
              }`}>
                {product.stock ?? 0}
                {(product.stock ?? 0) === 0 && (
                  <span className="ml-1 text-xs font-normal text-destructive">(Habis)</span>
                )}
              </span>
            </div>

            {/* Kolom: Status */}
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

            {/* Kolom: Aksi — selalu terlihat */}
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
    </div>
  );
}
