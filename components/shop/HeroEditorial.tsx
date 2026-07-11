// components/shop/HeroEditorial.tsx
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  imageUrl?: string | null;
  caption?: string | null;
}

const TAGLINE = 'Fashion sport untuk performa harian.';
const SUBHEAD =
  'Koleksi terkurasi. Dikirim ke seluruh Indonesia dengan kurir pilihan.';

export function HeroEditorial({ imageUrl, caption }: Props) {
  const heroImage = imageUrl || null;
  const captionProductName = caption || null;

  return (
    <section
      aria-label="Onetone editorial hero"
      className="relative isolate overflow-hidden bg-background"
    >
      {/* Foto full-bleed */}
      <div className="absolute inset-0 -z-10">
        {heroImage ? (
          <Image
            src={heroImage}
            alt={captionProductName ?? 'Koleksi Onetone'}
            fill
            unoptimized
            priority
            sizes="100vw"
            className="object-cover animate-ken-burns"
          />
        ) : (
          <div
            aria-hidden
            className="w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--accent)_0%,_var(--background)_75%)]"
          />
        )}
        {/* Overlay gradient: bawah gelap untuk teks contrast */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background"
        />
        {/* Sisi kiri gelap untuk mempertajam kolom teks di desktop */}
        <div
          aria-hidden
          className="absolute inset-0 hidden md:block bg-gradient-to-r from-background/85 via-background/30 to-transparent"
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="min-h-[72vh] md:min-h-[80vh] flex items-end md:items-center py-16 md:py-24">
          <div className="max-w-2xl">
            {/* Small brand marker (deliberately quiet, not a marketplace badge) */}
            <p className="text-[11px] tracking-[0.24em] uppercase text-primary font-semibold mb-5">
              Onetone · Fashion Sport
            </p>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-[1.1] tracking-[-0.02em] text-balance">
              {TAGLINE}
            </h1>

            <p className="mt-5 text-sm md:text-base text-muted-foreground max-w-md text-pretty">
              {SUBHEAD}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button
                asChild
                size="lg"
                className="bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg px-7 h-12 font-semibold shadow-lg shadow-primary/20"
              >
                <Link href="/products">
                  Mulai Belanja <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-lg px-7 h-12 border-border bg-background/40 backdrop-blur-sm text-foreground hover:bg-accent"
              >
                <Link href="#unggulan">Lihat Koleksi</Link>
              </Button>
            </div>

            {captionProductName && (
              <p className="mt-8 text-[11px] text-muted-foreground/80 max-w-md">
                Dalam foto: {captionProductName}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
