// app/(shop)/products/page.tsx
import { getActiveProducts, getCategories } from '@/app/actions/products';
import { ProductCard } from '@/components/shop/ProductCard';
import Link from 'next/link';
import { CategorySelect } from '@/components/shop/CategorySelect';
import { ShoppingBag, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  const emptyIsSearch = !!params.search;
  const emptyIsCategory = !!params.category && !params.search;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex gap-8">

        {/* Sidebar — Categories */}
        <aside className="hidden md:block w-56 shrink-0">
          <div className="sticky top-24">
            <h3 className="font-semibold text-foreground text-sm mb-3">Kategori</h3>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href="/products"
                  className={`block px-3 py-2 rounded-lg text-sm transition ${
                    !params.category
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  Semua Koleksi
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/products?category=${category.slug}`}
                    className={`block px-3 py-2 rounded-lg text-sm transition ${
                      params.category === category.slug
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
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
        <main className="flex-1 min-w-0">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">
              {currentCategory ? currentCategory.name : 'Semua Koleksi'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {products.length > 0
                ? `${products.length} produk tersedia`
                : 'Tidak ada produk ditemukan'}
            </p>
          </div>

          {/* Mobile Category Filter */}
          <div className="md:hidden mb-4">
            <CategorySelect categories={categories} currentCategory={params.category} />
          </div>

          {/* Products Grid */}
          {products.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                {emptyIsSearch ? (
                  <Search className="w-6 h-6" />
                ) : (
                  <ShoppingBag className="w-6 h-6" />
                )}
              </div>
              <div>
                {emptyIsSearch ? (
                  <>
                    <p className="text-base font-semibold text-foreground mb-1">
                      Tidak ada hasil untuk &ldquo;{params.search}&rdquo;
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Coba kata kunci lain atau jelajahi semua koleksi.
                    </p>
                  </>
                ) : emptyIsCategory ? (
                  <>
                    <p className="text-base font-semibold text-foreground mb-1">
                      Belum ada produk di kategori ini.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Cek kategori lain atau lihat semua koleksi kami.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-base font-semibold text-foreground mb-1">
                      Koleksi segera hadir.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Kami sedang menyiapkan produk terbaik untuk kamu.
                    </p>
                  </>
                )}
              </div>
              <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary-hover hover:bg-primary/5">
                <Link href="/products">Lihat Semua Koleksi</Link>
              </Button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
