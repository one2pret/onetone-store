// app/(admin)/dashboard/products/[id]/edit/page.tsx
import { getProduct, getCategories } from '@/app/actions/products';
import { ProductForm } from '../../_components/ProductForm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProduct(Number(id)),
    getCategories(),
  ]);

  if (!product) {
    notFound();
  }

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
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">Edit Produk</h1>
        <p className="text-sm text-slate-500 mt-0.5">{product.name}</p>
      </div>

      <div className="max-w-2xl bg-white rounded-xl border border-slate-200/60 shadow-sm p-5 md:p-6">
        <ProductForm product={product} categories={categories} />
      </div>
    </div>
  );
}
