// app/(admin)/dashboard/products/page.tsx
import { getProducts, getCategories } from '@/app/actions/products';
import { ProductsTable } from './_components/ProductsTable';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Produk</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{products.length} produk terdaftar</p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/products/create">
            <Plus className="w-4 h-4 mr-1.5" />
            Tambah Produk
          </Link>
        </Button>
      </div>

      <ProductsTable data={products} categories={categories} />
    </div>
  );
}
