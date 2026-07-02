// components/shop/VariantSelector.tsx
'use client';

import { useState, useEffect } from 'react';

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
  onVariantChange: (variantId: number | null, finalPrice: number, stock: number) => void;
}

const SIZE_ORDER = ['FREE SIZE', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export function VariantSelector({ variants, basePrice, onVariantChange }: Props) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Unique sizes & colors
  const sizes = [...new Set(variants.map(v => v.size).filter(Boolean) as string[])]
    .sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a);
      const bi = SIZE_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  const colors = [...new Map(
    variants
      .filter(v => v.color)
      .map(v => [v.color!, { color: v.color!, hex: v.colorHex }])
  ).values()];

  // Find matching variant
  const matchedVariant = variants.find(
    v => v.size === selectedSize && v.color === selectedColor
  ) ?? null;

  // Colors available for selected size
  const availableColors = selectedSize
    ? variants.filter(v => v.size === selectedSize && (v.color ?? null) !== null)
    : variants.filter(v => v.color);

  const availableColorNames = new Set(availableColors.map(v => v.color));

  // Sizes available for selected color
  const availableSizes = selectedColor
    ? new Set(variants.filter(v => v.color === selectedColor).map(v => v.size))
    : new Set(variants.map(v => v.size));

  useEffect(() => {
    if (matchedVariant) {
      const modifier = parseFloat(matchedVariant.priceModifier ?? '0');
      onVariantChange(matchedVariant.id, basePrice + modifier, matchedVariant.stock);
    } else {
      onVariantChange(null, basePrice, 0);
    }
  }, [matchedVariant, basePrice]);

  if (variants.length === 0) return null;

  return (
    <div className="space-y-5">
      {/* Size Selector */}
      {sizes.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">
            Ukuran
            {selectedSize && <span className="font-normal text-primary ml-2">{selectedSize}</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {sizes.map(size => {
              const inAvailable = availableSizes.has(size);
              const isSelected = selectedSize === size;
              // Check if any variant with this size has stock > 0
              const hasStock = variants.some(
                v => v.size === size &&
                  (selectedColor ? v.color === selectedColor : true) &&
                  v.stock > 0
              );
              return (
                <button
                  key={size}
                  onClick={() => setSelectedSize(isSelected ? null : size)}
                  disabled={!inAvailable || !hasStock}
                  title={!hasStock ? 'Stok habis' : size}
                  className={`min-w-[48px] h-10 px-3 rounded-lg border-2 text-sm font-semibold transition-all
                    ${
                      isSelected
                        ? 'border-primary bg-primary text-white shadow-sm'
                        : !inAvailable || !hasStock
                        ? 'border-slate-200 bg-slate-50 text-slate-300 cursor-not-allowed line-through'
                        : 'border-slate-200 hover:border-primary hover:text-primary text-slate-700'
                    }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Color Selector */}
      {colors.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">
            Warna
            {selectedColor && <span className="font-normal text-primary ml-2">{selectedColor}</span>}
          </p>
          <div className="flex flex-wrap gap-3">
            {colors.map(({ color, hex }) => {
              const inAvailable = availableColorNames.has(color);
              const isSelected = selectedColor === color;
              const hasStock = variants.some(
                v => v.color === color &&
                  (selectedSize ? v.size === selectedSize : true) &&
                  v.stock > 0
              );
              return (
                <button
                  key={color}
                  onClick={() => setSelectedColor(isSelected ? null : color)}
                  disabled={!inAvailable || !hasStock}
                  title={color + (!hasStock ? ' (habis)' : '')}
                  className={`relative w-9 h-9 rounded-full border-2 transition-all
                    ${
                      isSelected
                        ? 'border-primary scale-110 shadow-md'
                        : !inAvailable || !hasStock
                        ? 'opacity-30 cursor-not-allowed'
                        : 'border-slate-200 hover:border-primary hover:scale-105'
                    }`}
                  style={{ backgroundColor: hex ?? color }}
                >
                  {/* Slash for out of stock */}
                  {!hasStock && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="block w-0.5 h-8 bg-slate-400 rotate-45 rounded-full" />
                    </span>
                  )}
                  <span className="sr-only">{color}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Variant match feedback */}
      {selectedSize && selectedColor && (
        <p className={`text-sm flex items-center gap-1.5 ${
          matchedVariant && matchedVariant.stock > 0
            ? 'text-green-600'
            : 'text-red-500'
        }`}>
          {matchedVariant && matchedVariant.stock > 0 ? (
            <><span>✓</span> Stok tersedia ({matchedVariant.stock} pcs)</>
          ) : (
            <><span>✗</span> Kombinasi ini tidak tersedia atau stok habis</>
          )}
        </p>
      )}
    </div>
  );
}
