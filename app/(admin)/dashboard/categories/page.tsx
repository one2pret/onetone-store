// app/(admin)/dashboard/categories/page.tsx
import { getAllCategories } from '@/app/actions/categories';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CategoriesTable } from './_components/CategoriesTable';

export default async function AdminCategoriesPage() {
  const categories = await getAllCategories();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Kategori</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola kategori produk</p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/categories/create">
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Kategori
          </Link>
        </Button>
      </div>

      <CategoriesTable data={categories} />
    </div>
  );
}
