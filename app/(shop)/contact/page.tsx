// app/(shop)/contact/page.tsx
import Link from 'next/link';
import { MessageCircle, Phone, Mail, MapPin, Instagram, ArrowUpRight } from 'lucide-react';
import { getStoreSettings } from '@/app/actions/store-settings';

export const metadata = {
  title: 'Hubungi Kami — Onetone',
  description:
    'Chat WhatsApp, telepon, atau kunjungi toko kami. Tim kami siap bantu jam kerja setiap hari.',
};

function digitsOnly(v: string) {
  return v.replace(/\D+/g, '');
}

export default async function ContactPage() {
  const settings = await getStoreSettings();

  const storeName = settings.store_name || 'Onetone Store';
  const storePhone = settings.store_phone || '';
  const storeAddress = settings.store_address || '';
  const storeEmail = settings.store_email || '';
  const storeInstagram = settings.store_instagram || '';

  const waNumber = storePhone ? digitsOnly(storePhone).replace(/^0/, '62') : '';
  const waUrl = waNumber ? `https://wa.me/${waNumber}` : '';
  const telUrl = storePhone ? `tel:${digitsOnly(storePhone)}` : '';
  const mailUrl = storeEmail ? `mailto:${storeEmail}` : '';
  const igUrl = storeInstagram
    ? `https://instagram.com/${storeInstagram.replace(/^@/, '')}`
    : '';

  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
          <p className="text-[11px] tracking-[0.24em] uppercase text-primary font-semibold mb-5">
            Hubungi Kami
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-[1.1] tracking-[-0.02em] text-balance">
            Kami balas dalam 1 jam.
          </h1>
          <p className="mt-5 text-sm md:text-base text-muted-foreground leading-relaxed text-pretty max-w-lg">
            Setiap hari 09.00–21.00 WIB. Chat WhatsApp untuk respons paling cepat,
            atau pilih cara lain yang paling nyaman.
          </p>
        </div>
      </section>

      {/* Contact channels */}
      <section className="py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-3 md:gap-4 md:grid-cols-2">
            {/* WhatsApp */}
            {waUrl ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-5 md:p-6 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent transition"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    WhatsApp
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    Chat via WhatsApp
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {storePhone}
                  </p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition shrink-0" />
              </a>
            ) : (
              <ChannelPlaceholder
                icon={MessageCircle}
                label="WhatsApp"
                hint="Belum diatur — admin bisa isi via Pengaturan Toko."
              />
            )}

            {/* Telepon */}
            {telUrl ? (
              <a
                href={telUrl}
                className="group flex items-center gap-4 p-5 md:p-6 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent transition"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Telepon</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {storePhone}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    Sen–Sab 09.00–18.00 WIB
                  </p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition shrink-0" />
              </a>
            ) : (
              <ChannelPlaceholder
                icon={Phone}
                label="Telepon"
                hint="Belum diatur — admin bisa isi via Pengaturan Toko."
              />
            )}

            {/* Email */}
            {mailUrl ? (
              <a
                href={mailUrl}
                className="group flex items-center gap-4 p-5 md:p-6 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent transition"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {storeEmail}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    Balas dalam 1 hari kerja
                  </p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition shrink-0" />
              </a>
            ) : (
              <ChannelPlaceholder
                icon={Mail}
                label="Email"
                hint="Belum diatur — admin bisa isi via Pengaturan Toko."
              />
            )}

            {/* Instagram */}
            {igUrl ? (
              <a
                href={igUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 p-5 md:p-6 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent transition"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Instagram className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Instagram
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    @{storeInstagram.replace(/^@/, '')}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    Lihat koleksi & campaign terbaru
                  </p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition shrink-0" />
              </a>
            ) : (
              <ChannelPlaceholder
                icon={Instagram}
                label="Instagram"
                hint="Belum diatur — admin bisa isi via Pengaturan Toko."
              />
            )}
          </div>
        </div>
      </section>

      {/* Alamat toko */}
      {storeAddress && (
        <section className="py-12 md:py-16 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Alamat Toko</p>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  {storeName}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {storeAddress}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA balik ke belanja */}
      <section className="py-14 md:py-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3 tracking-[-0.015em] text-balance">
            Punya pertanyaan tentang produk?
          </h2>
          <p className="text-muted-foreground mb-6 text-sm md:text-base max-w-sm mx-auto">
            Cek dulu katalog — mungkin jawabannya sudah ada di deskripsi produk.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover transition"
          >
            Jelajahi Semua Produk
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function ChannelPlaceholder({
  icon: Icon,
  label,
  hint,
}: {
  icon: typeof MessageCircle;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-4 p-5 md:p-6 rounded-xl border border-border bg-card opacity-60">
      <div className="w-11 h-11 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-foreground">Belum tersedia</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
    </div>
  );
}
