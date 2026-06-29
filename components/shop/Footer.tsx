// components/shop/Footer.tsx
export function Footer() {
  return (
    <footer className="bg-card text-foreground py-8 md:py-12 border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile: brand on top, then 2-col grid for all lists */}
        {/* Desktop: 4-col grid */}

        {/* Brand — full width on mobile, 1 col on desktop */}
        <div className="mb-6 md:hidden">
          <h3 className="text-lg font-bold text-primary mb-2">Onetone Store</h3>
          <p className="text-muted-foreground text-sm">
            Toko elektronik online terpercaya. Gadget, laptop, audio & aksesoris dengan garansi resmi.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {/* Brand — desktop only */}
          <div className="hidden md:block">
            <h3 className="text-xl font-bold text-primary mb-4">Onetone Store</h3>
            <p className="text-muted-foreground text-sm">
              Toko elektronik online terpercaya. Gadget, laptop, audio & aksesoris dengan garansi resmi.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Kategori</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li><a href="/products?category=smartphone-tablet" className="hover:text-primary transition">Smartphone & Tablet</a></li>
              <li><a href="/products?category=laptop-komputer" className="hover:text-primary transition">Laptop & Komputer</a></li>
              <li><a href="/products?category=audio-headphone" className="hover:text-primary transition">Audio & Headphone</a></li>
              <li><a href="/products?category=wearable-smartwatch" className="hover:text-primary transition">Wearable & Smartwatch</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Bantuan</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li><a href="#" className="hover:text-primary transition">Cara Belanja</a></li>
              <li><a href="#" className="hover:text-primary transition">Pembayaran</a></li>
              <li><a href="#" className="hover:text-primary transition">Pengiriman</a></li>
              <li><a href="#" className="hover:text-primary transition">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-3 md:mb-4 text-sm md:text-base">Hubungi Kami</h4>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li>📧 hello@onetone.com</li>
              <li>📱 0812-3456-7890</li>
              <li>📍 Jakarta, Indonesia</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-6 md:mt-8 pt-6 md:pt-8 text-center text-muted-foreground text-xs md:text-sm">
          <p>&copy; 2026 Onetone Store. JagoFlutter Academy Next.js Flutter</p>
        </div>
      </div>
    </footer>
  );
}
