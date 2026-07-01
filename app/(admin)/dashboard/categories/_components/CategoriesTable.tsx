// app/(admin)/dashboard/categories/_components/CategoriesTable.tsx
'use client';

import Link from 'next/link';
import { Pencil, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { DeleteCategoryButton } from './DeleteCategoryButton';
import type { Category } from '@/lib/db/schema';

interface Props {
  data: Category[];
}

export function CategoriesTable({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground mb-2">Belum ada kategori</p>
        <Link href="/dashboard/categories/create" className="text-primary hover:opacity-80 text-sm font-medium">
          Tambah Kategori Pertama
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="hidden md:grid grid-cols-[1.5fr_1fr_2fr_1fr_auto] gap-4 px-6 py-3 bg-muted/50 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nama</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Slug</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deskripsi</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tanggal</span>
        <span className="sr-only">Aksi</span>
      </div>

      <div className="divide-y divide-border">
        {data.map((cat) => (
          <div
            key={cat.id}
            className="flex flex-col md:grid md:grid-cols-[1.5fr_1fr_2fr_1fr_auto] gap-2 md:gap-4 items-start md:items-center px-4 md:px-6 py-4 hover:bg-muted/20 transition"
          >
            <span className="font-medium text-foreground">{cat.name}</span>
            <span className="text-sm text-muted-foreground font-mono">{cat.slug}</span>
            <span className="text-sm text-muted-foreground truncate max-w-xs">
              {cat.description || <span className="italic opacity-50">Tidak ada deskripsi</span>}
            </span>
            <span className="text-sm text-muted-foreground">
              {cat.createdAt ? formatDate(cat.createdAt) : '-'}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" asChild title="Edit kategori">
                <Link href={`/dashboard/categories/${cat.id}/edit`}>
                  <Pencil className="w-4 h-4 text-primary" />
                </Link>
              </Button>
              <DeleteCategoryButton id={cat.id} name={cat.name} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
