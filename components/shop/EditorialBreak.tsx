// components/shop/EditorialBreak.tsx
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  eyebrow?: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl?: string | null;
  imageAlt: string;
  /** Reverse image/text sides on desktop. */
  reverse?: boolean;
}

export function EditorialBreak({
  eyebrow,
  title,
  body,
  ctaLabel,
  ctaHref,
  imageUrl,
  imageAlt,
  reverse = false,
}: Props) {
  return (
    <section className="py-12 md:py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={[
            'grid gap-8 md:gap-12 items-center',
            'md:grid-cols-[1.35fr_1fr]',
            reverse && 'md:[&>*:first-child]:order-2',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {/* Foto */}
          <div className="relative aspect-[4/5] md:aspect-[21/12] rounded-2xl overflow-hidden bg-card border border-border">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={imageAlt}
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 60vw"
                className="object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="w-full h-full flex items-center justify-center bg-gradient-to-br from-card to-muted"
              >
                <div className="text-center px-6">
                  <p className="text-xs uppercase tracking-[0.24em] text-primary/70 mb-2">
                    Slot Foto Campaign
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ganti dengan foto lookbook / campaign.
                  </p>
                </div>
              </div>
            )}
            {/* Vignette subtle di bawah untuk premium mood */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent"
            />
          </div>

          {/* Teks */}
          <div>
            {eyebrow && (
              <p className="text-[11px] tracking-[0.24em] uppercase text-primary font-semibold mb-4">
                {eyebrow}
              </p>
            )}
            <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-[1.15] tracking-[-0.015em] text-balance">
              {title}
            </h2>
            <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed max-w-md text-pretty">
              {body}
            </p>
            <div className="mt-6">
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-lg px-6 h-11 border-primary/50 text-primary hover:bg-accent hover:border-primary"
              >
                <Link href={ctaHref}>
                  {ctaLabel} <ArrowRight className="w-4 h-4 ml-1.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
