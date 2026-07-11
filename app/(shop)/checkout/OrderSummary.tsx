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

/** Harga efektif per item = harga dasar + priceModifier varian */
function itemUnitPrice(item: CartItemWithProduct): number {
  return Number(item.product.price) + Number(item.variant?.priceModifier ?? 0);
}

export function OrderSummary({ cart: initialCart, subtotal: initialSubtotal }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState(initialCart);
  const [subtotal, setSubtotal] = useState(initialSubtotal);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function recalcSubtotal(items: CartItemWithProduct[]) {
    return items.reduce((sum, item) => sum + itemUnitPrice(item) * (item.quantity || 0), 0);
  }

  function handleQuantityChange(cartItemId: number, newQty: number) {
    if (newQty < 1) return;
    setPendingId(cartItemId);
    const updated = cart.map(item =>
      item.id === cartItemId ? { ...item, quantity: newQty } : item
    );
    setCart(updated);
    setSubtotal(recalcSubtotal(updated));
    startTransition(async () => {
      const result = await updateCartItem(cartItemId, newQty);
      if (!result.success) {
        setCart(initialCart);
        setSubtotal(initialSubtotal);
      }
      setPendingId(null);
      router.refresh();
    });
  }

  function handleRemove(cartItemId: number) {
    setPendingId(cartItemId);
    const updated = cart.filter(item => item.id !== cartItemId);
    setCart(updated);
    setSubtotal(recalcSubtotal(updated));
    startTransition(async () => {
      await removeFromCart(cartItemId);
      setPendingId(null);
      router.refresh();
      if (updated.length === 0) router.push('/cart');
    });
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6 sticky top-24">
      <h2 className="text-lg font-semibold text-foreground mb-4">Pesanan Anda</h2>

      <div className="divide-y divide-border mb-4">
        {cart.map((item) => {
          const unitPrice = itemUnitPrice(item);
          const modifier = Number(item.variant?.priceModifier ?? 0);
          const maxStock = item.variant ? (item.variant.stock ?? 0) : (item.product.stock ?? 0);

          return (
            <div key={item.id} className="py-3 first:pt-0">
              {/* Row 1: Nama + Total */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-sm font-medium text-foreground line-clamp-2 flex-1">
                  {item.product.name}
                </p>
                <p className="text-sm font-semibold text-foreground whitespace-nowrap">
                  {formatRupiah(unitPrice * (item.quantity || 0))}
                </p>
              </div>

              {/* Row 2: Varian pills */}
              {item.variant && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-foreground text-xs font-medium">
                    {item.variant.size}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-foreground text-xs font-medium">
                    {item.variant.colorHex && (
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block border border-border"
                        style={{ backgroundColor: item.variant.colorHex }}
                      />
                    )}
                    {item.variant.color}
                  </span>
                  {modifier !== 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({modifier > 0 ? '+' : ''}{formatRupiah(modifier)})
                    </span>
                  )}
                </div>
              )}

              {/* Row 3: Qty controls + unit price + delete */}
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-border rounded-md">
                  <button
                    onClick={() => handleQuantityChange(item.id, (item.quantity ?? 1) - 1)}
                    disabled={(item.quantity ?? 1) <= 1 || pendingId === item.id}
                    className="px-1.5 py-1 hover:bg-accent disabled:opacity-30 transition"
                  >
                    <Minus className="w-3 h-3 text-muted-foreground" />
                  </button>
                  <span className="w-7 text-center text-xs font-medium text-foreground">
                    {item.quantity ?? 1}
                  </span>
                  <button
                    onClick={() => handleQuantityChange(item.id, (item.quantity ?? 1) + 1)}
                    disabled={(item.quantity ?? 1) >= maxStock || pendingId === item.id}
                    className="px-1.5 py-1 hover:bg-accent disabled:opacity-30 transition"
                  >
                    <Plus className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">@ {formatRupiah(unitPrice)}</span>
                <button
                  onClick={() => handleRemove(item.id)}
                  disabled={pendingId === item.id}
                  className="ml-auto p-1 text-muted-foreground hover:text-destructive transition"
                  title="Hapus item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border pt-4 space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span className="text-foreground">{formatRupiah(subtotal)}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Ongkir dihitung setelah memilih alamat &amp; kurir
        </div>
      </div>
    </div>
  );
}
