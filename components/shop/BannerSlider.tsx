// components/shop/BannerSlider.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Banner {
  id: number;
  title: string;
  subtitle: string | null;
  image: string;
  link: string | null;
}

interface BannerSliderProps {
  banners: Banner[];
}

export function BannerSlider({ banners }: BannerSliderProps) {
  const [current, setCurrent] = useState(0);
  const total = banners.length;

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Auto-slide every 5 seconds
  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next, total]);

  if (total === 0) return null;

  const banner = banners[current];

  const content = (
    <div className="relative w-full aspect-[4/3] sm:aspect-[2.5/1] md:aspect-[3/1] lg:aspect-[3.5/1] overflow-hidden bg-slate-900">
      <Image
        src={banner.image}
        alt={banner.title}
        fill
        sizes="100vw"
        className="object-cover"
        priority={current === 0}
      />
      {/* Gradient overlay — stronger on mobile for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10 sm:bg-gradient-to-r sm:from-black/60 sm:via-black/30 sm:to-transparent" />

      {/* Text content */}
      <div className="absolute inset-0 flex items-end sm:items-center pb-12 sm:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="max-w-lg">
            <h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-white leading-tight drop-shadow-lg">
              {banner.title}
            </h2>
            {banner.subtitle && (
              <p className="mt-2 sm:mt-3 text-xs sm:text-sm md:text-base text-white/90 sm:text-white/80 max-w-md drop-shadow line-clamp-2">
                {banner.subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation arrows — smaller on mobile */}
      {total > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); prev(); }}
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white transition"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={(e) => { e.preventDefault(); next(); }}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-sm flex items-center justify-center text-white transition"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {total > 1 && (
        <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.preventDefault(); setCurrent(i); }}
              className={cn(
                'h-1.5 sm:h-2 rounded-full transition-all duration-300',
                i === current ? 'bg-white w-5 sm:w-6' : 'bg-white/40 w-1.5 sm:w-2 hover:bg-white/60'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (banner.link) {
    return <Link href={banner.link}>{content}</Link>;
  }

  return content;
}
