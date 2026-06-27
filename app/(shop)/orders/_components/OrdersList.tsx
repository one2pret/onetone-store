'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Clock } from 'lucide-react';
import { formatRupiah, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface OrderItem {
  id: number;
  productName: string;
  quantity: number;
}

interface Order {
  id: number;
  orderNumber: string | null;
  status: string | null;
  total: string | null;
  createdAt: Date | null;
  willExpiredAt: Date | null;
  items: OrderItem[];
}

interface Props {
  orders: Order[];
}

const TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'waiting_payment', label: 'Menunggu Bayar' },
  { key: 'packing', label: 'Dikemas' },
  { key: 'shipping', label: 'Dikirim' },
  { key: 'delivered', label: 'Selesai' },
  { key: 'expired', label: 'Expired' },
  { key: 'cancelled', label: 'Dibatalkan' },
] as const;

function CountdownTimer({ expiredAt }: { expiredAt: Date }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(expiredAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(expiredAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiredAt]);

  if (timeLeft <= 0) return <span className="text-red-500 text-xs">Waktu habis</span>;

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  return (
    <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
      <Clock className="w-3 h-3" />
      {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  );
}

function getTimeLeft(expiredAt: Date): number {
  return Math.max(0, Math.floor((new Date(expiredAt).getTime() - Date.now()) / 1000));
}

export function OrdersList({ orders }: Props) {
  const [activeTab, setActiveTab] = useState<string>('all');

  const filteredOrders = activeTab === 'all'
    ? orders
    : orders.filter(o => o.status === activeTab);

  // Count per status
  const counts: Record<string, number> = { all: orders.length };
  for (const order of orders) {
    const status = order.status || 'waiting_payment';
    counts[status] = (counts[status] || 0) + 1;
  }

  return (
    <div>
      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {TABS.map((tab) => {
          const count = counts[tab.key] || 0;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
              <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">Tidak ada pesanan {activeTab !== 'all' ? `berstatus "${getStatusLabel(activeTab)}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block bg-white rounded-xl border border-slate-100 p-5 hover:border-slate-200 transition"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-mono font-semibold text-sm text-slate-800">{order.orderNumber}</p>
                <Badge className={getStatusColor(order.status || 'waiting_payment')}>
                  {getStatusLabel(order.status || 'waiting_payment')}
                </Badge>
              </div>

              <p className="text-xs text-slate-400 mb-3">
                {order.createdAt && formatDate(order.createdAt)}
                {order.status === 'waiting_payment' && order.willExpiredAt && (
                  <> &middot; <CountdownTimer expiredAt={new Date(order.willExpiredAt)} /></>
                )}
              </p>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {order.items.map(i => i.productName).join(', ')}
                  {order.items.length > 1 && ` (${order.items.length} produk)`}
                </span>
                <span className="font-semibold text-primary shrink-0 ml-4">{formatRupiah(order.total || '0')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
