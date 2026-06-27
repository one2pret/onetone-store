// app/(shop)/checkout/OrderSummary.tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Minus, Plus, Trash2 } from 'lucide-react';
import { updateCartItem, removeFromCart } from '@/app/actions/cart';
import { formatRupiah } from '@/lib/utils';
import type { CartItemWithProduct } from '@/lib/db/schema';

interface Props {
  cart: CartItemWithProduct[];
  subtotal: number;
}

export function OrderSummary({ cart: initialCart, subtotal: initialSubtotal }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState(initialCart);
  const [subtotal, setSubtotal] = useState(initialSubtotal);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function recalcSubtotal(items: CartItemWithProduct[]) {
    return items.reduce((sum, item) => sum + Number(item.product.price) * (item.quantity || 0), 0);
  }

  function handleQuantityChange(cartItemId: number, newQty: number) {
    if (newQty < 1) return;
    setPendingId(cartItemId);

    // Optimistic update
    const updated = cart.map(item =>
      item.id === cartItemId ? { ...item, quantity: newQty } : item
    );
    setCart(updated);
    setSubtotal(recalcSubtotal(updated));

    startTransition(async () => {
      const result = await updateCartItem(cartItemId, newQty);
      if (!result.success) {
        // Revert on error
        setCart(initialCart);
        setSubtotal(initialSubtotal);
      }
      setPendingId(null);
      router.refresh();
    });
  }

  function handleRemove(cartItemId: number) {
    setPendingId(cartItemId);

    // Optimistic update
    const updated = cart.filter(item => item.id !== cartItemId);
    setCart(updated);
    setSubtotal(recalcSubtotal(updated));

    startTransition(async () => {
      await removeFromCart(cartItemId);
      setPendingId(null);
      router.refresh();
      // If cart empty, redirect to cart page
      if (updated.length === 0) {
        router.push('/cart');
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-6 sticky top-24">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">
        Pesanan Anda
      </h2>

      <div className="divide-y divide-slate-100 mb-4">
        {cart.map((item) => (
          <div key={item.id} className="py-3 first:pt-0">
            {/* Row 1: Name + Total */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-medium text-slate-800 line-clamp-2 flex-1">
                {item.product.name}
              </p>
              <p className="text-sm font-semibold text-slate-800 whitespace-nowrap">
                {formatRupiah(Number(item.product.price) * (item.quantity || 0))}
              </p>
            </div>
            {/* Row 2: Qty controls + unit price + delete */}
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-slate-200 rounded-md">
                <button
                  onClick={() => handleQuantityChange(item.id, (item.quantity ?? 1) - 1)}
                  disabled={(item.quantity ?? 1) <= 1 || pendingId === item.id}
                  className="px-1.5 py-1 hover:bg-slate-50 disabled:opacity-30 transition"
                >
                  <Minus className="w-3 h-3 text-slate-500" />
                </button>
                <span className="w-7 text-center text-xs font-medium text-slate-700">{item.quantity ?? 1}</span>
                <button
                  onClick={() => handleQuantityChange(item.id, (item.quantity ?? 1) + 1)}
                  disabled={(item.quantity ?? 1) >= (item.product.stock ?? 0) || pendingId === item.id}
                  className="px-1.5 py-1 hover:bg-slate-50 disabled:opacity-30 transition"
                >
                  <Plus className="w-3 h-3 text-slate-500" />
                </button>
              </div>
              <span className="text-xs text-slate-400">@ {formatRupiah(item.product.price)}</span>
              <button
                onClick={() => handleRemove(item.id)}
                disabled={pendingId === item.id}
                className="ml-auto p-1 text-slate-300 hover:text-red-500 transition"
                title="Hapus item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 pt-4 space-y-2">
        <div className="flex justify-between text-sm text-slate-600">
          <span>Subtotal</span>
          <span>{formatRupiah(subtotal)}</span>
        </div>
        <div className="text-xs text-slate-400">
          Ongkir dihitung setelah memilih alamat & kurir
        </div>
      </div>
    </div>
  );
}
