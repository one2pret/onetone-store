// app/(shop)/page.tsx
import Link from 'next/link';
import { getFeaturedProducts, getActiveProducts } from '@/app/actions/products';
import { getActiveBanners } from '@/app/actions/banners';
import { ProductCard } from '@/components/shop/ProductCard';
import { BannerSlider } from '@/components/shop/BannerSlider';
import {
  ArrowRight, Truck, Shield, Headphones, CreditCard,
  RotateCcw, Tag, ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default async function HomePage() {
  const [featuredProducts, newProducts, banners] = await Promise.all([
    getFeaturedProducts(8),
    getActiveProducts({ limit: 4 }),
    getActiveBanners(),
  ]);

  const trustFeatures = [
    { icon: Truck,      title: 'Gratis Ongkir',     desc: 'Pesanan Rp200rb+'        },
    { icon: Shield,     title: 'Garansi Resmi',      desc: '100% Produk Original'    },
    { icon: CreditCard, title: 'Pembayaran Aman',    desc: 'Transfer & E-Wallet'     },
    { icon: Headphones, title: 'Support 24/7',       desc: 'Siap Bantu Kamu'         },
  ];

  const whyFeatures = [
    {
      icon: Tag,
      title: 'Koleksi Selalu Update',
      descShort: 'Tren fashion terbaru hadir setiap minggu. Tampil modis setiap hari.',
      descLong:  'Tren fashion terbaru hadir setiap minggu. Dari pakaian kasual hingga olahraga — semua ada untuk tampil modis setiap hari.',
    },
    {
      icon: Truck,
      title: 'Pengiriman Cepat & Aman',
      descShort: 'Dikemas rapi, dikirim 1x24 jam via JNE, SiCepat, J&T.',
      descLong:  'Pesanan dikemas rapi dengan pelindung khusus dan dikirim dalam 1x24 jam. Didukung JNE, SiCepat, J&T ke seluruh Indonesia.',
    },
    {
      icon: RotateCcw,
      title: 'Gratis Retur 7 Hari',
      descShort: 'Tidak pas atau tidak sesuai? Kembalikan tanpa ribet.',
      descLong:  'Ukuran tidak pas atau warna tidak sesuai foto? Kembalikan dalam 7 hari, kami proses pengembalian tanpa pertanyaan.',
    },
  ];

  return (
    <div className="bg-background">

      {/* ══════════════ BANNER SLIDER ══════════════ */}
      <section>
        <BannerSlider banners={banners} />
      </section>

      {/* ══════════════ TRUST BAR ══════════════ */}
      {/* Unified gold icons, no independent accent colors, divider-based layout */}
      <section className="py-4 md:py-5 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile: 2 items */}
          <div className="flex md:hidden justify-center gap-3">
            {[trustFeatures[0], trustFeatures[1]].map((f) => (
              <div key={f.title} className="flex items-center gap-2 px-4 py-2 rounded-full border border-border">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <f.icon className="w-3 h-3" />
                </div>
                <span className="text-xs font-medium text-foreground">{f.title}</span>
              </div>
            ))}
          </div>
          {/* Desktop: 4 cols separated by dividers */}
          <div className="hidden md:grid grid-cols-4 divide-x divide-border">
            {trustFeatures.map((feature) => (
              <div key={feature.title} className="flex items-center gap-3 px-6 first:pl-0 last:pr-0 py-2">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <feature.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{feature.title}</p>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ PRODUK UNGGULAN ══════════════ */}
      {/* No eyebrow. Direct headline. bg-background (vault black) */}
      <section className="py-10 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6 md:mb-10">
            <div>
              <h2 className="text-xl md:text-3xl font-bold text-foreground text-balance">
                Produk Unggulan
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Pilihan terbaik minggu ini</p>
            </div>
            <Button
              asChild variant="ghost" size="sm"
              className="text-primary hover:text-primary-hover hover:bg-primary/5 text-xs md:text-sm shrink-0"
            >
              <Link href="/products">
                Lihat Semua <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <ShoppingBag className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Koleksi unggulan segera hadir.</p>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════ MEMBER STRIP ══════════════ */}
      {/* Editorial replacement for flash-sale promo block.
          No animation, no circles, no gradient — confident and restrained. */}
      <section className="py-4 md:py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-border bg-card px-6 py-5 md:px-10 md:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-foreground font-semibold text-sm md:text-base text-balance">
                Member mendapat akses lebih awal ke koleksi baru.
              </p>
              <p className="text-muted-foreground text-xs md:text-sm mt-1">
                Gratis. Daftar sekali, nikmati selamanya.
              </p>
            </div>
            <Button
              asChild size="sm"
              className="shrink-0 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg px-5 shadow-md shadow-primary/20"
            >
              <Link href="/register">
                Daftar Sekarang <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ══════════════ KOLEKSI TERBARU ══════════════ */}
      {/* Visually distinct from Produk Unggulan: bg-card (#141414) surface,
          4-col desktop (no 3-col step), different sub-copy and link target */}
      <section className="py-10 md:py-16 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-6 md:mb-10">
            <div>
              <h2 className="text-xl md:text-3xl font-bold text-foreground text-balance">
                Koleksi Terbaru
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Baru masuk minggu ini</p>
            </div>
            <Button
              asChild variant="ghost" size="sm"
              className="text-primary hover:text-primary-hover hover:bg-primary/5 text-xs md:text-sm shrink-0"
            >
              <Link href="/products">
                Lihat Semua <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </div>

          {newProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
              {newProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <ShoppingBag className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Koleksi terbaru segera hadir.</p>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════ WHY CHOOSE US ══════════════ */}
      {/* Unified gold icons (no violet/amber/rose spread).
          Desktop: flat border cards, hover shifts border to gold tint. */}
      <section className="py-10 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 md:mb-10">
            <h2 className="text-xl md:text-2xl font-bold text-foreground text-balance">
              Kenapa Belanja di Onetone?
            </h2>
          </div>

          {/* Mobile: stacked compact cards */}
          <div className="space-y-3 md:hidden">
            {whyFeatures.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <item.icon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-0.5">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.descShort}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: 3-col flat cards */}
          <div className="hidden md:grid md:grid-cols-3 gap-5">
            {whyFeatures.map((item) => (
              <div
                key={item.title}
                className="p-6 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors duration-200"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2 text-balance">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.descLong}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════ CTA FINAL ══════════════ */}
      {/* Solid surface — no gradient, no blur-3xl orbs.
          Single dominant primary CTA, ghost secondary. */}
      <section className="py-14 md:py-20 bg-surface border-t border-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 text-balance">
            Siap Tampil Stylish Hari Ini?
          </h2>
          <p className="text-muted-foreground mb-8 text-sm md:text-base max-w-sm mx-auto">
            Koleksi fashion sport premium. Dikirim ke seluruh Indonesia.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button
              asChild size="lg"
              className="bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg px-8 h-11 md:h-12 font-semibold shadow-lg shadow-primary/20"
            >
              <Link href="/products">
                Mulai Belanja <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button
              asChild variant="outline" size="lg"
              className="rounded-lg px-8 h-11 md:h-12 border-border text-foreground hover:bg-muted/50"
            >
              <Link href="/register">
                Buat Akun Gratis
              </Link>
            </Button>
          </div>
        </div>
      </section>

    </div>
  );
}
