'use client';

import { useEffect, useMemo, useState } from 'react';

interface Variant {
  id: number;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  stock: number;
  priceModifier: string | null;
}

interface Props {
  variants: Variant[];
  basePrice: number;
  onVariantChange: (variantId: number | null, price: number, stock: number) => void;
  onColorChange?: (color: string | null) => void;
}

export function VariantSelector({ variants, basePrice, onVariantChange, onColorChange }: Props) {
  const activeVariants = useMemo(() => variants.filter((v) => v.stock >= 0), [variants]);

  const sizes = useMemo(() => {
    const seen = new Set<string>();
    return activeVariants
      .map((v) => v.size)
      .filter((s): s is string => !!s && !seen.has(s) && !!seen.add(s));
  }, [activeVariants]);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [colorCleared, setColorCleared] = useState(false);

  const availableColors = useMemo(() => {
    const pool = selectedSize
      ? activeVariants.filter((v) => v.size === selectedSize)
      : activeVariants;
    const seen = new Set<string>();
    return pool
      .map((v) => ({ color: v.color!, colorHex: v.colorHex }))
      .filter(({ color }) => color && !seen.has(color) && !!seen.add(color));
  }, [activeVariants, selectedSize]);

  const matchedVariant = useMemo(() => {
    if (!selectedSize || !selectedColor) return null;
    return activeVariants.find((v) => v.size === selectedSize && v.color === selectedColor) ?? null;
  }, [activeVariants, selectedSize, selectedColor]);

  // Reset color if no longer available after size change — with feedback
  useEffect(() => {
    if (selectedColor && !availableColors.find((c) => c.color === selectedColor)) {
      setSelectedColor(null);
      onColorChange?.(null);
      setColorCleared(true);
      const t = setTimeout(() => setColorCleared(false), 2500);
      return () => clearTimeout(t);
    }
  }, [availableColors, selectedColor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!matchedVariant) {
      onVariantChange(null, basePrice, 0);
      return;
    }
    const modifier = parseFloat(String(matchedVariant.priceModifier ?? '0'));
    onVariantChange(matchedVariant.id, basePrice + modifier, matchedVariant.stock);
  }, [matchedVariant, basePrice]); // eslint-disable-line react-hooks/exhaustive-deps

  const isColorOutOfStock = (color: string) => {
    if (!selectedSize) return false;
    const v = activeVariants.find((x) => x.size === selectedSize && x.color === color);
    return v ? v.stock <= 0 : true;
  };

  const isSizeOutOfStock = (size: string) => {
    return !activeVariants.some((v) => v.size === size && v.stock > 0);
  };

  const priceModifier = matchedVariant
    ? parseFloat(String(matchedVariant.priceModifier ?? '0'))
    : 0;

  return (
    <div className="space-y-5">
      {/* Size Selector */}
      {sizes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">Ukuran</span>
            {selectedSize && (
              <span className="text-xs text-primary font-medium">{selectedSize}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const outOfStock = isSizeOutOfStock(size);
              const active = selectedSize === size;
              return (
                <button
                  key={size}
                  onClick={() => !outOfStock && setSelectedSize(active ? null : size)}
                  disabled={outOfStock}
                  aria-pressed={active}
                  aria-label={outOfStock ? `${size} — habis` : size}
                  className={[
                    'px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all',
                    active
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : outOfStock
                      ? 'border-border bg-muted text-muted-foreground cursor-not-allowed line-through opacity-50'
                      : 'border-border text-foreground hover:border-primary hover:text-primary',
                  ].join(' ')}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Color Selector */}
      {availableColors.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Warna</span>
              {colorCleared && (
                <span className="text-xs text-muted-foreground animate-pulse">
                  Pilih warna lagi
                </span>
              )}
            </div>
            {selectedColor && (
              <span className="text-xs text-primary font-medium">{selectedColor}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {availableColors.map(({ color, colorHex }) => {
              const outOfStock = isColorOutOfStock(color);
              const active = selectedColor === color;
              return (
                <button
                  key={color}
                  onClick={() => {
                    if (outOfStock) return;
                    const next = active ? null : color;
                    setSelectedColor(next);
                    onColorChange?.(next);
                  }}
                  disabled={outOfStock}
                  title={outOfStock ? `${color} — habis` : color}
                  aria-pressed={active}
                  className={[
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all',
                    active
                      ? 'border-primary shadow-sm bg-primary/5'
                      : outOfStock
                      ? 'border-border text-muted-foreground cursor-not-allowed opacity-50'
                      : 'border-border text-foreground hover:border-primary',
                  ].join(' ')}
                >
                  {colorHex ? (
                    <span
                      className={[
                        'w-4 h-4 rounded-full border flex-shrink-0',
                        active ? 'border-primary' : 'border-border/60',
                        outOfStock ? 'opacity-40' : '',
                      ].join(' ')}
                      style={{ backgroundColor: colorHex }}
                    />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-muted border border-border flex-shrink-0" />
                  )}
                  <span className={outOfStock ? 'line-through' : ''}>{color}</span>
                  {outOfStock && <span className="text-xs text-muted-foreground">(Habis)</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock indicator */}
      {matchedVariant && (
        <div className="text-sm">
          {matchedVariant.stock > 0 ? (
            <span className="text-[var(--success)] font-medium">
              ✓ Stok tersedia ({matchedVariant.stock} pcs)
            </span>
          ) : (
            <span className="text-destructive font-medium">✗ Stok habis untuk varian ini</span>
          )}
        </div>
      )}

      {/* Price modifier */}
      {priceModifier !== 0 && (
        <div className="text-xs text-muted-foreground">
          {priceModifier > 0
            ? `+Rp ${priceModifier.toLocaleString('id-ID')} untuk ukuran ini`
            : `Hemat Rp ${Math.abs(priceModifier).toLocaleString('id-ID')} untuk ukuran ini`}
        </div>
      )}
    </div>
  );
}
