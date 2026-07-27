// app/(admin)/dashboard/products/page.tsx
import { getProducts, getCategories } from '@/app/actions/products';
import { ProductsTable } from './_components/ProductsTable';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Upload } from 'lucide-react';

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
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/products/import">
              <Upload className="w-4 h-4 mr-1.5" />
              Import CSV
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/products/create">
              <Plus className="w-4 h-4 mr-1.5" />
              Tambah Produk
            </Link>
          </Button>
        </div>
      </div>

      <ProductsTable data={products} categories={categories} />
    </div>
  );
}
