// app/(admin)/dashboard/categories/create/page.tsx
import { CategoryForm } from '../_components/CategoryForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CreateCategoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/categories"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Tambah Kategori</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Buat kategori baru untuk produk</p>
      </div>

      <div className="max-w-2xl">
        <CategoryForm />
      </div>
    </div>
  );
}
