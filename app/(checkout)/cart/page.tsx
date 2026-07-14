// app/(shop)/cart/page.tsx
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getCart } from '@/app/actions/cart';
import { formatRupiah } from '@/lib/utils';
import { CartItemRow } from './CartItemRow';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { redirect } from 'next/navigation';

export default async function CartPage() {
  const session = await auth();
  
  if (!session) {
    redirect('/login?redirect=/cart');
  }

  const cart = await getCart();

  const subtotal = cart.reduce((sum, item) => {
    return sum + (Number(item.product.price) * (item.quantity || 0));
  }, 0);

  const shipping = subtotal > 0 ? 15000 : 0;
  const total = subtotal + shipping;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">Keranjang Belanja</h1>

      {cart.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingCart className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Keranjang Kosong
          </h2>
          <p className="text-slate-500 mb-6">
            Belum ada produk di keranjang Anda
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover"
          >
            Mulai Belanja
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {cart.map((item) => (
                  <CartItemRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-slate-100 p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">
                Ringkasan Pesanan
              </h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal ({cart.length} item)</span>
                  <span>{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Ongkos Kirim</span>
                  <span>{formatRupiah(shipping)}</span>
                </div>
                <div className="border-t border-slate-100 pt-3 flex justify-between font-semibold text-slate-800">
                  <span>Total</span>
                  <span className="text-primary">{formatRupiah(total)}</span>
                </div>
              </div>

              <Link
                href="/checkout"
                className="w-full py-3 px-6 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover transition flex items-center justify-center gap-2"
              >
                Lanjut ke Checkout
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
