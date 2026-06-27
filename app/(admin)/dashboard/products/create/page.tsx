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
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">Tambah Produk</h1>
        <p className="text-sm text-slate-500 mt-0.5">Tambah produk baru ke toko</p>
      </div>

      <div className="max-w-2xl bg-white rounded-xl border border-slate-200/60 shadow-sm p-5 md:p-6">
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
