// app/(admin)/dashboard/products/page.tsx
import { getProducts } from '@/app/actions/products';
import Link from 'next/link';
import { Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductsTable } from './_components/ProductsTable';

export default async function AdminProductsPage() {
  const products = await getProducts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Produk</h1>
          <p className="text-sm text-slate-500 mt-0.5">{products.length} produk terdaftar</p>
        </div>
        <Button asChild size="sm" className="bg-primary hover:bg-primary-hover text-white rounded-lg">
          <Link href="/dashboard/products/create">
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Produk
          </Link>
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
        <ProductsTable data={products} />
      </div>
    </div>
  );
}
