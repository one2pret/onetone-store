// app/(shop)/cart/CartItemRow.tsx
'use client';

import { useState } from 'react';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
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

  const handleUpdateQuantity = async (delta: number) => {
    setLoading(true);
    const newQuantity = (item.quantity || 0) + delta;
    await updateCartItem(item.id, newQuantity);
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

  const subtotal = Number(item.product.price) * (item.quantity || 0);

  return (
    <div className={`p-4 flex gap-4 ${loading ? 'opacity-50' : ''}`}>
      {/* Image */}
      <div className="w-20 h-20 bg-slate-100 rounded-lg flex-shrink-0 flex items-center justify-center">
        <ShoppingBag className="w-8 h-8 text-slate-300" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-slate-800 truncate">{item.product.name}</h3>
        <p className="text-sm text-slate-500">Stok: {item.product.stock ?? 0}</p>
        <p className="font-semibold text-primary mt-1">
          {formatRupiah(item.product.price)}
        </p>
      </div>

      {/* Quantity */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleUpdateQuantity(-1)}
          disabled={loading || (item.quantity || 0) <= 1}
        >
          <Minus className="w-4 h-4" />
        </Button>
        <span className="w-8 text-center font-medium">{item.quantity}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleUpdateQuantity(1)}
          disabled={loading}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Subtotal */}
      <div className="text-right w-28">
        <p className="font-semibold text-slate-800">{formatRupiah(subtotal)}</p>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 mt-1"
          onClick={handleRemove}
          disabled={loading}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}
