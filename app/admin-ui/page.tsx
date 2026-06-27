// app/dashboard-ui/page.tsx
import {
  LayoutDashboard, Package, ShoppingCart, FolderOpen, Users, Settings,
  TrendingUp, TrendingDown, DollarSign, Clock, Truck, PackageCheck,
  BarChart3, ArrowRight, ArrowLeft, Eye, Pencil, Trash2, Plus,
  Search, Bell, ChevronDown, ChevronRight, LogOut, User, Zap,
  ExternalLink, Filter, Download, MoreHorizontal, CheckCircle2,
  XCircle, AlertCircle, Timer, CreditCard, MapPin, Phone, Star,
  ShoppingBag, CalendarDays, Activity, ArrowUpRight
} from 'lucide-react';
import { AdminCurrencyInputDemo } from './CurrencyInputDemo';

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

// ========================================
// Reusable mini-components for the preview
// ========================================

function StatusBadge({ status, label }: { status: string; label: string }) {
  const colors: Record<string, string> = {
    waiting_payment: 'bg-amber-100 text-amber-700 border-amber-200',
    packing: 'bg-blue-100 text-blue-700 border-blue-200',
    shipping: 'bg-purple-100 text-purple-700 border-purple-200',
    delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-100 text-red-700 border-red-200',
    expired: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${colors[status] || colors.expired}`}>
      {label}
    </span>
  );
}

export default function DashboardUIPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ============================================ */}
      {/* Page Header */}
      {/* ============================================ */}
      <div className="bg-white border-b border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-2xl font-bold text-slate-800">Dashboard UI Preview</h1>
          <p className="text-slate-500 text-sm mt-1">
            Preview komponen admin dashboard sebelum diimplementasi.
          </p>
        </div>
      </div>

      {/* ============================================ */}
      {/* SECTION 1: Sidebar */}
      {/* ============================================ */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-lg font-bold text-slate-800 mb-1">1. Admin Sidebar</h2>
        <p className="text-sm text-slate-500 mb-6">Sidebar navigasi dengan dark gradient</p>

        <div className="flex gap-6">
          {/* Sidebar Preview */}
          <div className="w-64 flex-shrink-0 rounded-xl overflow-hidden shadow-lg">
            <aside className="bg-gradient-to-b from-slate-800 to-slate-900 h-[520px] flex flex-col">
              {/* Logo */}
              <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-700/50">
                <div className="w-8 h-8 bg-[#51B1A6] rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-semibold text-white">Admin Panel</span>
              </div>

              {/* Search */}
              <div className="px-4 mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    className="w-full pl-9 pr-3 py-2 bg-slate-700/50 border border-slate-700 rounded-lg text-sm text-slate-300 placeholder:text-slate-500"
                    placeholder="Cari menu..."
                    readOnly
                  />
                </div>
              </div>

              {/* Navigation */}
              <nav className="mt-4 px-3 flex-1">
                <p className="px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Menu Utama</p>
                <ul className="space-y-1">
                  {[
                    { name: 'Dashboard', icon: LayoutDashboard, active: true },
                    { name: 'Produk', icon: Package, active: false, badge: '17' },
                    { name: 'Kategori', icon: FolderOpen, active: false },
                    { name: 'Pesanan', icon: ShoppingCart, active: false, badge: '3' },
                  ].map((item) => (
                    <li key={item.name}>
                      <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                        item.active
                          ? 'bg-[#51B1A6] text-white shadow-lg shadow-[#51B1A6]/20'
                          : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                      }`}>
                        <div className="flex items-center gap-3">
                          <item.icon className="w-[18px] h-[18px]" />
                          {item.name}
                        </div>
                        {item.badge && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            item.active ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-400'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Pengaturan</p>
                <ul className="space-y-1">
                  {[
                    { name: 'Pelanggan', icon: Users },
                    { name: 'Pengaturan', icon: Settings },
                  ].map((item) => (
                    <li key={item.name}>
                      <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 cursor-pointer transition">
                        <item.icon className="w-[18px] h-[18px]" />
                        {item.name}
                      </div>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Bottom */}
              <div className="p-4 border-t border-slate-700/50">
                <div className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700/50 text-slate-300 rounded-lg text-sm cursor-pointer hover:bg-slate-700 transition">
                  <ExternalLink className="w-4 h-4" />
                  Lihat Toko
                </div>
              </div>
            </aside>
          </div>

          {/* Header Preview */}
          <div className="flex-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Top Header Bar</p>
            <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200">
              <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-slate-800">Dashboard</h2>
                  <span className="text-sm text-slate-400">/</span>
                  <span className="text-sm text-slate-500">Overview</span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Search */}
                  <div className="relative hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      className="w-60 pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400"
                      placeholder="Cari pesanan, produk..."
                      readOnly
                    />
                  </div>

                  {/* Notifications */}
                  <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                  </button>

                  {/* User */}
                  <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                    <div className="w-8 h-8 rounded-full bg-[#51B1A6]/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-[#51B1A6]" />
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-sm font-medium text-slate-800">Admin Store</p>
                      <p className="text-[11px] text-slate-400">admin@store.com</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </header>
            </div>

            {/* Breadcrumb variants */}
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3 mt-6">Breadcrumb</p>
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">Dashboard</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span className="text-slate-400">Pesanan</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span className="font-medium text-slate-700">#ORD260427A1B2</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button className="flex items-center gap-1 text-slate-500 hover:text-slate-700 transition">
                  <ArrowLeft className="w-4 h-4" />
                  Kembali
                </button>
                <span className="text-slate-300">|</span>
                <span className="font-medium text-slate-700">Detail Pesanan</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* SECTION 2: Stat Cards */}
      {/* ============================================ */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-lg font-bold text-slate-800 mb-1">2. Stat Cards</h2>
        <p className="text-sm text-slate-500 mb-6">Kartu statistik utama dashboard</p>

        {/* Style A: Icon with colored bg */}
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Style A — Colored Icon</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { title: 'Pesanan Hari Ini', value: '12', icon: ShoppingCart, color: 'bg-blue-500', trend: '+3 dari kemarin', trendUp: true },
            { title: 'Pendapatan Hari Ini', value: formatRp(15750000), icon: TrendingUp, color: 'bg-emerald-500', trend: '+18%', trendUp: true },
            { title: 'Menunggu Bayar', value: '5', icon: Clock, color: 'bg-amber-500', trend: '2 akan expired', trendUp: false },
            { title: 'Perlu Dikemas', value: '3', icon: PackageCheck, color: 'bg-orange-500', trend: '', trendUp: false },
          ].map((card) => (
            <div key={card.title} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500">{card.title}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{card.value}</p>
                  {card.trend && (
                    <p className={`text-xs mt-1 flex items-center gap-1 ${card.trendUp ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {card.trendUp ? <ArrowUpRight className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {card.trend}
                    </p>
                  )}
                </div>
                <div className={`${card.color} p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Style B: Minimal with left border */}
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Style B — Left Border Accent</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Total Produk', value: '17', accent: 'border-l-purple-500', icon: Package },
            { title: 'Produk Aktif', value: '15', accent: 'border-l-emerald-500', icon: CheckCircle2 },
            { title: 'Sedang Dikirim', value: '4', accent: 'border-l-blue-500', icon: Truck },
            { title: 'Selesai Bulan Ini', value: '28', accent: 'border-l-[#51B1A6]', icon: Star },
          ].map((card) => (
            <div key={card.title} className={`bg-white rounded-xl p-5 shadow-sm border border-slate-200 border-l-4 ${card.accent}`}>
              <div className="flex items-center gap-3">
                <card.icon className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">{card.title}</p>
                  <p className="text-xl font-bold text-slate-800">{card.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* SECTION 3: Revenue Card */}
      {/* ============================================ */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-lg font-bold text-slate-800 mb-1">3. Revenue & Status Breakdown</h2>
        <p className="text-sm text-slate-500 mb-6">Pendapatan dan distribusi pesanan per status</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-slate-600" />
                <h3 className="font-semibold text-slate-800">Pendapatan</h3>
              </div>
              <div className="flex gap-1">
                {['Hari', 'Minggu', 'Bulan'].map((t, i) => (
                  <button key={t} className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                    i === 2 ? 'bg-[#51B1A6] text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Hari Ini', value: 15750000, sub: '+18%' },
                  { label: 'Minggu Ini', value: 89200000, sub: '+12%' },
                  { label: 'Bulan Ini', value: 342500000, sub: '+8%' },
                  { label: 'Total', value: 1250000000, sub: '' },
                ].map((item) => (
                  <div key={item.label} className="p-4 bg-slate-50 rounded-xl text-center">
                    <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                    <p className="text-base font-bold text-slate-800">{formatRp(item.value)}</p>
                    {item.sub && <p className="text-[11px] text-emerald-600 mt-0.5">{item.sub}</p>}
                  </div>
                ))}
              </div>

              {/* Mini chart placeholder */}
              <div className="mt-4 h-32 bg-slate-50 rounded-xl flex items-center justify-center border border-dashed border-slate-200">
                <div className="text-center">
                  <BarChart3 className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">Area chart pendapatan (coming soon)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Orders by Status */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100">
              <Activity className="w-5 h-5 text-slate-600" />
              <h3 className="font-semibold text-slate-800">Pesanan per Status</h3>
            </div>
            <div className="p-5 space-y-3">
              {[
                { status: 'waiting_payment', label: 'Menunggu Bayar', count: 5, pct: 15 },
                { status: 'packing', label: 'Dikemas', count: 3, pct: 9 },
                { status: 'shipping', label: 'Dikirim', count: 4, pct: 12 },
                { status: 'delivered', label: 'Selesai', count: 28, pct: 82 },
                { status: 'cancelled', label: 'Dibatalkan', count: 2, pct: 6 },
                { status: 'expired', label: 'Expired', count: 1, pct: 3 },
              ].map((item) => (
                <div key={item.status} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2.5">
                    <StatusBadge status={item.status} label={item.label} />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#51B1A6] rounded-full"
                        style={{ width: `${Math.min(item.pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 w-6 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Total</span>
                <span className="text-sm font-bold text-slate-800">43</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* SECTION 4: Data Table */}
      {/* ============================================ */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-lg font-bold text-slate-800 mb-1">4. Data Table — Pesanan</h2>
        <p className="text-sm text-slate-500 mb-6">Tabel dengan filter status, sort, dan aksi</p>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          {/* Table Header */}
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-800">Daftar Pesanan</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm w-56 placeholder:text-slate-400"
                  placeholder="Cari order..."
                  readOnly
                />
              </div>
              <button className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition">
                <Filter className="w-4 h-4" />
                Filter
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="px-5 pt-3 flex items-center gap-2 flex-wrap">
            {[
              { label: 'Semua', count: 43, active: true },
              { label: 'Menunggu Bayar', count: 5, active: false },
              { label: 'Dikemas', count: 3, active: false },
              { label: 'Dikirim', count: 4, active: false },
              { label: 'Selesai', count: 28, active: false },
              { label: 'Dibatalkan', count: 2, active: false },
            ].map((tab) => (
              <button
                key={tab.label}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  tab.active
                    ? 'bg-[#51B1A6] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-[10px] ${tab.active ? 'text-white/80' : 'text-slate-400'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto mt-3">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">No. Order</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { no: 'ORD260427A1B2', name: 'Rina Kartika', total: 20290000, status: 'delivered', date: '27 Apr 2026' },
                  { no: 'ORD260427C3D4', name: 'Andi Prasetyo', total: 17199000, status: 'shipping', date: '27 Apr 2026' },
                  { no: 'ORD260426E5F6', name: 'Siti Nurhaliza', total: 7648000, status: 'packing', date: '26 Apr 2026' },
                  { no: 'ORD260426G7H8', name: 'Rina Kartika', total: 4199000, status: 'waiting_payment', date: '26 Apr 2026' },
                  { no: 'ORD260425I9J0', name: 'Dimas Aditya', total: 1747000, status: 'cancelled', date: '25 Apr 2026' },
                ].map((row) => (
                  <tr key={row.no} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4">
                      <span className="font-mono text-sm font-medium text-[#51B1A6]">{row.no}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <span className="text-sm text-slate-700">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">{formatRp(row.total)}</td>
                    <td className="px-5 py-4">
                      <StatusBadge
                        status={row.status}
                        label={
                          row.status === 'waiting_payment' ? 'Menunggu Bayar' :
                          row.status === 'packing' ? 'Dikemas' :
                          row.status === 'shipping' ? 'Dikirim' :
                          row.status === 'delivered' ? 'Selesai' :
                          'Dibatalkan'
                        }
                      />
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">{row.date}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-500">Menampilkan 1-5 dari 43 pesanan</p>
            <div className="flex items-center gap-1">
              <button className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition">Prev</button>
              <button className="px-3 py-1.5 text-sm bg-[#51B1A6] text-white rounded-lg">1</button>
              <button className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">2</button>
              <button className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">3</button>
              <button className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition">Next</button>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* SECTION 5: Order Detail Layout */}
      {/* ============================================ */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-lg font-bold text-slate-800 mb-1">5. Order Detail</h2>
        <p className="text-sm text-slate-500 mb-6">Layout detail pesanan (2 kolom: konten + sidebar)</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main */}
          <div className="lg:col-span-2 space-y-4">
            {/* Items Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 p-5 border-b border-slate-100">
                <Package className="w-5 h-5 text-slate-600" />
                <h3 className="font-semibold text-slate-800">Item Pesanan</h3>
                <StatusBadge status="packing" label="Dikemas" />
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { name: 'iPhone 15 Pro Max 256GB', qty: 1, price: 19500000 },
                  { name: 'AirPods Pro 2nd Gen', qty: 1, price: 3299000 },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                        <ShoppingBag className="w-5 h-5 text-slate-300" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-500">{formatRp(item.price)} x {item.qty}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{formatRp(item.price * item.qty)}</p>
                  </div>
                ))}
              </div>
              <div className="p-5 border-t border-slate-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-700">{formatRp(22799000)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Ongkir (JNE REG)</span>
                  <span className="text-slate-700">{formatRp(18000)}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-100">
                  <span className="text-slate-800">Total</span>
                  <span className="text-[#51B1A6]">{formatRp(22817000)}</span>
                </div>
              </div>
            </div>

            {/* Shipping Info */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 p-5 border-b border-slate-100">
                <MapPin className="w-5 h-5 text-slate-600" />
                <h3 className="font-semibold text-slate-800">Informasi Pengiriman</h3>
              </div>
              <div className="p-5 text-sm space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500">Nama</span>
                  <span className="col-span-2 text-slate-800">Rina Kartika</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500">Telepon</span>
                  <span className="col-span-2 text-slate-800">0812-9876-5432</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500">Alamat</span>
                  <span className="col-span-2 text-slate-800">Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan 12160</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500">Kurir</span>
                  <span className="col-span-2 text-slate-800">JNE REG — 1-2 hari</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-slate-500">Resi</span>
                  <span className="col-span-2 font-mono text-[#51B1A6]">JNE1234567890</span>
                </div>
              </div>
            </div>

            {/* Tracking Timeline */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 p-5 border-b border-slate-100">
                <Truck className="w-5 h-5 text-slate-600" />
                <h3 className="font-semibold text-slate-800">Lacak Pengiriman</h3>
              </div>
              <div className="p-5">
                <div className="space-y-0">
                  {[
                    { status: 'Paket diterima', time: '27 Apr, 14:30', active: true, icon: CheckCircle2 },
                    { status: 'Paket dalam pengiriman', time: '27 Apr, 08:15', active: false, icon: Truck },
                    { status: 'Paket di sortir di hub Jakarta', time: '26 Apr, 22:00', active: false, icon: Package },
                    { status: 'Paket diambil kurir', time: '26 Apr, 16:45', active: false, icon: PackageCheck },
                    { status: 'Pesanan siap dikirim', time: '26 Apr, 14:00', active: false, icon: ShoppingBag },
                  ].map((step, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          step.active ? 'bg-[#51B1A6] text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          <step.icon className="w-4 h-4" />
                        </div>
                        {i < 4 && <div className={`w-0.5 h-10 ${step.active ? 'bg-[#51B1A6]' : 'bg-slate-200'}`} />}
                      </div>
                      <div className="pb-8">
                        <p className={`text-sm font-medium ${step.active ? 'text-slate-800' : 'text-slate-600'}`}>{step.status}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{step.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Customer */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">Customer</h3>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#51B1A6]/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-[#51B1A6]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">Rina Kartika</p>
                    <p className="text-xs text-slate-500">rina@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Phone className="w-3.5 h-3.5" />
                  <span>0812-9876-5432</span>
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">Pembayaran</h3>
              </div>
              <div className="p-5 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <StatusBadge status="delivered" label="Paid" />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Metode</span>
                  <span className="text-slate-800">VIRTUAL_ACCOUNT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Channel</span>
                  <span className="text-slate-800">BCA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dibayar</span>
                  <span className="text-slate-800">27 Apr, 09:15</span>
                </div>
              </div>
            </div>

            {/* Action: Send Order */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">Kirim Pesanan</h3>
              </div>
              <div className="p-5">
                <p className="text-xs text-slate-500 mb-3">
                  Kirim ke kurir via Bitship. Tracking ID otomatis tersimpan.
                </p>
                <button className="w-full py-2.5 bg-[#51B1A6] hover:bg-[#3D9A8F] text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
                  <Truck className="w-4 h-4" />
                  Kirim via Bitship
                </button>
              </div>
            </div>

            {/* Action: Cancel */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">Batalkan Pesanan</h3>
              </div>
              <div className="p-5">
                <p className="text-xs text-slate-500 mb-3">
                  Membatalkan akan mengembalikan stok dan menghentikan proses pengemasan.
                </p>
                <button className="w-full py-2.5 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Batalkan Pesanan
                </button>
              </div>
            </div>

            {/* Status Update */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800 text-sm">Update Status</h3>
              </div>
              <div className="p-5">
                <p className="text-xs text-slate-500 mb-3">Ubah status pesanan</p>
                <div className="flex flex-wrap gap-2">
                  <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition">
                    Shipping
                  </button>
                  <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition">
                    Delivered
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* SECTION 6: Form Elements */}
      {/* ============================================ */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-lg font-bold text-slate-800 mb-1">6. Form Elements</h2>
        <p className="text-sm text-slate-500 mb-6">Input, textarea, select, dan layout form admin</p>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
            {/* Text Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama Produk</label>
              <input
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#51B1A6] focus:border-transparent transition"
                placeholder="Masukkan nama produk"
                defaultValue="iPhone 15 Pro Max 256GB"
              />
            </div>

            {/* Currency Input */}
            <AdminCurrencyInputDemo />

            {/* Select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Kategori</label>
              <div className="relative">
                <select className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#51B1A6] focus:border-transparent transition">
                  <option>Smartphone & Tablet</option>
                  <option>Laptop & Komputer</option>
                  <option>Audio & Headphone</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Input with helper */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Stok</label>
              <input
                type="number"
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#51B1A6] focus:border-transparent transition"
                defaultValue="12"
              />
              <p className="text-xs text-slate-400 mt-1">Masukkan jumlah stok tersedia</p>
            </div>

            {/* Textarea */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Deskripsi</label>
              <textarea
                rows={3}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#51B1A6] focus:border-transparent transition resize-none"
                defaultValue="iPhone 15 Pro Max dengan chip A17 Pro, kamera 48MP..."
              />
            </div>

            {/* Toggle / Switch */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700">Produk Aktif</p>
                <p className="text-xs text-slate-500">Tampilkan di katalog</p>
              </div>
              <div className="w-11 h-6 bg-[#51B1A6] rounded-full relative cursor-pointer">
                <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-slate-700">Produk Unggulan</p>
                <p className="text-xs text-slate-500">Tampilkan di homepage</p>
              </div>
              <div className="w-11 h-6 bg-slate-300 rounded-full relative cursor-pointer">
                <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm" />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-100">
            <button className="px-6 py-2.5 bg-[#51B1A6] hover:bg-[#3D9A8F] text-white text-sm font-medium rounded-lg transition">
              Simpan Produk
            </button>
            <button className="px-6 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition">
              Batal
            </button>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* SECTION 7: Toast / Alert Variants */}
      {/* ============================================ */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-lg font-bold text-slate-800 mb-1">7. Alerts & Notifications</h2>
        <p className="text-sm text-slate-500 mb-6">Notifikasi, alert banners, dan empty states</p>

        <div className="space-y-4 max-w-2xl">
          {/* Success */}
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Pesanan berhasil dikirim</p>
              <p className="text-xs text-emerald-600 mt-0.5">Tracking ID: BITSHIP-TRK-001</p>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">2 pesanan akan segera expired</p>
              <p className="text-xs text-amber-600 mt-0.5">Segera ingatkan customer untuk menyelesaikan pembayaran.</p>
            </div>
          </div>

          {/* Error */}
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Gagal mengirim pesanan</p>
              <p className="text-xs text-red-600 mt-0.5">Bitship API error: courier not available. Silakan coba lagi.</p>
            </div>
          </div>

          {/* Info */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Webhook diterima dari Xendit</p>
              <p className="text-xs text-blue-600 mt-0.5">Pesanan #ORD260427C3D4 berhasil dibayar via BCA Virtual Account.</p>
            </div>
          </div>
        </div>

        {/* Empty States */}
        <p className="text-xs text-slate-400 uppercase tracking-wider mb-3 mt-8">Empty States</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
            <ShoppingCart className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Belum ada pesanan</h3>
            <p className="text-xs text-slate-400 mb-4">Pesanan akan muncul saat customer mulai berbelanja.</p>
            <button className="px-4 py-2 bg-[#51B1A6] text-white text-xs font-medium rounded-lg">
              Lihat Produk
            </button>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
            <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Tidak ada produk</h3>
            <p className="text-xs text-slate-400 mb-4">Mulai tambahkan produk ke toko Anda.</p>
            <button className="px-4 py-2 bg-[#51B1A6] text-white text-xs font-medium rounded-lg flex items-center gap-1.5 mx-auto">
              <Plus className="w-3.5 h-3.5" /> Tambah Produk
            </button>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* SECTION 8: Product CRUD Table */}
      {/* ============================================ */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-lg font-bold text-slate-800 mb-1">8. Product Table (CRUD)</h2>
        <p className="text-sm text-slate-500 mb-6">Tabel produk dengan aksi edit/delete</p>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Produk</h3>
            <button className="flex items-center gap-1.5 px-4 py-2 bg-[#51B1A6] hover:bg-[#3D9A8F] text-white text-sm font-medium rounded-lg transition">
              <Plus className="w-4 h-4" />
              Tambah Produk
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Produk</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kategori</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Harga</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Stok</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { name: 'iPhone 15 Pro Max', cat: 'Smartphone', price: 19500000, stock: 12, active: true, featured: true },
                  { name: 'MacBook Air M3', cat: 'Laptop', price: 16999000, stock: 5, active: true, featured: true },
                  { name: 'Sony WH-1000XM5', cat: 'Audio', price: 4299000, stock: 18, active: true, featured: false },
                  { name: 'Logitech MX Master 3S', cat: 'Aksesoris', price: 1299000, stock: 0, active: false, featured: false },
                ].map((p) => (
                  <tr key={p.name} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="w-4 h-4 text-slate-300" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{p.name}</p>
                          {p.featured && <span className="text-[10px] text-orange-600 font-medium">Unggulan</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{p.cat}</td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-800">{formatRp(p.price)}</td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-medium ${p.stock === 0 ? 'text-red-600' : p.stock <= 5 ? 'text-amber-600' : 'text-slate-800'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                        p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {p.active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Bottom padding */}
      <div className="h-20" />
    </div>
  );
}
