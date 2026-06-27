// app/(admin)/dashboard/page.tsx
import { getDashboardStats, getAllOrders } from '@/app/actions/orders';
import { formatRupiah, formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  Clock,
  Truck,
  PackageCheck,
  DollarSign,
  BarChart3,
  ArrowUpRight,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default async function AdminDashboardPage() {
  const [stats, recentOrders] = await Promise.all([
    getDashboardStats(),
    getAllOrders(),
  ]);

  const statCards = [
    {
      title: 'Pesanan Hari Ini',
      value: stats.todayOrders,
      icon: ShoppingCart,
      color: 'bg-blue-500/10 text-blue-600',
      iconBg: 'bg-blue-500',
    },
    {
      title: 'Pendapatan Hari Ini',
      value: formatRupiah(stats.todayRevenue),
      icon: TrendingUp,
      color: 'bg-emerald-500/10 text-emerald-600',
      iconBg: 'bg-emerald-500',
    },
    {
      title: 'Menunggu Pembayaran',
      value: stats.waitingPaymentOrders,
      icon: Clock,
      color: 'bg-amber-500/10 text-amber-600',
      iconBg: 'bg-amber-500',
      href: '/dashboard/orders?status=waiting_payment',
    },
    {
      title: 'Perlu Dikemas',
      value: stats.packingOrders,
      icon: PackageCheck,
      color: 'bg-violet-500/10 text-violet-600',
      iconBg: 'bg-violet-500',
      href: '/dashboard/orders?status=packing',
    },
  ];

  const revenueCards = [
    { label: 'Hari Ini', value: stats.todayRevenue },
    { label: 'Minggu Ini', value: stats.weekRevenue },
    { label: 'Bulan Ini', value: stats.monthRevenue },
    { label: 'Total', value: stats.totalRevenue },
  ];

  const statusBreakdown = [
    { status: 'waiting_payment', count: stats.ordersByStatus['waiting_payment'] || 0 },
    { status: 'packing', count: stats.ordersByStatus['packing'] || 0 },
    { status: 'shipping', count: stats.ordersByStatus['shipping'] || 0 },
    { status: 'delivered', count: stats.ordersByStatus['delivered'] || 0 },
    { status: 'cancelled', count: stats.ordersByStatus['cancelled'] || 0 },
    { status: 'expired', count: stats.ordersByStatus['expired'] || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Ringkasan toko Anda</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {statCards.map((card) => {
          const inner = (
            <div className="bg-white rounded-xl p-4 md:p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
                {card.href && (
                  <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition" />
                )}
              </div>
              <p className="text-xl md:text-2xl font-bold text-slate-800">{card.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{card.title}</p>
            </div>
          );
          return card.href ? (
            <Link key={card.title} href={card.href}>{inner}</Link>
          ) : (
            <div key={card.title}>{inner}</div>
          );
        })}
      </div>

      {/* Revenue + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Revenue */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Pendapatan</h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {revenueCards.map((item, i) => (
                <div
                  key={item.label}
                  className={`p-4 rounded-xl ${i === 3 ? 'bg-primary/5 border border-primary/10' : 'bg-slate-50'}`}
                >
                  <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide">{item.label}</p>
                  <p className={`text-base md:text-lg font-bold mt-1 ${i === 3 ? 'text-primary' : 'text-slate-800'}`}>
                    {formatRupiah(item.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Orders by Status */}
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">Pesanan per Status</h3>
          </div>
          <div className="p-5">
            <div className="space-y-2.5">
              {statusBreakdown.map(({ status, count }) => (
                <div key={status} className="flex items-center justify-between">
                  <Badge className={getStatusColor(status)}>{getStatusLabel(status)}</Badge>
                  <span className="text-sm font-semibold text-slate-700">{count}</span>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500">Total</span>
                <span className="text-sm font-bold text-slate-800">{stats.totalOrders}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Stats */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {[
          { label: 'Total Produk', value: stats.totalProducts, icon: Package, color: 'bg-violet-500' },
          { label: 'Produk Aktif', value: stats.activeProducts, icon: Package, color: 'bg-emerald-500' },
          { label: 'Sedang Dikirim', value: stats.shippingOrders, icon: Truck, color: 'bg-blue-500' },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl p-4 md:p-5 border border-slate-200/60 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`${item.color} w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0`}>
                <item.icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-lg md:text-xl font-bold text-slate-800">{item.value}</p>
                <p className="text-[11px] md:text-xs text-slate-500 truncate">{item.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Pesanan Terbaru</h3>
          <Link href="/dashboard/orders" className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1">
            Lihat Semua <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">No. Order</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentOrders.slice(0, 5).map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-5 py-3.5">
                    <Link href={`/dashboard/orders/${order.id}`} className="font-mono text-xs text-primary hover:underline font-medium">
                      {order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-600">{order.user?.name || '-'}</td>
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-700">{formatRupiah(order.total)}</td>
                  <td className="px-5 py-3.5">
                    <Badge className={getStatusColor(order.status || 'waiting_payment')}>
                      {getStatusLabel(order.status || 'waiting_payment')}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">
                    {order.createdAt && formatDate(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {recentOrders.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-sm">Belum ada pesanan</div>
          )}
        </div>
      </div>
    </div>
  );
}
