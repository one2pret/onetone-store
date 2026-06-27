// app/(shop)/page.tsx
import Link from 'next/link';
import { getFeaturedProducts, getActiveProducts, getCategories } from '@/app/actions/products';
import { getActiveBanners } from '@/app/actions/banners';
import { ProductCard } from '@/components/shop/ProductCard';
import { BannerSlider } from '@/components/shop/BannerSlider';
import {
  ArrowRight, Truck, Shield, Headphones, CreditCard,
  Zap, BadgePercent, Flame, Sparkles, Heart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default async function HomePage() {
  const [featuredProducts, newProducts, categories, banners] = await Promise.all([
    getFeaturedProducts(8),
    getActiveProducts({ limit: 4 }),
    getCategories(),
    getActiveBanners(),
  ]);

  const categoryIcons: Record<string, string> = {
    'smartphone-tablet': '📱',
    'laptop-komputer': '💻',
    'audio-headphone': '🎧',
    'wearable-smartwatch': '⌚',
    'aksesoris-gadget': '🔌',
  };

  return (
    <div>
      {/* ═══════════ BANNER SLIDER ═══════════ */}
      <section>
        <BannerSlider banners={banners} />
      </section>

      {/* ═══════════ TRUST BAR ═══════════ */}
      <section className="py-4 md:py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Mobile: 2 items centered */}
          <div className="flex md:hidden justify-center gap-3">
            {[
              { icon: Shield, title: 'Garansi Resmi', color: 'text-blue-600 bg-blue-50' },
              { icon: CreditCard, title: 'Bayar Aman', color: 'text-violet-600 bg-violet-50' },
            ].map((f) => (
              <div key={f.title} className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full">
                <div className={`w-7 h-7 rounded-full ${f.color} flex items-center justify-center`}>
                  <f.icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-medium text-slate-700">{f.title}</span>
              </div>
            ))}
          </div>
          {/* Desktop: grid */}
          <div className="hidden md:grid grid-cols-4 gap-4">
            {[
              { icon: Truck, title: 'Gratis Ongkir', desc: 'Pesanan Rp200rb+', color: 'bg-emerald-50 text-emerald-600' },
              { icon: Shield, title: 'Garansi Resmi', desc: '100% Produk Original', color: 'bg-blue-50 text-blue-600' },
              { icon: CreditCard, title: 'Pembayaran Aman', desc: 'Transfer & E-Wallet', color: 'bg-violet-50 text-violet-600' },
              { icon: Headphones, title: 'Support 24/7', desc: 'Siap Bantu Kamu', color: 'bg-amber-50 text-amber-600' },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex items-center gap-3 p-4 rounded-xl hover:shadow-md transition-all duration-300 group"
              >
                <div className={`w-11 h-11 rounded-xl ${feature.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-800">{feature.title}</p>
                  <p className="text-xs text-slate-500">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CATEGORIES ═══════════ */}
      <section className="py-8 md:py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 md:mb-10">
            <h2 className="text-xl md:text-3xl font-bold text-slate-900">Belanja Berdasarkan Kategori</h2>
            <p className="text-slate-500 mt-1 text-sm md:text-base">Temukan produk sesuai kebutuhanmu</p>
          </div>
          {/* Mobile: horizontal scroll */}
          <div className="flex md:hidden gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                className="flex flex-col items-center gap-2 shrink-0 w-20"
              >
                <div className="w-14 h-14 bg-white rounded-2xl border border-slate-100 flex items-center justify-center shadow-sm">
                  <span className="text-2xl">{categoryIcons[category.slug] || '📦'}</span>
                </div>
                <p className="text-[11px] font-medium text-slate-600 text-center leading-tight line-clamp-2">{category.name}</p>
              </Link>
            ))}
          </div>
          {/* Desktop: grid */}
          <div className="hidden md:grid grid-cols-3 md:grid-cols-5 gap-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                className="group relative p-6 bg-white rounded-2xl border border-slate-100 hover:border-primary/30 hover:shadow-lg transition-all duration-300 text-center overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary-light/40 rounded-2xl flex items-center justify-center group-hover:bg-primary-light group-hover:scale-110 transition-all duration-300">
                    <span className="text-3xl">{categoryIcons[category.slug] || '📦'}</span>
                  </div>
                  <p className="font-semibold text-sm text-slate-700 group-hover:text-primary transition">{category.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURED PRODUCTS ═══════════ */}
      <section className="py-8 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-5 md:mb-10">
            <div>
              <div className="flex items-center gap-2 text-primary font-semibold text-xs md:text-sm mb-1">
                <Flame className="w-3.5 h-3.5 md:w-4 md:h-4" />
                PALING DIMINATI
              </div>
              <h2 className="text-lg md:text-3xl font-bold text-slate-900">Produk Unggulan</h2>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary-hover hover:bg-primary/5 text-xs md:text-sm">
              <Link href="/products">
                Lihat Semua <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PROMO BANNER ═══════════ */}
      <section className="py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 md:p-16">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-40 md:w-64 h-40 md:h-64 bg-primary/10 rounded-full -translate-y-1/3 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-32 md:w-48 h-32 md:h-48 bg-primary/5 rounded-full translate-y-1/3 -translate-x-1/4" />

            <div className="relative grid md:grid-cols-2 gap-6 md:gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/20 text-primary text-xs md:text-sm font-medium mb-3 md:mb-4">
                  <BadgePercent className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  Promo Spesial
                </div>
                <h2 className="text-2xl md:text-4xl font-bold text-white leading-tight">
                  Diskon Hingga <span className="text-primary">50%</span>
                  <br />
                  Untuk Member Baru
                </h2>
                <p className="text-slate-400 mt-3 md:mt-4 max-w-md text-sm md:text-base">
                  Daftar sekarang dan nikmati potongan harga eksklusif untuk pembelian gadget pertamamu.
                </p>
                <div className="mt-5 md:mt-8">
                  <Button asChild size="default" className="bg-primary hover:bg-primary-hover text-white rounded-full px-6 md:px-8 shadow-lg shadow-primary/25 text-sm md:text-base">
                    <Link href="/register">
                      Daftar Gratis <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Promo visual — desktop only */}
              <div className="hidden md:flex justify-center">
                <div className="relative">
                  <div className="w-56 h-56 rounded-full bg-primary/10 flex items-center justify-center">
                    <div className="w-40 h-40 rounded-full bg-primary/20 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-5xl font-black text-primary">50%</p>
                        <p className="text-sm font-semibold text-slate-400 mt-1">OFF</p>
                      </div>
                    </div>
                  </div>
                  <div className="absolute -top-2 -right-2 bg-danger text-white text-xs font-bold px-3 py-1.5 rounded-full animate-bounce">
                    LIMITED!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ NEW ARRIVALS ═══════════ */}
      <section className="py-8 md:py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-5 md:mb-10">
            <div>
              <div className="flex items-center gap-2 text-primary font-semibold text-xs md:text-sm mb-1">
                <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" />
                BARU DATANG
              </div>
              <h2 className="text-lg md:text-3xl font-bold text-slate-900">Produk Terbaru</h2>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary-hover hover:bg-primary/5 text-xs md:text-sm">
              <Link href="/products">
                Lihat Semua <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4 ml-1" />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {newProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ WHY CHOOSE US ═══════════ */}
      <section className="py-8 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 md:mb-12">
            <h2 className="text-xl md:text-3xl font-bold text-slate-900">Kenapa Pilih NextElektronik?</h2>
            <p className="text-slate-500 mt-1 md:mt-2 text-sm md:text-base">Kami berkomitmen memberikan pengalaman belanja terbaik</p>
          </div>
          {/* Mobile: compact horizontal cards, Desktop: 3-col grid */}
          <div className="space-y-3 md:hidden">
            {[
              {
                icon: Shield,
                title: 'Produk 100% Original',
                desc: 'Dijamin keasliannya dengan garansi resmi dari distributor.',
                color: 'bg-emerald-50 text-emerald-600',
              },
              {
                icon: Zap,
                title: 'Pengiriman Super Cepat',
                desc: 'Proses dalam hitungan jam. Didukung JNE, SiCepat, J&T.',
                color: 'bg-amber-50 text-amber-600',
              },
              {
                icon: Heart,
                title: 'Layanan Sepenuh Hati',
                desc: 'Support 24/7, retur 7 hari jika tidak sesuai.',
                color: 'bg-rose-50 text-rose-600',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 p-4 rounded-xl bg-slate-50"
              >
                <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center shrink-0`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-0.5">{item.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'Produk 100% Original',
                desc: 'Semua produk dijamin keasliannya dengan garansi resmi dari distributor. Beli dengan tenang tanpa khawatir barang palsu.',
                color: 'bg-emerald-50 text-emerald-600',
              },
              {
                icon: Zap,
                title: 'Pengiriman Super Cepat',
                desc: 'Proses pesanan dalam hitungan jam. Didukung JNE, SiCepat, J&T dan kurir terpercaya lainnya ke seluruh Indonesia.',
                color: 'bg-amber-50 text-amber-600',
              },
              {
                icon: Heart,
                title: 'Layanan Sepenuh Hati',
                desc: 'Tim support kami siap membantu 24/7 via chat dan telepon. Kembalikan produk dalam 7 hari jika tidak sesuai.',
                color: 'bg-rose-50 text-rose-600',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group p-8 rounded-2xl border border-slate-100 hover:border-primary/20 hover:shadow-lg transition-all duration-300 bg-white"
              >
                <div className={`w-14 h-14 rounded-2xl ${item.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section className="py-12 md:py-20 bg-gradient-to-br from-primary via-primary-hover to-emerald-600 relative overflow-hidden">
        {/* Soft radial glow */}
        <div className="absolute top-0 left-1/4 w-60 md:w-96 h-60 md:h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-48 md:w-80 h-48 md:h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-3 md:mb-4">
            Siap Upgrade Gadgetmu?
          </h2>
          <p className="text-white/80 mb-6 md:mb-10 max-w-lg mx-auto text-sm md:text-lg">
            Bergabung dengan ribuan tech enthusiast yang sudah belanja di NextElektronik.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 md:gap-4">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-slate-100 rounded-full px-8 md:px-10 h-11 md:h-12 text-sm md:text-base font-semibold shadow-xl">
              <Link href="/products">
                Mulai Belanja <ArrowRight className="w-4 h-4 md:w-5 md:h-5 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-8 md:px-10 h-11 md:h-12 text-sm md:text-base border-white/30 text-white hover:bg-white/10">
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
