// app/(shop)/cart/CartItemRow.tsx
'use client';

import { useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { updateCartItem, removeFromCart } from '@/app/actions/cart';
import { formatRupiah } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { CartItemWithProduct } from '@/lib/db/schema';
import { useRouter } from 'next/navigation';

interface Props {
  item: CartItemWithProduct;
}

export function CartItemRow({ item }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const variant = item.variant ?? null;
  const unitPrice = Number(item.product.price) + Number(variant?.priceModifier ?? 0);
  const subtotal = unitPrice * (item.quantity || 0);

  const handleUpdateQuantity = async (delta: number) => {
    setLoading(true);
    const newQty = (item.quantity || 0) + delta;
    await updateCartItem(item.id, newQty);
    router.refresh();
    setLoading(false);
  };

  const handleRemove = async () => {
    setLoading(true);
    await removeFromCart(item.id);
    toast.success('Item dihapus dari keranjang');
    router.refresh();
    setLoading(false);
  };

  return (
    <div className={`p-4 flex gap-4 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Product Image */}
      <div className="w-20 h-20 bg-slate-100 rounded-lg flex-shrink-0 overflow-hidden relative">
        {item.product.image ? (
          <Image
            src={item.product.image}
            alt={item.product.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl">🛍️</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-slate-800 truncate text-sm md:text-base">
          {item.product.name}
        </h3>

        {/* Variant badge */}
        {variant && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Size pill */}
            {variant.size && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                {variant.size}
              </span>
            )}

            {/* Color swatch + label */}
            {variant.color && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
                {variant.colorHex && (
                  <span
                    className="w-3 h-3 rounded-full border border-slate-300 flex-shrink-0"
                    style={{ backgroundColor: variant.colorHex }}
                  />
                )}
                {variant.color}
              </span>
            )}
          </div>
        )}

        {/* Price per item */}
        <p className="font-semibold text-primary mt-1.5 text-sm">
          {formatRupiah(unitPrice)}
          {variant && Number(variant.priceModifier) !== 0 && (
            <span className="text-slate-400 font-normal text-xs ml-1">
              ({Number(variant.priceModifier) > 0 ? '+' : ''}
              {formatRupiah(Number(variant.priceModifier))})
            </span>
          )}
        </p>
      </div>

      {/* Quantity controls */}
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none border-r border-slate-200"
            onClick={() => handleUpdateQuantity(-1)}
            disabled={loading || (item.quantity || 0) <= 1}
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
          <span className="w-8 text-center text-sm font-semibold text-slate-800">
            {item.quantity}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none border-l border-slate-200"
            onClick={() => handleUpdateQuantity(1)}
            disabled={loading}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Subtotal */}
        <p className="font-bold text-slate-800 text-sm">{formatRupiah(subtotal)}</p>

        {/* Remove */}
        <button
          onClick={handleRemove}
          disabled={loading}
          className="text-red-400 hover:text-red-600 transition text-xs flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Hapus
        </button>
      </div>
    </div>
  );
}
