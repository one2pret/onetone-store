// app/(shop)/orders/page.tsx
import { auth } from '@/lib/auth';
import { getUserOrders } from '@/app/actions/orders';
import { redirect } from 'next/navigation';
import { Package } from 'lucide-react';
import Link from 'next/link';
import { OrdersList } from './_components/OrdersList';

export default async function OrdersPage() {
  const session = await auth();

  if (!session) {
    redirect('/login?redirect=/orders');
  }

  const orders = await getUserOrders();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Pesanan Saya</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            Belum Ada Pesanan
          </h2>
          <p className="text-slate-500 mb-6">
            Anda belum memiliki riwayat pesanan
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover"
          >
            Mulai Belanja
          </Link>
        </div>
      ) : (
        <OrdersList orders={orders} />
      )}
    </div>
  );
}
