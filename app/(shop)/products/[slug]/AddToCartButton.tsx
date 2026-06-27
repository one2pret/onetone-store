// app/(shop)/products/[slug]/AddToCartButton.tsx
'use client';

import { useState } from 'react';
import { ShoppingCart, Minus, Plus, Check, CreditCard } from 'lucide-react';
import { addToCart } from '@/app/actions/cart';
import { useRouter } from 'next/navigation';

interface Props {
  productId: number;
  disabled?: boolean;
}

export function AddToCartButton({ productId, disabled }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleAddToCart = async () => {
    setLoading(true);
    setError(null);

    const result = await addToCart(productId, quantity);

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
    setBuyNowLoading(true);
    setError(null);

    const result = await addToCart(productId, quantity);

    if (result.success) {
      router.push('/checkout');
    } else {
      setError(result.error || 'Gagal menambahkan ke keranjang');
      setBuyNowLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Quantity Selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-600">Jumlah:</span>
        <div className="flex items-center border border-slate-200 rounded-lg">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="p-2 hover:bg-slate-100"
            disabled={disabled}
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-12 text-center font-medium">{quantity}</span>
          <button
            onClick={() => setQuantity(quantity + 1)}
            className="p-2 hover:bg-slate-100"
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
          disabled={disabled || loading || buyNowLoading}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
            added
              ? 'bg-green-600 text-white'
              : disabled
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : 'border-2 border-primary text-primary hover:bg-primary/5'
          }`}
        >
          {loading ? (
            'Menambahkan...'
          ) : added ? (
            <>
              <Check className="w-5 h-5" />
              Ditambahkan!
            </>
          ) : (
            <>
              <ShoppingCart className="w-5 h-5" />
              Keranjang
            </>
          )}
        </button>

        <button
          onClick={handleBuyNow}
          disabled={disabled || loading || buyNowLoading}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition ${
            disabled
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary-hover'
          }`}
        >
          {buyNowLoading ? (
            'Memproses...'
          ) : (
            <>
              <CreditCard className="w-5 h-5" />
              Bayar Sekarang
            </>
          )}
        </button>
      </div>
    </div>
  );
}
