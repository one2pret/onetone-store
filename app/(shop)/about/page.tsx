// app/(shop)/about/page.tsx
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Tentang Onetone — Fashion sport untuk performa harian',
  description:
    'Onetone adalah toko fashion sport premium untuk perempuan dan pria Indonesia. Koleksi dikurasi, produk original, dikirim ke seluruh Indonesia.',
};

export default function AboutPage() {
  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <p className="text-[11px] tracking-[0.24em] uppercase text-primary font-semibold mb-5">
            Tentang Kami
          </p>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-[1.1] tracking-[-0.02em] text-balance">
            Fashion sport untuk performa harian.
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed text-pretty">
            Onetone adalah toko fashion sport premium untuk perempuan dan pria
            Indonesia. Bukan marketplace, bukan reseller — satu brand, satu suara,
            katalog yang benar-benar kami pilih.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-14 md:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4 tracking-[-0.015em] text-balance">
              Kenapa satu suara.
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed text-pretty">
              Setiap produk yang kami jual melewati satu keputusan: apakah ini
              cocok dengan cara customer kami hidup? Kalau tidak, tidak masuk
              katalog — sekalipun bisa laris. Yang tersisa adalah koleksi yang
              tenang, konsisten, dan bisa dipercaya.
            </p>
          </div>

          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4 tracking-[-0.015em] text-balance">
              Kenapa fashion sport.
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed text-pretty">
              Bahan yang bergerak bersama tubuh. Jahitan yang tetap rapi setelah
              dicuci berkali-kali. Potongan yang jalan dari gym ke coffee shop
              tanpa berganti outfit. Fashion sport bukan sekadar olahraga — ini
              cara berpakaian untuk hidup yang aktif.
            </p>
          </div>

          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4 tracking-[-0.015em] text-balance">
              Kenapa Indonesia.
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed text-pretty">
              Harga Rupiah yang jujur. Alamat provinsi hingga kecamatan. Kurir
              lokal dan pembayaran QRIS/VA/e-wallet. Kami membangun toko yang
              memahami cara berbelanja di Indonesia — bukan template asing yang
              dilokalisasi seadanya.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-14 md:py-20 bg-card border-y border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-8 md:mb-12 tracking-[-0.015em] text-balance">
            Yang kami pegang.
          </h2>
          <dl className="grid gap-8 md:gap-10 md:grid-cols-3">
            <div>
              <dt className="text-sm font-semibold text-primary mb-2">
                Original 100%
              </dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                Semua produk kami sumber langsung dari brand atau distributor
                resmi. Tidak ada barang tiruan, tidak ada kejutan.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-primary mb-2">
                Stok jujur
              </dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                Kalau stok habis, kami bilang habis. Tidak ada "hurry only 2
                left!" untuk memancing panik.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-primary mb-2">
                Retur 7 hari
              </dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">
                Ukuran tidak pas atau warna tidak sesuai foto? Kembalikan dalam
                7 hari, kami proses tanpa pertanyaan.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 md:py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 tracking-[-0.015em] text-balance">
            Mulai jelajahi koleksi.
          </h2>
          <p className="text-muted-foreground mb-8 text-sm md:text-base max-w-sm mx-auto">
            Katalog terkurasi. Foto produk jujur. Ongkir transparan.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg px-8 h-11 md:h-12 font-semibold shadow-lg shadow-primary/20"
            >
              <Link href="/products">
                Belanja Sekarang <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-lg px-8 h-11 md:h-12 border-border text-foreground hover:bg-muted/50"
            >
              <Link href="/contact">Hubungi Kami</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
