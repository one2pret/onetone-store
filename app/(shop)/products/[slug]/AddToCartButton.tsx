// app/(shop)/products/[slug]/AddToCartButton.tsx
'use client';

import { useState } from 'react';
import { ShoppingCart, Minus, Plus, Check, CreditCard } from 'lucide-react';
import { addToCart } from '@/app/actions/cart';
import { useRouter } from 'next/navigation';
import { VariantSelector } from '@/components/shop/VariantSelector';

interface Variant {
  id: number;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  stock: number;
  priceModifier: string | null;
}

interface Props {
  productId: number;
  basePrice: number;
  variants: Variant[];
  initialStock: number;
  onColorChange?: (color: string | null) => void;
  onVariantPriceChange?: (variantId: number | null, price: number, stock: number) => void;
}

export function AddToCartButton({ productId, basePrice, variants, initialStock, onColorChange, onVariantPriceChange }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const hasVariants = variants.length > 0;

  // Variant state managed here, updated by VariantSelector
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [finalPrice, setFinalPrice] = useState(basePrice);
  const [currentStock, setCurrentStock] = useState(initialStock);

  const handleVariantChange = (variantId: number | null, price: number, stock: number) => {
    setSelectedVariantId(variantId);
    setFinalPrice(price);
    setCurrentStock(stock);
    setQuantity(1);
    onVariantPriceChange?.(variantId, price, stock);
  };

  // Disabled logic
  const variantRequired = hasVariants && selectedVariantId === null;
  const outOfStock = currentStock <= 0 && !variantRequired;
  const disabled = variantRequired || outOfStock || loading || buyNowLoading;

  const handleAddToCart = async () => {
    if (hasVariants && !selectedVariantId) {
      setError('Pilih ukuran dan warna terlebih dahulu');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await addToCart(productId, quantity, selectedVariantId ?? undefined);
    if (result.success) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
      router.refresh();
    } else {
      setError(result.error || 'Gagal menambahkan ke keranjang');
    }
    setLoading(false);
  };

  const handleBuyNow = async () => {
    if (hasVariants && !selectedVariantId) {
      setError('Pilih ukuran dan warna terlebih dahulu');
      return;
    }
    setBuyNowLoading(true);
    setError(null);
    const result = await addToCart(productId, quantity, selectedVariantId ?? undefined);
    if (result.success) {
      router.push('/checkout');
    } else {
      setError(result.error || 'Gagal menambahkan ke keranjang');
      setBuyNowLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Variant Selector */}
      {hasVariants && (
        <VariantSelector
          variants={variants}
          basePrice={basePrice}
          onVariantChange={handleVariantChange}
          onColorChange={onColorChange}
        />
      )}

      {/* Stock Info — non-variant product */}
      {!hasVariants && (
        <div>
          {currentStock > 0 ? (
            <p className="text-green-600 text-sm">✓ Stok tersedia ({currentStock} pcs)</p>
          ) : (
            <p className="text-red-600 text-sm">✗ Stok habis</p>
          )}
        </div>
      )}

      {/* Hint saat varian belum dipilih */}
      {variantRequired && (
        <p className="text-sm text-amber-600">⚠ Silakan pilih ukuran dan warna</p>
      )}

      {/* Quantity Selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600">Jumlah:</span>
        <div className="flex items-center border border-slate-200 rounded-lg">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="p-2 hover:bg-slate-100 disabled:opacity-40"
            disabled={disabled}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-12 text-center font-medium">{quantity}</span>
          <button
            onClick={() => setQuantity(Math.min(currentStock || 99, quantity + 1))}
            className="p-2 hover:bg-slate-100 disabled:opacity-40"
            disabled={disabled}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleAddToCart}
          disabled={disabled}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
            added
              ? 'bg-green-600 text-white'
              : disabled
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'border-2 border-primary text-primary hover:bg-primary/5'
          }`}
        >
          {loading ? 'Menambahkan...' : added ? (
            <><Check className="w-5 h-5" /> Ditambahkan!</>
          ) : (
            <><ShoppingCart className="w-5 h-5" /> Keranjang</>
          )}
        </button>

        <button
          onClick={handleBuyNow}
          disabled={disabled}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
            disabled
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary-hover'
          }`}
        >
          {buyNowLoading ? 'Memproses...' : (
            <><CreditCard className="w-5 h-5" /> Bayar Sekarang</>
          )}
        </button>
      </div>
    </div>
  );
}
