// app/(auth)/layout.tsx
import Link from 'next/link';
import { Shield, Truck, CreditCard, Store } from 'lucide-react';

const features = [
  { icon: Shield,     text: 'Produk 100% original bergaransi resmi' },
  { icon: Truck,      text: 'Gratis ongkir untuk pembelian Rp200rb+' },
  { icon: CreditCard, text: 'Pembayaran aman via VA, QRIS & e-Wallet' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">

      {/* ── Left Panel — Branding (desktop only) ── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative
                      bg-card border-r border-border overflow-hidden">

        {/* Decorative glow blobs */}
        <div className="absolute top-0 right-0 w-96 h-96
                        bg-primary/8 rounded-full blur-3xl
                        -translate-y-1/3 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80
                        bg-primary/5 rounded-full blur-3xl
                        translate-y-1/3 -translate-x-1/3 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64
                        bg-primary/5 rounded-full blur-3xl
                        -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        <div className="relative flex flex-col justify-between p-12 xl:p-16 w-full">

          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-2.5 w-fit group">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center
                            shadow-lg shadow-primary/30
                            group-hover:shadow-primary/50 transition-shadow">
              <Store className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold animate-gold-shimmer">
              Onetone
            </span>
          </Link>

          {/* Center Content */}
          <div className="max-w-md">
            <h1 className="text-3xl xl:text-4xl font-bold text-foreground leading-tight">
              Belanja Premium,<br />
              <span className="animate-gold-shimmer">Pengalaman Terbaik</span>
            </h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Temukan produk terpilih dengan kualitas premium. Pengiriman cepat,
              pembayaran aman, layanan 24/7.
            </p>

            {/* Feature list */}
            <div className="mt-8 space-y-4">
              {features.map((item) => (
                <div key={item.text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20
                                  flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm text-foreground/80">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <p className="text-xs text-muted-foreground">
            &copy; 2026 Onetone Store. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Right Panel — Form ── */}
      <div className="flex-1 flex flex-col min-h-screen bg-background">

        {/* Mobile header */}
        <header className="lg:hidden py-4 px-5 border-b border-border bg-card">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center
                            shadow-md shadow-primary/30">
              <Store className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold animate-gold-shimmer">
              Onetone
            </span>
          </Link>
        </header>

        {/* Form slot */}
        <main className="flex-1 flex items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          {children}
        </main>
      </div>

    </div>
  );
}