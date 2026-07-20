// app/(admin)/dashboard/orders/[id]/page.tsx
import { auth } from '@/lib/auth';
import { getOrder } from '@/app/actions/orders';
import { formatRupiah, formatDate, getStatusLabel, getStatusColor } from '@/lib/utils';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Package, MapPin, Truck, CreditCard, User, ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { StatusUpdateForm } from '../_components/StatusUpdateForm';
import { RollbackStatusForm } from '../_components/RollbackStatusForm';
import { SendOrderButton } from './SendOrderButton';
import { CancelOrderButton } from './CancelOrderButton';
import { TrackingTimeline } from '@/components/shop/TrackingTimeline';
import { db } from '@/lib/db';
import { invoices, shippings, shippingHistories } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

interface Props {
  params: Promise<{ id: string }>;
}

function ProductThumb({ src, alt }: { src?: string | null; alt: string }) {
  if (src) {
    return (
      <div className="w-12 h-12 rounded-md overflow-hidden shrink-0 border border-border bg-muted">
        <Image
          src={src}
          alt={alt}
          width={48}
          height={48}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className="w-12 h-12 rounded-md shrink-0 bg-muted flex items-center justify-center">
      <ShoppingBag className="w-5 h-5 text-muted-foreground" />
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const session = await auth();
  const { id } = await params;
  const order = await getOrder(Number(id));

  if (!order) {
    notFound();
  }

  const invoiceRows = await db.select().from(invoices)
    .where(eq(invoices.orderId, order.id)).limit(1);
  const invoice = invoiceRows[0] ?? null;

  const shippingRows = await db.select().from(shippings)
    .where(eq(shippings.orderId, order.id)).limit(1);
  const shipping = shippingRows[0] ?? null;

  let trackingHistoryRows: any[] = [];
  if (shipping) {
    trackingHistoryRows = await db.select().from(shippingHistories)
      .where(eq(shippingHistories.shippingId, shipping.id))
      .orderBy(desc(shippingHistories.updatedAt));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Kembali ke Pesanan
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              Pesanan #{order.orderNumber}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {order.createdAt && formatDate(order.createdAt)}
            </p>
          </div>
          <Badge className={`${getStatusColor(order.status || 'waiting_payment')} text-sm px-3 py-1 w-fit`}>
            {getStatusLabel(order.status || 'waiting_payment')}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left — Order Items + Shipping */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Order Items */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Item Pesanan</h3>
            </div>
            <div className="p-5">
              <div className="divide-y divide-border">
                {order.items.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
                    <ProductThumb src={(item as any).productImage} alt={item.productName} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.productName}</p>
                      {(item as any).variantLabel && (
                        <p className="text-xs text-muted-foreground mt-0.5">{(item as any).variantLabel}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatRupiah(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-foreground shrink-0">
                      {formatRupiah(item.subtotal)}
                    </p>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatRupiah(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Ongkir</span>
                  <span>{formatRupiah(order.shippingCost || '0')}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary">{formatRupiah(order.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Shipping Info */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Informasi Pengiriman</h3>
            </div>
            <div className="p-5 space-y-2.5 text-sm">
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span className="text-muted-foreground">Nama</span>
                <span className="text-foreground">{order.shippingName}</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span className="text-muted-foreground">Telepon</span>
                <span className="text-foreground">{order.shippingPhone}</span>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-1">
                <span className="text-muted-foreground">Alamat</span>
                <span className="text-foreground">{order.shippingAddress}</span>
              </div>
              {order.notes && (
                <div className="grid grid-cols-[100px_1fr] gap-1">
                  <span className="text-muted-foreground">Catatan</span>
                  <span className="text-foreground">{order.notes}</span>
                </div>
              )}
              {shipping && (
                <div className="pt-2.5 mt-2.5 border-t border-border space-y-2.5">
                  <div className="grid grid-cols-[100px_1fr] gap-1">
                    <span className="text-muted-foreground">Kurir</span>
                    <span className="text-foreground">{shipping.courierName}</span>
                  </div>
                  {shipping.trackingId && (
                    <div className="grid grid-cols-[100px_1fr] gap-1">
                      <span className="text-muted-foreground">Tracking</span>
                      <span className="text-foreground font-mono text-xs">{shipping.waybillId || shipping.trackingId}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tracking Timeline */}
          {(order.status === 'shipping' || order.status === 'delivered') && trackingHistoryRows.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Lacak Pengiriman</h3>
              </div>
              <div className="p-5">
                <TrackingTimeline
                  histories={trackingHistoryRows}
                  currentStatus={shipping?.status || ''}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4 md:space-y-6">
          {/* Customer */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Customer</h3>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                  {order.user?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{order.user?.name || '-'}</p>
                  <p className="text-xs text-muted-foreground truncate">{order.user?.email || '-'}</p>
                  {order.user?.phone && <p className="text-xs text-muted-foreground">{order.user.phone}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          {invoice && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Pembayaran</h3>
              </div>
              <div className="p-5 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-foreground capitalize">{invoice.status}</span>
                </div>
                {invoice.paymentMethod && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Metode</span>
                    <span className="text-foreground">{invoice.paymentMethod}</span>
                  </div>
                )}
                {invoice.paymentChannel && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Channel</span>
                    <span className="text-foreground">{invoice.paymentChannel}</span>
                  </div>
                )}
                {invoice.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dibayar</span>
                    <span className="text-foreground">{formatDate(invoice.paidAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Send Order */}
          {order.status === 'packing' && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Kirim Pesanan</h3>
              </div>
              <div className="p-5">
                <SendOrderButton orderId={order.id} />
              </div>
            </div>
          )}

          {/* Cancel Order */}
          {(order.status === 'waiting_payment' || order.status === 'packing') && (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Batalkan Pesanan</h3>
              </div>
              <div className="p-5">
                <p className="text-xs text-muted-foreground mb-3">
                  Membatalkan akan mengembalikan stok dan {order.status === 'waiting_payment' ? 'membatalkan invoice' : 'menghentikan proses pengemasan'}.
                </p>
                <CancelOrderButton orderId={order.id} />
              </div>
            </div>
          )}

          {/* Update Status */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Update Status</h3>
            </div>
            <div className="p-5">
              <StatusUpdateForm
                orderId={order.id}
                currentStatus={order.status || 'waiting_payment'}
                adminId={session?.user?.id || '0'}
              />
              <RollbackStatusForm
                orderId={order.id}
                currentStatus={order.status || 'waiting_payment'}
                adminId={session?.user?.id || '0'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
