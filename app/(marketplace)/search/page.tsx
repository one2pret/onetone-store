// app/(marketplace)/search/page.tsx
import Link from 'next/link';
import { getActiveProducts } from '@/app/actions/products';
import { ProductCard } from '@/components/shop/ProductCard';
import { Search, ArrowLeft } from 'lucide-react';

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const results = query ? await getActiveProducts({ search: query }) : [];

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10">
        {/* Search bar */}
        <form method="get" className="relative mb-6 max-w-xl">
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Cari produk..."
            autoFocus
            className="w-full pl-5 pr-14 py-3.5 bg-input border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none text-foreground"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary-hover text-primary-foreground p-2.5 rounded-lg transition"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke beranda
        </Link>

        {/* Results */}
        {!query ? (
          <p className="text-sm text-muted-foreground">Ketik kata kunci untuk mencari produk.</p>
        ) : results.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-foreground font-semibold mb-1">
              Tidak ada hasil untuk &ldquo;{query}&rdquo;
            </p>
            <p className="text-sm text-muted-foreground">
              Coba kata kunci lain atau{' '}
              <Link href="/products" className="text-foreground underline underline-offset-2">
                lihat semua produk
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-5">
              {results.length} hasil untuk &ldquo;{query}&rdquo;
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
