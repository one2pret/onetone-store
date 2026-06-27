// app/(admin)/dashboard/orders/page.tsx
import { getAllOrders } from '@/app/actions/orders';
import { OrdersTable } from './_components/OrdersTable';

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">Pesanan</h1>
        <p className="text-sm text-slate-500 mt-0.5">{orders.length} total pesanan</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
        <OrdersTable data={orders} />
      </div>
    </div>
  );
}
