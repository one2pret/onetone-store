// components/shop/Footer.tsx
import { MessageCircle } from 'lucide-react';

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="bg-card text-foreground py-8 md:py-12 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Mobile: brand on top */}
        <div className="mb-6 md:hidden">
          <h3 className="text-lg font-bold text-primary mb-1">ONETONE</h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Fashion sport premium untuk gaya hidup aktif. Dikirim ke seluruh Indonesia.
          </p>
          <div className="flex gap-3 mt-3">
            <a href="#" aria-label="Instagram" className="text-muted-foreground hover:text-primary transition">
              <IconInstagram className="w-4 h-4" />
            </a>
            <a href="#" aria-label="WhatsApp" className="text-muted-foreground hover:text-primary transition">
              <MessageCircle className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">

          {/* Brand — desktop only */}
          <div className="hidden md:block">
            <h3 className="text-xl font-bold text-primary mb-3">ONETONE</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Fashion sport premium untuk gaya hidup aktif. Dikirim ke seluruh Indonesia.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="#" aria-label="Instagram" className="text-muted-foreground hover:text-primary transition">
                <IconInstagram className="w-4 h-4" />
              </a>
              <a href="#" aria-label="WhatsApp" className="text-muted-foreground hover:text-primary transition">
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Kategori */}
          <div>
            <h4 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Kategori</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li><a href="/products?category=pakaian-pria" className="hover:text-primary transition">Pakaian Pria</a></li>
              <li><a href="/products?category=pakaian-wanita" className="hover:text-primary transition">Pakaian Wanita</a></li>
              <li><a href="/products?category=sepatu-sneakers" className="hover:text-primary transition">Sepatu & Sneakers</a></li>
              <li><a href="/products?category=aksesoris-sport" className="hover:text-primary transition">Aksesoris Sport</a></li>
            </ul>
          </div>

          {/* Bantuan */}
          <div>
            <h4 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Bantuan</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li><a href="#" className="hover:text-primary transition">Cara Belanja</a></li>
              <li><a href="#" className="hover:text-primary transition">Pembayaran</a></li>
              <li><a href="#" className="hover:text-primary transition">Pengiriman</a></li>
              <li><a href="#" className="hover:text-primary transition">Retur & Refund</a></li>
            </ul>
          </div>

          {/* Kontak */}
          <div>
            <h4 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Hubungi Kami</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>📧 hello@onetone.id</li>
              <li>📱 0812-3456-7890</li>
              <li>📍 Jakarta, Indonesia</li>
            </ul>
          </div>

        </div>

        <div className="border-t border-border mt-6 md:mt-8 pt-6 md:pt-8 text-center text-muted-foreground text-xs md:text-sm">
          <p>&copy; 2026 ONETONE Store. All rights reserved.</p>
        </div>

      </div>
    </footer>
  );
}
