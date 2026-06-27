// app/(shop)/checkout/page.tsx
import { auth } from '@/lib/auth';
import { getCart } from '@/app/actions/cart';
import { getUserAddresses } from '@/app/actions/addresses';
import { redirect } from 'next/navigation';
import { CheckoutForm } from './CheckoutForm';
import { OrderSummary } from './OrderSummary';

export default async function CheckoutPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login?redirect=/checkout');
  }

  const [cart, addresses] = await Promise.all([
    getCart(),
    getUserAddresses(),
  ]);

  if (cart.length === 0) {
    redirect('/cart');
  }

  const subtotal = cart.reduce((sum, item) => {
    return sum + (Number(item.product.price) * (item.quantity || 0));
  }, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">Checkout</h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Checkout Form */}
        <div className="lg:col-span-2">
          <CheckoutForm
            addresses={addresses}
            cart={cart}
            subtotal={subtotal}
          />
        </div>

        {/* Order Summary (sticky sidebar) */}
        <div className="lg:col-span-1">
          <OrderSummary cart={cart} subtotal={subtotal} />
        </div>
      </div>
    </div>
  );
}
