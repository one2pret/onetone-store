// app/(shop)/orders/[id]/page.tsx
import { auth } from '@/lib/auth';
import { getOrder } from '@/app/actions/orders';
import { formatRupiah, formatDate, formatShortDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Package, MapPin, Clock, Truck } from 'lucide-react';
import { db } from '@/lib/db';
import { invoices, shippings, shippingHistories } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { PaymentCountdown } from '@/components/shop/PaymentCountdown';
import { TrackingTimeline } from '@/components/shop/TrackingTimeline';
import { OrderStepper } from '@/components/shop/OrderStepper';
import { OrderActions } from './OrderActions';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const session = await auth();
  if (!session) {
    redirect('/login?redirect=/orders');
  }

  const { id } = await params;
  const order = await getOrder(Number(id));

  if (!order) {
    notFound();
  }

  // Get invoice info
  const invoiceRows = await db.select().from(invoices)
    .where(eq(invoices.orderId, order.id))
    .limit(1);
  const invoice = invoiceRows[0] ?? null;

  // Get shipping + tracking
  const shippingRows = await db.select().from(shippings)
    .where(eq(shippings.orderId, order.id))
    .limit(1);
  const shipping = shippingRows[0] ?? null;

  let trackingHistories: any[] = [];
  if (shipping) {
    trackingHistories = await db.select().from(shippingHistories)
      .where(eq(shippingHistories.shippingId, shipping.id))
      .orderBy(desc(shippingHistories.updatedAt));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/orders"
        className="flex items-center gap-2 text-slate-600 hover:text-slate-800 mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Pesanan
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-100 p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">No. Pesanan</p>
            <p className="text-xl font-mono font-bold text-slate-800">{order.orderNumber}</p>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {order.createdAt && formatDate(order.createdAt)}
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(order.status || 'waiting_payment')}`}>
              {getStatusLabel(order.status || 'waiting_payment')}
            </span>
            {order.status === 'waiting_payment' && order.willExpiredAt && (
              <div className="mt-2">
                <PaymentCountdown expiresAt={order.willExpiredAt} />
              </div>
            )}
          </div>
        </div>

        {/* Order Progress Stepper */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <OrderStepper
            status={order.status || 'waiting_payment'}
            timestamps={{
              createdAt: formatShortDate(order.createdAt),
              paidAt: formatShortDate(order.paidAt),
              shippedAt: formatShortDate(order.shippingAt),
              deliveredAt: formatShortDate(order.deliveredAt),
            }}
          />
        </div>

        {/* Action Buttons */}
        <OrderActions
          orderId={order.id}
          status={order.status || 'waiting_payment'}
          invoiceUrl={invoice?.invoiceUrl || null}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Items */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-100 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Item Pesanan ({order.items.length} produk)
            </h2>
            <div className="divide-y divide-slate-100">
              {order.items.map((item) => (
                <div key={item.id} className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800">{item.productName}</p>
                    <p className="text-sm text-slate-500">
                      {formatRupiah(item.price)} x {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-800">
                    {formatRupiah(item.subtotal)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-4 mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span>{formatRupiah(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Ongkos Kirim</span>
                <span>{formatRupiah(order.shippingCost || '0')}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg pt-2 border-t border-slate-100">
                <span>Total Pembayaran</span>
                <span className="text-primary">{formatRupiah(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Shipping Info */}
          <div className="bg-white rounded-xl border border-slate-100 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Pengiriman
            </h2>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-slate-800">{order.shippingName}</p>
              <p className="text-slate-500">{order.shippingPhone}</p>
              <p className="text-slate-500">{order.shippingAddress}</p>
              {shipping && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">Kurir</p>
                  <p className="font-medium text-slate-700">{shipping.courierName}</p>
                  {shipping.trackingId && (
                    <p className="text-xs text-slate-500 mt-1">
                      Tracking: {shipping.waybillId || shipping.trackingId}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tracking */}
          {(order.status === 'shipping' || order.status === 'delivered') && (
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Lacak Pengiriman
              </h2>
              <TrackingTimeline
                histories={trackingHistories}
                currentStatus={shipping?.status || ''}
              />
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-xl border border-slate-100 p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-2">Catatan</h2>
              <p className="text-sm text-slate-600">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
