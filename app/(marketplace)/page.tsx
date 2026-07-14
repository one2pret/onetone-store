// app/(marketplace)/page.tsx — Marketplace home
import Link from 'next/link';
import { getFeaturedProducts, getActiveProducts, getCategories } from '@/app/actions/products';
import { getActiveBanners } from '@/app/actions/banners';
import { ProductCard } from '@/components/shop/ProductCard';
import { BannerSlider } from '@/components/shop/BannerSlider';
import { Search, ArrowRight, ShoppingBag, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CATEGORY_ICONS: Record<string, string> = {
  default: '📦',
};

export default async function MarketplacePage() {
  const [featuredProducts, newProducts, categories, banners] = await Promise.all([
    getFeaturedProducts(8),
    getActiveProducts({ limit: 8 }),
    getCategories(),
    getActiveBanners(),
  ]);

  return (
    <div className="bg-background min-h-screen">
      {/* ── Search Hero ── */}
      <section className="bg-card border-b border-border py-6 md:py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2 text-balance">
            Temukan Produk Terbaik
          </h1>
          <p className="text-sm text-muted-foreground mb-5">
            Fashion sport premium, dikirim ke seluruh Indonesia.
          </p>
          <div className="relative">
            <input
              type="text"
              placeholder="Cari produk, kategori, atau brand..."
              className="w-full pl-5 pr-14 py-3.5 bg-input border border-border rounded-xl text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none text-foreground"
            />
            <Link
              href="/search"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary-hover text-primary-foreground p-2.5 rounded-lg transition"
            >
              <Search className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      {categories.length > 0 && (
        <section className="py-6 md:py-8 border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                Kategori
              </h2>
              <Link
                href="/categories"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
              >
                Semua <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/products?category=${cat.slug}`}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-card transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center text-lg">
                    {CATEGORY_ICONS[cat.slug] ?? CATEGORY_ICONS.default}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition text-center leading-tight line-clamp-2">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Banners ── */}
      {banners.length > 0 && (
        <section className="py-6 md:py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <BannerSlider banners={banners} />
          </div>
        </section>
      )}

      {/* ── Official Store ── */}
      <section className="py-6 md:py-8 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
            Toko Resmi
          </h2>
          <Link
            href="/stores/onetone"
            className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/40 bg-card hover:bg-surface transition-all group max-w-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <span className="text-primary-foreground font-bold text-lg">O</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Onetone Store</p>
                <span className="px-1.5 py-0.5 bg-premium text-premium-foreground text-[10px] font-semibold rounded-full shrink-0">
                  RESMI
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Fashion sport premium
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground ml-auto shrink-0 transition" />
          </Link>
        </div>
      </section>

      {/* ── Produk Unggulan ── */}
      <section className="py-6 md:py-10 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base md:text-xl font-bold text-foreground">
              Produk Unggulan
            </h2>
            <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              <Link href="/products">
                Lihat Semua <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <ShoppingBag className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Belum ada produk.</p>
              <Button asChild variant="outline" size="sm">
                <Link href="/products">Lihat Semua Produk</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ── New Arrival ── */}
      {newProducts.length > 0 && (
        <section className="py-6 md:py-10 border-t border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base md:text-xl font-bold text-foreground">
                Semua Produk
              </h2>
              <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                <Link href="/products">
                  Lihat Semua <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {newProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
