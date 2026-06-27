'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Pencil, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRupiah } from '@/lib/utils';
import { DeleteProductButton } from './DeleteProductButton';
import type { Product, Category } from '@/lib/db/schema';

type ProductWithCategory = Product & { category: Category | null };

const columns: ColumnDef<ProductWithCategory>[] = [
  {
    accessorKey: 'name',
    header: 'Produk',
    cell: ({ row }) => {
      const product = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <p className="font-medium text-slate-800">{product.name}</p>
            <p className="text-xs text-slate-400 font-mono">{product.slug}</p>
          </div>
        </div>
      );
    },
  },
  {
    id: 'category',
    header: 'Kategori',
    cell: ({ row }) => (
      <span className="text-sm text-slate-500">
        {row.original.category?.name || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'price',
    header: 'Harga',
    cell: ({ row }) => (
      <span className="font-medium text-slate-800">
        {formatRupiah(row.getValue('price') as string)}
      </span>
    ),
  },
  {
    accessorKey: 'stock',
    header: 'Stok',
    cell: ({ row }) => {
      const stock = (row.getValue('stock') as number) ?? 0;
      return (
        <span className={`text-sm font-medium ${stock <= 5 ? 'text-red-600' : 'text-slate-700'}`}>
          {stock}
        </span>
      );
    },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const product = row.original;
      return (
        <div className="flex items-center gap-2">
          <Badge variant={product.isActive ? 'default' : 'secondary'}
            className={product.isActive ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}>
            {product.isActive ? 'Aktif' : 'Nonaktif'}
          </Badge>
          {product.isFeatured && (
            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
              Featured
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Aksi</span>,
    cell: ({ row }) => {
      const product = row.original;
      return (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/products/${product.id}/edit`}>
              <Pencil className="w-4 h-4 text-primary" />
            </Link>
          </Button>
          <DeleteProductButton id={product.id} name={product.name} />
        </div>
      );
    },
  },
];

interface Props {
  data: ProductWithCategory[];
}

export function ProductsTable({ data }: Props) {
  return <DataTable columns={columns} data={data} emptyMessage="Belum ada produk" />;
}
