// app/(admin)/dashboard/products/create/page.tsx
import { getCategories } from '@/app/actions/products';
import { ProductForm } from '../_components/ProductForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function CreateProductPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Tambah Produk</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tambah produk baru ke toko</p>
      </div>

      <div className="max-w-2xl">
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
