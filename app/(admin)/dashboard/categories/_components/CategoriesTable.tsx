'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Pencil } from 'lucide-react';
import Link from 'next/link';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { DeleteCategoryButton } from './DeleteCategoryButton';
import type { Category } from '@/lib/db/schema';

const columns: ColumnDef<Category>[] = [
  {
    accessorKey: 'name',
    header: 'Nama',
    cell: ({ row }) => (
      <span className="font-medium text-slate-800">{row.getValue('name')}</span>
    ),
  },
  {
    accessorKey: 'slug',
    header: 'Slug',
    cell: ({ row }) => (
      <span className="text-sm text-slate-500 font-mono">{row.getValue('slug')}</span>
    ),
  },
  {
    accessorKey: 'description',
    header: 'Deskripsi',
    cell: ({ row }) => (
      <span className="text-sm text-slate-500 max-w-xs truncate block">
        {(row.getValue('description') as string) || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Tanggal',
    cell: ({ row }) => {
      const date = row.getValue('createdAt');
      return (
        <span className="text-sm text-slate-500">
          {date ? formatDate(date as Date) : '-'}
        </span>
      );
    },
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Aksi</span>,
    cell: ({ row }) => {
      const cat = row.original;
      return (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/categories/${cat.id}/edit`}>
              <Pencil className="w-4 h-4 text-primary" />
            </Link>
          </Button>
          <DeleteCategoryButton id={cat.id} name={cat.name} />
        </div>
      );
    },
  },
];

interface Props {
  data: Category[];
}

export function CategoriesTable({ data }: Props) {
  return <DataTable columns={columns} data={data} emptyMessage="Belum ada kategori" />;
}
