import Link from 'next/link';
import { Zap, Shield, Truck, CreditCard } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />

        <div className="relative flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <Link href="/" className="inline-flex items-center gap-2.5 w-fit">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">
              Next<span className="text-primary">Elektronik</span>
            </span>
          </Link>

          {/* Center content */}
          <div className="max-w-md">
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
              Belanja Gadget Terpercaya, Harga Terbaik
            </h1>
            <p className="mt-4 text-slate-400 leading-relaxed">
              Nikmati pengalaman belanja online terbaik dengan produk original, pengiriman cepat, dan layanan pelanggan 24/7.
            </p>

            {/* Feature list */}
            <div className="mt-8 space-y-4">
              {[
                { icon: Shield, text: 'Produk 100% original bergaransi resmi' },
                { icon: Truck, text: 'Gratis ongkir untuk pembelian Rp200rb+' },
                { icon: CreditCard, text: 'Pembayaran aman & mudah' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm text-slate-300">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom */}
          <p className="text-xs text-slate-500">
            &copy; 2026 NextElektronik. FIC Batch 24 — JagoFlutter Academy
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col min-h-screen bg-white lg:bg-slate-50/50">
        {/* Mobile header */}
        <header className="lg:hidden py-4 px-5 bg-white">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">
              Next<span className="text-primary">Elektronik</span>
            </span>
          </Link>
        </header>

        {/* Form content */}
        <main className="flex-1 flex items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          {children}
        </main>
      </div>
    </div>
  );
}
