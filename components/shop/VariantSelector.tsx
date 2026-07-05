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

  // Unique sizes & colors
  const sizes = useMemo(() => {
    const seen = new Set<string>();
    return activeVariants
      .map((v) => v.size)
      .filter((s): s is string => !!s && !seen.has(s) && !!seen.add(s));
  }, [activeVariants]);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Colors available for selected size
  const availableColors = useMemo(() => {
    const pool = selectedSize
      ? activeVariants.filter((v) => v.size === selectedSize)
      : activeVariants;
    const seen = new Set<string>();
    return pool
      .map((v) => ({ color: v.color!, colorHex: v.colorHex }))
      .filter(({ color }) => color && !seen.has(color) && !!seen.add(color));
  }, [activeVariants, selectedSize]);

  // Matched variant
  const matchedVariant = useMemo(() => {
    if (!selectedSize || !selectedColor) return null;
    return activeVariants.find((v) => v.size === selectedSize && v.color === selectedColor) ?? null;
  }, [activeVariants, selectedSize, selectedColor]);

  // Reset color if no longer available after size change
  useEffect(() => {
    if (selectedColor && !availableColors.find((c) => c.color === selectedColor)) {
      setSelectedColor(null);
    }
  }, [availableColors, selectedColor]);

  // Notify parent
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

  return (
    <div className="space-y-5">
      {/* Size Selector */}
      {sizes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">Ukuran</span>
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
                  className={[
                    'px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all',
                    active
                      ? 'border-primary bg-primary text-white shadow-sm'
                      : outOfStock
                      ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed line-through'
                      : 'border-slate-200 text-slate-700 hover:border-primary hover:text-primary',
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
            <span className="text-sm font-semibold text-slate-700">Warna</span>
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
                  title={color}
                  className={[
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all',
                    active
                      ? 'border-primary shadow-sm bg-primary/5'
                      : outOfStock
                      ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                      : 'border-slate-200 text-slate-700 hover:border-primary',
                  ].join(' ')}
                >
                  {/* Color swatch */}
                  {colorHex ? (
                    <span
                      className={[
                        'w-4 h-4 rounded-full border flex-shrink-0',
                        active ? 'border-primary' : 'border-slate-200',
                        outOfStock ? 'opacity-40' : '',
                      ].join(' ')}
                      style={{ backgroundColor: colorHex }}
                    />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-slate-300 border border-slate-200 flex-shrink-0" />
                  )}
                  <span className={outOfStock ? 'line-through' : ''}>{color}</span>
                  {outOfStock && <span className="text-xs text-red-400">(Habis)</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock indicator after variant selected */}
      {matchedVariant && (
        <div className="text-sm">
          {matchedVariant.stock > 0 ? (
            <span className="text-green-600 font-medium">
              ✓ Stok tersedia ({matchedVariant.stock} pcs)
            </span>
          ) : (
            <span className="text-red-500 font-medium">✗ Stok habis untuk varian ini</span>
          )}
        </div>
      )}

      {/* Price modifier info */}
      {matchedVariant && parseFloat(String(matchedVariant.priceModifier ?? '0')) !== 0 && (
        <div className="text-xs text-slate-500">
          {parseFloat(String(matchedVariant.priceModifier)) > 0
            ? `+Rp ${parseInt(String(matchedVariant.priceModifier)).toLocaleString('id-ID')} untuk ukuran ini`
            : `Diskon Rp ${Math.abs(parseInt(String(matchedVariant.priceModifier))).toLocaleString('id-ID')} untuk ukuran ini`}
        </div>
      )}
    </div>
  );
}
