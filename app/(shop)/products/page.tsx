// app/(shop)/products/page.tsx
import { getActiveProducts, getCategories } from '@/app/actions/products';
import { ProductCard } from '@/components/shop/ProductCard';
import Link from 'next/link';
import { CategorySelect } from '@/components/shop/CategorySelect';

interface Props {
  searchParams: Promise<{ category?: string; search?: string }>;
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  const [products, categories] = await Promise.all([
    getActiveProducts({
      categorySlug: params.category,
      search: params.search,
    }),
    getCategories(),
  ]);

  const currentCategory = categories.find(c => c.slug === params.category);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex gap-8">
        {/* Sidebar - Categories */}
        <aside className="hidden md:block w-64 flex-shrink-0">
          <div className="sticky top-24">
            <h3 className="font-semibold text-slate-800 mb-4">Kategori</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/products"
                  className={`block px-3 py-2 rounded-lg transition ${
                    !params.category
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  Semua Produk
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/products?category=${category.slug}`}
                    className={`block px-3 py-2 rounded-lg transition ${
                      params.category === category.slug
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-800">
              {currentCategory ? currentCategory.name : 'Semua Produk'}
            </h1>
            <p className="text-slate-500">
              {products.length} produk ditemukan
            </p>
          </div>

          {/* Mobile Category Filter */}
          <div className="md:hidden mb-4">
            <CategorySelect categories={categories} currentCategory={params.category} />
          </div>

          {/* Products Grid */}
          {products.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500">Tidak ada produk ditemukan.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
