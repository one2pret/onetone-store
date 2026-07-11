// components/shop/ProductTabs.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/shop/ProductCard';
import type { ProductWithCategory } from '@/lib/db/schema';

interface TabDef {
  id: string;
  label: string;
  sublabel: string;
  products: ProductWithCategory[];
  ctaHref: string;
  emptyCopy: string;
}

interface Props {
  tabs: TabDef[];
  defaultTabId?: string;
}

export function ProductTabs({ tabs, defaultTabId }: Props) {
  const [activeId, setActiveId] = useState<string>(defaultTabId ?? tabs[0]?.id);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  if (!active) return null;

  return (
    <section className="py-10 md:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header: tabs + inline sublabel + CTA */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 md:mb-10">
          <div className="flex-1 min-w-0">
            <div
              role="tablist"
              aria-label="Kategori produk"
              className="flex items-center gap-6 border-b border-border"
            >
              {tabs.map((tab) => {
                const isActive = tab.id === activeId;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`tabpanel-${tab.id}`}
                    id={`tab-${tab.id}`}
                    onClick={() => setActiveId(tab.id)}
                    className={[
                      'relative py-3 text-lg md:text-2xl font-bold tracking-[-0.015em] transition-colors',
                      isActive
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    {tab.label}
                    <span
                      aria-hidden
                      className={[
                        'absolute left-0 right-0 -bottom-px h-[2px] bg-primary transition-transform duration-300 origin-left',
                        isActive ? 'scale-x-100' : 'scale-x-0',
                      ].join(' ')}
                    />
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground mt-3">{active.sublabel}</p>
          </div>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-primary hover:text-primary-hover hover:bg-accent text-xs md:text-sm shrink-0 self-start md:self-end"
          >
            <Link href={active.ctaHref}>
              Lihat Semua <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>

        {/* Panel */}
        <div
          key={active.id}
          role="tabpanel"
          id={`tabpanel-${active.id}`}
          aria-labelledby={`tab-${active.id}`}
          className="animate-fadeIn"
        >
          {active.products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
              {active.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {active.emptyCopy}
                </p>
                <p className="text-xs text-muted-foreground">
                  Jelajahi semua produk yang tersedia.
                </p>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary-hover hover:bg-accent"
              >
                <Link href="/products">
                  Lihat Semua Produk <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
