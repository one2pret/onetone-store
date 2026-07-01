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

  if (!product) notFound();

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
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Edit Produk</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{product.name}</p>
      </div>

      <div className="max-w-2xl">
        <ProductForm product={product} categories={categories} />
      </div>
    </div>
  );
}
