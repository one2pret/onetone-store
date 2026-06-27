// app/design-system/page.tsx
import {
  Search, ShoppingCart, User, ChevronDown, Star, ShoppingBag,
  MapPin, Clock, Phone, Mail, Instagram, Facebook, Youtube,
  Truck, Shield, Headphones, CreditCard, Heart, Eye,
  ArrowRight, Package, ChevronRight, Minus, Plus, Trash2,
  CheckCircle2, Circle, AlertCircle, XCircle, Timer,
  Loader2, ChevronLeft, Home, X, Check
} from 'lucide-react';
import { CurrencyInputDemo } from './CurrencyInputDemo';

// ========================================
// Mock data
// ========================================

const mockProducts = [
  {
    name: 'iPhone 15 Pro Max 256GB',
    category: 'Smartphone',
    price: 19500000,
    originalPrice: 21999000,
    stock: 12,
    maxStock: 20,
    rating: 4.8,
    reviews: 124,
    badge: 'Terlaris',
    badgeColor: 'bg-red-500',
  },
  {
    name: 'MacBook Air M3 13" 256GB',
    category: 'Laptop',
    price: 16999000,
    originalPrice: 18499000,
    stock: 5,
    maxStock: 15,
    rating: 4.9,
    reviews: 87,
    badge: 'Baru',
    badgeColor: 'bg-blue-500',
  },
  {
    name: 'Sony WH-1000XM5 Headphone',
    category: 'Audio',
    price: 4299000,
    originalPrice: null,
    stock: 18,
    maxStock: 25,
    rating: 4.7,
    reviews: 203,
    badge: null,
    badgeColor: '',
  },
  {
    name: 'Samsung Galaxy Watch 6 Classic',
    category: 'Wearable',
    price: 3999000,
    originalPrice: 5499000,
    stock: 3,
    maxStock: 10,
    rating: 4.5,
    reviews: 56,
    badge: 'Stok Terbatas',
    badgeColor: 'bg-orange-500',
  },
];

function formatRp(n: number) {
  return 'Rp ' + n.toLocaleString('id-ID');
}

function StockBar({ stock, maxStock }: { stock: number; maxStock: number }) {
  const pct = (stock / maxStock) * 100;
  const color = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>Tersedia: <span className="font-semibold text-slate-700">{stock}</span></span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ========================================
// Table of Contents
// ========================================
const sections = [
  { id: 'colors', no: 1, title: 'Color Palette' },
  { id: 'typography', no: 2, title: 'Typography' },
  { id: 'spacing', no: 3, title: 'Spacing & Grid' },
  { id: 'shadows', no: 4, title: 'Shadows & Elevation' },
  { id: 'radius', no: 5, title: 'Border Radius' },
  { id: 'icons', no: 6, title: 'Iconography' },
  { id: 'buttons', no: 7, title: 'Buttons (All States)' },
  { id: 'badges', no: 8, title: 'Badges & Tags' },
  { id: 'forms', no: 9, title: 'Form Elements' },
  { id: 'navbar', no: 10, title: 'Navbar (Dark Header)' },
  { id: 'breadcrumb', no: 11, title: 'Breadcrumb' },
  { id: 'tabs', no: 12, title: 'Tabs' },
  { id: 'pagination', no: 13, title: 'Pagination' },
  { id: 'modal', no: 14, title: 'Modal / Dialog' },
  { id: 'toast', no: 15, title: 'Toast Notifications' },
  { id: 'loading', no: 16, title: 'Loading States' },
  { id: 'empty', no: 17, title: 'Empty States' },
  { id: 'avatar', no: 18, title: 'Avatars' },
  { id: 'product-card', no: 19, title: 'Product Card' },
  { id: 'price', no: 20, title: 'Price Display' },
  { id: 'quantity', no: 21, title: 'Quantity Selector' },
  { id: 'cart-item', no: 22, title: 'Cart Item Row' },
  { id: 'stepper', no: 23, title: 'Checkout Stepper' },
  { id: 'timeline', no: 24, title: 'Order Status Timeline' },
  { id: 'countdown', no: 25, title: 'Payment Countdown' },
  { id: 'hero', no: 26, title: 'Hero Banner' },
  { id: 'features', no: 27, title: 'Feature Highlights' },
  { id: 'categories', no: 28, title: 'Category Cards' },
  { id: 'section-headers', no: 29, title: 'Section Headers' },
  { id: 'footer', no: 30, title: 'Footer (Dark)' },
];

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-2xl font-bold text-slate-800">Design System — Shop (Frontend)</h1>
          <p className="text-slate-500 text-sm mt-1">
            Komponen UI lengkap untuk online store. 30 section: Foundation + Core Components + E-commerce Specific.
          </p>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-bold text-slate-700 mb-3">Daftar Isi</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1.5">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="text-xs text-slate-500 hover:text-[#51B1A6] transition truncate">
                <span className="text-slate-400 mr-1">{s.no}.</span> {s.title}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ================================================== */}
      {/* PART A: FOUNDATION */}
      {/* ================================================== */}
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <h2 className="text-xs font-bold text-[#51B1A6] uppercase tracking-widest">Part A — Foundation</h2>
      </div>

      {/* ============================================ */}
      {/* 1. Color Palette */}
      {/* ============================================ */}
      <section id="colors" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">1. Color Palette</h2>
        <p className="text-sm text-slate-500 mb-6">Warna utama, netral, semantik, dan aksen</p>

        <div className="space-y-6">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Brand / Primary</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
              {[
                { name: 'Primary', hex: '#51B1A6' },
                { name: 'Primary Hover', hex: '#3D9A8F' },
                { name: 'Primary Light', hex: '#C5DDD9' },
                { name: 'Primary/10', hex: '#51B1A61A' },
              ].map((c) => (
                <div key={c.name} className="text-center">
                  <div className="h-14 rounded-lg border border-slate-200 shadow-sm mb-1.5" style={{ backgroundColor: c.hex }} />
                  <p className="text-[11px] font-medium text-slate-700">{c.name}</p>
                  <p className="text-[10px] text-slate-400">{c.hex}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Neutral</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-3">
              {[
                { name: 'White', hex: '#ffffff' },
                { name: 'Slate 50', hex: '#f8fafc' },
                { name: 'Slate 100', hex: '#f1f5f9' },
                { name: 'Slate 200', hex: '#e2e8f0' },
                { name: 'Slate 300', hex: '#cbd5e1' },
                { name: 'Slate 400', hex: '#94a3b8' },
                { name: 'Slate 500', hex: '#64748b' },
                { name: 'Slate 700', hex: '#334155' },
                { name: 'Slate 800', hex: '#1e293b' },
                { name: 'Slate 900', hex: '#0f172a' },
              ].map((c) => (
                <div key={c.name} className="text-center">
                  <div className="h-14 rounded-lg border border-slate-200 shadow-sm mb-1.5" style={{ backgroundColor: c.hex }} />
                  <p className="text-[10px] font-medium text-slate-700">{c.name}</p>
                  <p className="text-[10px] text-slate-400">{c.hex}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Semantic</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
              {[
                { name: 'Success', hex: '#22c55e' },
                { name: 'Warning', hex: '#f59e0b' },
                { name: 'Danger', hex: '#ef4444' },
                { name: 'Info', hex: '#3b82f6' },
                { name: 'Star', hex: '#facc15' },
                { name: 'Orange', hex: '#f97316' },
                { name: 'Purple', hex: '#8b5cf6' },
                { name: 'Pink', hex: '#ec4899' },
              ].map((c) => (
                <div key={c.name} className="text-center">
                  <div className="h-14 rounded-lg border border-slate-200 shadow-sm mb-1.5" style={{ backgroundColor: c.hex }} />
                  <p className="text-[10px] font-medium text-slate-700">{c.name}</p>
                  <p className="text-[10px] text-slate-400">{c.hex}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 2. Typography */}
      {/* ============================================ */}
      <section id="typography" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">2. Typography</h2>
        <p className="text-sm text-slate-500 mb-6">Font system: Inter / system-ui. Hierarki dan weight.</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          {[
            { label: 'Hero Title — 48px Bold', el: <h1 className="text-5xl font-bold text-slate-900">Gadget Terbaru</h1> },
            { label: 'H1 — 36px Bold', el: <h1 className="text-4xl font-bold text-slate-900">Heading One</h1> },
            { label: 'H2 — 24px Bold', el: <h2 className="text-2xl font-bold text-slate-800">Heading Two</h2> },
            { label: 'H3 — 18px Semibold', el: <h3 className="text-lg font-semibold text-slate-800">Heading Three</h3> },
            { label: 'H4 — 16px Semibold', el: <h4 className="text-base font-semibold text-slate-800">Heading Four</h4> },
            { label: 'Body — 14px Regular', el: <p className="text-sm text-slate-600">Temukan smartphone, laptop, audio, dan aksesoris elektronik berkualitas dengan garansi resmi dan harga terbaik.</p> },
            { label: 'Body Small — 13px Regular', el: <p className="text-[13px] text-slate-500">Produk ini memiliki garansi resmi 1 tahun.</p> },
            { label: 'Caption — 12px Regular', el: <p className="text-xs text-slate-400">Stok: 12 unit tersedia</p> },
            { label: 'Overline — 11px Semibold Uppercase', el: <p className="text-[11px] font-semibold text-[#51B1A6] uppercase tracking-wider">Smartphone & Tablet</p> },
            { label: 'Price — 20px Bold', el: (
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-[#51B1A6]">Rp 19.500.000</span>
                <span className="text-sm text-slate-400 line-through">Rp 21.999.000</span>
              </div>
            )},
            { label: 'Mono — 14px Mono', el: <p className="font-mono text-sm text-slate-700">ORD260427A1B2</p> },
          ].map((item, i) => (
            <div key={i}>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">{item.label}</span>
              {item.el}
            </div>
          ))}
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 3. Spacing & Grid */}
      {/* ============================================ */}
      <section id="spacing" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">3. Spacing & Grid System</h2>
        <p className="text-sm text-slate-500 mb-6">Base unit: 4px. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-4">Spacing Scale</p>
          <div className="space-y-2">
            {[
              { name: '1 (4px)', tw: 'w-1' },
              { name: '2 (8px)', tw: 'w-2' },
              { name: '3 (12px)', tw: 'w-3' },
              { name: '4 (16px)', tw: 'w-4' },
              { name: '5 (20px)', tw: 'w-5' },
              { name: '6 (24px)', tw: 'w-6' },
              { name: '8 (32px)', tw: 'w-8' },
              { name: '10 (40px)', tw: 'w-10' },
              { name: '12 (48px)', tw: 'w-12' },
              { name: '16 (64px)', tw: 'w-16' },
            ].map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-20 text-right font-mono">{s.name}</span>
                <div className={`h-4 bg-[#51B1A6]/20 border border-[#51B1A6]/30 rounded ${s.tw}`} />
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 uppercase tracking-wider mb-4 mt-8">Grid — Max Width 1280px, 4 Columns (Product Grid)</p>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-20 bg-slate-100 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                Col {n}
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 uppercase tracking-wider mb-4 mt-6">Grid — Responsive Breakpoints</p>
          <div className="overflow-x-auto">
            <table className="text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pr-6 py-2 text-slate-500 font-semibold">Breakpoint</th>
                  <th className="pr-6 py-2 text-slate-500 font-semibold">Min Width</th>
                  <th className="pr-6 py-2 text-slate-500 font-semibold">Columns (Product)</th>
                  <th className="pr-6 py-2 text-slate-500 font-semibold">Gap</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                <tr className="border-b border-slate-100"><td className="pr-6 py-2 font-mono">mobile</td><td className="pr-6 py-2">0px</td><td className="pr-6 py-2">2</td><td className="pr-6 py-2">12px</td></tr>
                <tr className="border-b border-slate-100"><td className="pr-6 py-2 font-mono">sm</td><td className="pr-6 py-2">640px</td><td className="pr-6 py-2">2</td><td className="pr-6 py-2">16px</td></tr>
                <tr className="border-b border-slate-100"><td className="pr-6 py-2 font-mono">md</td><td className="pr-6 py-2">768px</td><td className="pr-6 py-2">3</td><td className="pr-6 py-2">16px</td></tr>
                <tr className="border-b border-slate-100"><td className="pr-6 py-2 font-mono">lg</td><td className="pr-6 py-2">1024px</td><td className="pr-6 py-2">4</td><td className="pr-6 py-2">16px</td></tr>
                <tr><td className="pr-6 py-2 font-mono">xl</td><td className="pr-6 py-2">1280px</td><td className="pr-6 py-2">4-5</td><td className="pr-6 py-2">20px</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 4. Shadows & Elevation */}
      {/* ============================================ */}
      <section id="shadows" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">4. Shadows & Elevation</h2>
        <p className="text-sm text-slate-500 mb-6">Level elevasi dari flat hingga modal overlay</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
          {[
            { name: 'None', cls: '' },
            { name: 'shadow-sm', cls: 'shadow-sm' },
            { name: 'shadow', cls: 'shadow' },
            { name: 'shadow-md', cls: 'shadow-md' },
            { name: 'shadow-lg', cls: 'shadow-lg' },
            { name: 'shadow-xl', cls: 'shadow-xl' },
          ].map((s) => (
            <div key={s.name} className={`bg-white rounded-xl border border-slate-200 p-6 text-center ${s.cls}`}>
              <p className="text-xs font-medium text-slate-700">{s.name}</p>
              <p className="text-[10px] text-slate-400 mt-1">Elevation {s.name === 'None' ? '0' : s.name.split('-')[1] || '1'}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 5. Border Radius */}
      {/* ============================================ */}
      <section id="radius" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">5. Border Radius Scale</h2>
        <p className="text-sm text-slate-500 mb-6">Skala radius dari sharp ke pill</p>

        <div className="flex flex-wrap gap-6 items-end">
          {[
            { name: 'none', cls: 'rounded-none', val: '0' },
            { name: 'sm', cls: 'rounded-sm', val: '2px' },
            { name: 'md', cls: 'rounded-md', val: '6px' },
            { name: 'lg', cls: 'rounded-lg', val: '8px' },
            { name: 'xl', cls: 'rounded-xl', val: '12px' },
            { name: '2xl', cls: 'rounded-2xl', val: '16px' },
            { name: 'full', cls: 'rounded-full', val: '9999px' },
          ].map((r) => (
            <div key={r.name} className="text-center">
              <div className={`w-16 h-16 bg-[#51B1A6] ${r.cls}`} />
              <p className="text-xs font-medium text-slate-700 mt-2">{r.name}</p>
              <p className="text-[10px] text-slate-400">{r.val}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 6. Iconography */}
      {/* ============================================ */}
      <section id="icons" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">6. Iconography</h2>
        <p className="text-sm text-slate-500 mb-6">Lucide React icons. Sizes: 16, 20, 24px. Stroke: 2px default.</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-4">
            {[
              { Icon: Search, name: 'Search' }, { Icon: ShoppingCart, name: 'Cart' },
              { Icon: Heart, name: 'Heart' }, { Icon: User, name: 'User' },
              { Icon: Truck, name: 'Truck' }, { Icon: Package, name: 'Package' },
              { Icon: Shield, name: 'Shield' }, { Icon: Star, name: 'Star' },
              { Icon: CreditCard, name: 'Card' }, { Icon: MapPin, name: 'MapPin' },
              { Icon: Clock, name: 'Clock' }, { Icon: Phone, name: 'Phone' },
              { Icon: Mail, name: 'Mail' }, { Icon: Eye, name: 'Eye' },
              { Icon: Trash2, name: 'Trash' }, { Icon: Plus, name: 'Plus' },
              { Icon: Minus, name: 'Minus' }, { Icon: Check, name: 'Check' },
              { Icon: X, name: 'X' }, { Icon: ChevronDown, name: 'ChevDown' },
              { Icon: ChevronRight, name: 'ChevRight' }, { Icon: ArrowRight, name: 'Arrow' },
              { Icon: Headphones, name: 'Support' }, { Icon: Home, name: 'Home' },
            ].map(({ Icon, name }) => (
              <div key={name} className="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-slate-50 transition">
                <Icon className="w-5 h-5 text-slate-600" />
                <span className="text-[10px] text-slate-400">{name}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 uppercase tracking-wider mb-3 mt-6">Icon Sizes</p>
          <div className="flex items-end gap-6">
            {[
              { size: 16, tw: 'w-4 h-4' },
              { size: 20, tw: 'w-5 h-5' },
              { size: 24, tw: 'w-6 h-6' },
              { size: 32, tw: 'w-8 h-8' },
            ].map((s) => (
              <div key={s.size} className="text-center">
                <ShoppingCart className={`${s.tw} text-slate-600 mx-auto`} />
                <span className="text-[10px] text-slate-400 mt-1 block">{s.size}px</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ================================================== */}
      {/* PART B: CORE COMPONENTS */}
      {/* ================================================== */}
      <div className="max-w-7xl mx-auto px-4 mb-4 mt-8">
        <h2 className="text-xs font-bold text-[#51B1A6] uppercase tracking-widest">Part B — Core Components</h2>
      </div>

      {/* ============================================ */}
      {/* 7. Buttons (All States) */}
      {/* ============================================ */}
      <section id="buttons" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">7. Buttons (All States)</h2>
        <p className="text-sm text-slate-500 mb-6">Variants, sizes, dan states (default, hover, disabled, loading)</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          {/* Variants */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Variants</p>
            <div className="flex flex-wrap items-center gap-3">
              <button className="px-5 py-2.5 bg-[#51B1A6] hover:bg-[#3D9A8F] text-white text-sm font-medium rounded-lg transition">Primary</button>
              <button className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition">Dark</button>
              <button className="px-5 py-2.5 border border-[#51B1A6] text-[#51B1A6] hover:bg-[#51B1A6]/5 text-sm font-medium rounded-lg transition">Outline</button>
              <button className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition">Secondary</button>
              <button className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition">Danger</button>
              <button className="px-5 py-2.5 text-[#51B1A6] hover:bg-[#51B1A6]/5 text-sm font-medium rounded-lg transition">Ghost</button>
              <button className="text-[#51B1A6] hover:underline text-sm font-medium">Link</button>
            </div>
          </div>

          {/* Sizes */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Sizes</p>
            <div className="flex flex-wrap items-center gap-3">
              <button className="px-3 py-1.5 bg-[#51B1A6] text-white text-xs font-medium rounded-md">Small</button>
              <button className="px-5 py-2.5 bg-[#51B1A6] text-white text-sm font-medium rounded-lg">Default</button>
              <button className="px-7 py-3 bg-[#51B1A6] text-white text-base font-medium rounded-lg">Large</button>
              <button className="p-2 bg-[#51B1A6] text-white rounded-lg"><ShoppingCart className="w-4 h-4" /></button>
              <button className="p-2.5 bg-[#51B1A6] text-white rounded-lg"><ShoppingCart className="w-5 h-5" /></button>
              <button className="px-5 py-2.5 bg-[#51B1A6] text-white text-sm font-medium rounded-full">Pill</button>
            </div>
          </div>

          {/* States */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">States</p>
            <div className="flex flex-wrap items-center gap-3">
              <button className="px-5 py-2.5 bg-[#51B1A6] text-white text-sm font-medium rounded-lg">Default</button>
              <button className="px-5 py-2.5 bg-[#3D9A8F] text-white text-sm font-medium rounded-lg ring-2 ring-[#51B1A6]/30 ring-offset-2">Focused</button>
              <button className="px-5 py-2.5 bg-[#51B1A6]/50 text-white text-sm font-medium rounded-lg cursor-not-allowed opacity-60">Disabled</button>
              <button className="px-5 py-2.5 bg-[#51B1A6] text-white text-sm font-medium rounded-lg flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </button>
            </div>
          </div>

          {/* With icons */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">With Icons</p>
            <div className="flex flex-wrap items-center gap-3">
              <button className="px-5 py-2.5 bg-[#51B1A6] text-white text-sm font-medium rounded-lg flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Tambah ke Keranjang
              </button>
              <button className="px-5 py-2.5 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg flex items-center gap-2">
                Lihat Semua <ArrowRight className="w-4 h-4" />
              </button>
              <button className="px-5 py-2.5 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium rounded-lg flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Hapus
              </button>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 8. Badges & Tags */}
      {/* ============================================ */}
      <section id="badges" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">8. Badges & Tags</h2>
        <p className="text-sm text-slate-500 mb-6">Status badges, product badges, dan label tags</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Order Status</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Menunggu Bayar', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
                { label: 'Dikemas', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
                { label: 'Dikirim', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
                { label: 'Selesai', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                { label: 'Dibatalkan', cls: 'bg-red-100 text-red-700 border-red-200' },
                { label: 'Expired', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
              ].map((b) => (
                <span key={b.label} className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${b.cls}`}>{b.label}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Product Badges</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-0.5 bg-red-500 text-white text-[11px] font-bold rounded">-15%</span>
              <span className="px-2 py-0.5 bg-red-500 text-white text-[11px] font-bold rounded">Terlaris</span>
              <span className="px-2 py-0.5 bg-blue-500 text-white text-[11px] font-bold rounded">Baru</span>
              <span className="px-2 py-0.5 bg-orange-500 text-white text-[11px] font-bold rounded">Stok Terbatas</span>
              <span className="px-2 py-0.5 bg-emerald-500 text-white text-[11px] font-bold rounded">Unggulan</span>
              <span className="px-2 py-0.5 bg-slate-500 text-white text-[11px] font-bold rounded">Habis</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Info Tags</p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">Tersedia</span>
              <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full">Stok Habis</span>
              <span className="px-2.5 py-1 bg-[#51B1A6]/10 text-[#51B1A6] text-xs font-medium rounded-full">Garansi Resmi</span>
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">Pre-Order</span>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 9. Form Elements */}
      {/* ============================================ */}
      <section id="forms" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">9. Form Elements</h2>
        <p className="text-sm text-slate-500 mb-6">Input, textarea, select, checkbox, radio, toggle</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
            {/* Text Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Text Input</label>
              <input className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#51B1A6] focus:border-transparent transition" placeholder="Nama produk..." />
            </div>

            {/* Currency Input */}
            <CurrencyInputDemo />

            {/* Input with error */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Input Error</label>
              <input className="w-full px-3.5 py-2.5 border border-red-300 rounded-lg text-sm bg-red-50/50 focus:outline-none focus:ring-2 focus:ring-red-400 transition" defaultValue="a" />
              <p className="text-xs text-red-500 mt-1">Nama produk minimal 3 karakter</p>
            </div>

            {/* Select */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Select</label>
              <div className="relative">
                <select className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#51B1A6] transition">
                  <option>Pilih kategori...</option>
                  <option>Smartphone</option>
                  <option>Laptop</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Input with helper */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Berat (gram)</label>
              <input type="number" className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#51B1A6] transition" defaultValue="221" />
              <p className="text-xs text-slate-400 mt-1">Berat produk dalam gram, untuk kalkulasi ongkir</p>
            </div>

            {/* Textarea */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Textarea</label>
              <textarea rows={3} className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#51B1A6] transition resize-none" placeholder="Deskripsi produk..." />
            </div>

            {/* Checkbox */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-3">Checkbox</p>
              <div className="space-y-2">
                {['JNE', 'SiCepat', 'J&T Express'].map((item, i) => (
                  <label key={item} className="flex items-center gap-2.5 cursor-pointer">
                    <div className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center ${i < 2 ? 'bg-[#51B1A6] border-[#51B1A6]' : 'border-slate-300'}`}>
                      {i < 2 && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-sm text-slate-700">{item}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Radio */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-3">Radio</p>
              <div className="space-y-2">
                {['JNE REG (Rp 18.000)', 'SiCepat REG (Rp 15.000)', 'J&T EZ (Rp 12.000)'].map((item, i) => (
                  <label key={item} className="flex items-center gap-2.5 cursor-pointer">
                    <div className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center ${i === 0 ? 'border-[#51B1A6]' : 'border-slate-300'}`}>
                      {i === 0 && <div className="w-2.5 h-2.5 rounded-full bg-[#51B1A6]" />}
                    </div>
                    <span className="text-sm text-slate-700">{item}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Toggle */}
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-slate-700 mb-3">Toggle / Switch</p>
              <div className="flex gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-6 bg-[#51B1A6] rounded-full relative cursor-pointer">
                    <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 right-0.5 shadow-sm" />
                  </div>
                  <span className="text-sm text-slate-700">Produk Aktif</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-6 bg-slate-300 rounded-full relative cursor-pointer">
                    <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm" />
                  </div>
                  <span className="text-sm text-slate-500">Produk Unggulan</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 10. Navbar */}
      {/* ============================================ */}
      <section id="navbar" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">10. Navbar (Dark Header)</h2>
        <p className="text-sm text-slate-500 mb-6">Header gelap 3-layer: info bar + main nav + category bar</p>

        <div className="rounded-xl overflow-hidden shadow-lg border border-slate-200">
          <div className="bg-[#51B1A6] text-white text-xs py-1.5 px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> 0812-3456-7890</span>
              <span className="hidden sm:flex items-center gap-1"><Mail className="w-3 h-3" /> hello@nextelektronik.com</span>
            </div>
            <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> Gratis Ongkir min. Rp 500rb</span>
          </div>
          <div className="bg-slate-800 px-4 lg:px-6 py-3">
            <div className="flex items-center gap-4">
              <span className="text-xl font-bold text-white flex-shrink-0">Next<span className="text-[#51B1A6]">Elektronik</span></span>
              <button className="hidden lg:flex items-center gap-1.5 bg-slate-700 text-white text-sm px-4 py-2.5 rounded-lg"><Package className="w-4 h-4" /> Kategori <ChevronDown className="w-4 h-4" /></button>
              <div className="flex-1 max-w-2xl relative">
                <input className="w-full pl-4 pr-12 py-2.5 bg-white rounded-lg text-sm placeholder:text-slate-400" placeholder="Cari produk, merek, atau kategori..." readOnly />
                <button className="absolute right-1 top-1/2 -translate-y-1/2 bg-[#51B1A6] text-white p-2 rounded-md"><Search className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center gap-1">
                <button className="relative p-2.5 text-slate-300 hover:text-white rounded-lg"><Heart className="w-5 h-5" /></button>
                <button className="relative p-2.5 text-slate-300 hover:text-white rounded-lg"><ShoppingCart className="w-5 h-5" /><span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">3</span></button>
                <button className="flex items-center gap-2 p-2.5 text-slate-300 hover:text-white rounded-lg"><User className="w-5 h-5" /><span className="hidden lg:inline text-sm">Masuk</span></button>
              </div>
            </div>
          </div>
          <div className="bg-slate-700 px-4 lg:px-6 py-2 flex items-center gap-6 overflow-x-auto text-sm">
            {['Smartphone & Tablet', 'Laptop & Komputer', 'Audio & Headphone', 'Wearable', 'Aksesoris', 'Promo'].map((cat, i) => (
              <button key={cat} className={`whitespace-nowrap py-1 ${i === 5 ? 'text-[#51B1A6] font-semibold' : 'text-slate-300 hover:text-white'}`}>{cat}</button>
            ))}
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 11. Breadcrumb */}
      {/* ============================================ */}
      <section id="breadcrumb" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">11. Breadcrumb</h2>
        <p className="text-sm text-slate-500 mb-6">Navigasi hierarki halaman</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Home className="w-4 h-4 text-slate-400" />
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-[#51B1A6]">Produk</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-[#51B1A6]">Smartphone & Tablet</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="font-medium text-slate-700">iPhone 15 Pro Max</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Home className="w-4 h-4" />
            <span>/</span>
            <span className="text-[#51B1A6]">Pesanan Saya</span>
            <span>/</span>
            <span className="font-medium text-slate-700">#ORD260427A1B2</span>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 12. Tabs */}
      {/* ============================================ */}
      <section id="tabs" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">12. Tabs</h2>
        <p className="text-sm text-slate-500 mb-6">Tab navigasi: pill style dan underline style</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-8">
          {/* Pill tabs */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Pill Tabs (e.g. Order status filter)</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'Semua', count: 10, active: true },
                { label: 'Menunggu Bayar', count: 2, active: false },
                { label: 'Dikemas', count: 3, active: false },
                { label: 'Dikirim', count: 1, active: false },
                { label: 'Selesai', count: 4, active: false },
              ].map((t) => (
                <button key={t.label} className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition ${
                  t.active ? 'bg-[#51B1A6] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}>
                  {t.label} <span className={`ml-1 ${t.active ? 'text-white/70' : 'text-slate-400'}`}>{t.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Underline tabs */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Underline Tabs (e.g. Product detail)</p>
            <div className="flex gap-6 border-b border-slate-200">
              {['Deskripsi', 'Spesifikasi', 'Ulasan (124)'].map((t, i) => (
                <button key={t} className={`pb-3 text-sm font-medium border-b-2 transition -mb-px ${
                  i === 0 ? 'border-[#51B1A6] text-[#51B1A6]' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 13. Pagination */}
      {/* ============================================ */}
      <section id="pagination" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">13. Pagination</h2>
        <p className="text-sm text-slate-500 mb-6">Navigasi halaman untuk list produk</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          {/* Full pagination */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Standard</p>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Menampilkan 1-12 dari 48 produk</p>
              <div className="flex items-center gap-1">
                <button className="p-2 border border-slate-200 rounded-lg text-slate-400"><ChevronLeft className="w-4 h-4" /></button>
                <button className="w-9 h-9 bg-[#51B1A6] text-white text-sm font-medium rounded-lg">1</button>
                <button className="w-9 h-9 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">2</button>
                <button className="w-9 h-9 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">3</button>
                <span className="px-1 text-slate-400">...</span>
                <button className="w-9 h-9 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50">8</button>
                <button className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          {/* Simple prev/next */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Simple (Mobile)</p>
            <div className="flex items-center justify-between">
              <button className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600">Sebelumnya</button>
              <span className="text-sm text-slate-500">Halaman 1 dari 8</span>
              <button className="px-4 py-2 bg-[#51B1A6] text-white rounded-lg text-sm">Selanjutnya</button>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 14. Modal / Dialog */}
      {/* ============================================ */}
      <section id="modal" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">14. Modal / Dialog</h2>
        <p className="text-sm text-slate-500 mb-6">Konfirmasi dialog dan info modal</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Confirm Delete */}
          <div className="bg-black/50 rounded-xl p-8 flex items-center justify-center">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-100 rounded-full"><AlertCircle className="w-5 h-5 text-red-600" /></div>
                <h3 className="font-semibold text-slate-800">Hapus Produk?</h3>
              </div>
              <p className="text-sm text-slate-500 mb-5">
                Produk &ldquo;iPhone 15 Pro Max&rdquo; akan dihapus permanen. Aksi ini tidak bisa dibatalkan.
              </p>
              <div className="flex gap-2 justify-end">
                <button className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg">Batal</button>
                <button className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg">Hapus</button>
              </div>
            </div>
          </div>

          {/* Cancel Order Confirm */}
          <div className="bg-black/50 rounded-xl p-8 flex items-center justify-center">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-100 rounded-full"><AlertCircle className="w-5 h-5 text-amber-600" /></div>
                <h3 className="font-semibold text-slate-800">Batalkan Pesanan?</h3>
              </div>
              <p className="text-sm text-slate-500 mb-5">
                Pesanan #ORD260427A1B2 akan dibatalkan. Stok produk akan dikembalikan dan invoice akan di-expire.
              </p>
              <div className="flex gap-2 justify-end">
                <button className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg">Tidak</button>
                <button className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg">Ya, Batalkan</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 15. Toast Notifications */}
      {/* ============================================ */}
      <section id="toast" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">15. Toast Notifications</h2>
        <p className="text-sm text-slate-500 mb-6">Notifikasi toast (sonner) — position: top-right</p>

        <div className="space-y-3 max-w-sm ml-auto">
          {[
            { icon: CheckCircle2, title: 'Berhasil ditambahkan', desc: 'iPhone 15 Pro Max masuk ke keranjang', color: 'text-emerald-500', border: 'border-l-emerald-500' },
            { icon: AlertCircle, title: 'Stok terbatas', desc: 'Hanya tersisa 3 unit untuk produk ini', color: 'text-amber-500', border: 'border-l-amber-500' },
            { icon: XCircle, title: 'Gagal checkout', desc: 'Stok tidak mencukupi untuk AirPods Pro', color: 'text-red-500', border: 'border-l-red-500' },
            { icon: AlertCircle, title: 'Pembayaran berhasil', desc: 'Pesanan Anda sedang dikemas', color: 'text-blue-500', border: 'border-l-blue-500' },
          ].map((t, i) => (
            <div key={i} className={`bg-white rounded-lg shadow-lg border border-slate-200 border-l-4 ${t.border} p-4 flex items-start gap-3`}>
              <t.icon className={`w-5 h-5 ${t.color} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{t.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
              </div>
              <button className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 16. Loading States */}
      {/* ============================================ */}
      <section id="loading" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">16. Loading States</h2>
        <p className="text-sm text-slate-500 mb-6">Skeleton, spinner, dan progress indicator</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-8">
          {/* Spinner */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Spinner</p>
            <div className="flex items-center gap-6">
              <Loader2 className="w-5 h-5 text-[#51B1A6] animate-spin" />
              <Loader2 className="w-8 h-8 text-[#51B1A6] animate-spin" />
              <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Memuat data...</div>
            </div>
          </div>

          {/* Skeleton - Product Card */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Skeleton — Product Card</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-white rounded-xl overflow-hidden border border-slate-200">
                  <div className="aspect-square bg-slate-200 animate-pulse" />
                  <div className="p-3.5 space-y-2">
                    <div className="h-3 bg-slate-200 rounded animate-pulse w-16" />
                    <div className="h-4 bg-slate-200 rounded animate-pulse" />
                    <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                    <div className="h-3 bg-slate-200 rounded animate-pulse w-12" />
                    <div className="h-5 bg-slate-200 rounded animate-pulse w-24" />
                    <div className="h-1.5 bg-slate-200 rounded-full animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Skeleton - Table Row */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Skeleton — Table Rows</p>
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center gap-4 p-4 border border-slate-100 rounded-lg">
                  <div className="w-10 h-10 bg-slate-200 rounded-lg animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded animate-pulse w-40" />
                    <div className="h-3 bg-slate-200 rounded animate-pulse w-24" />
                  </div>
                  <div className="h-4 bg-slate-200 rounded animate-pulse w-20" />
                  <div className="h-6 bg-slate-200 rounded-full animate-pulse w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 17. Empty States */}
      {/* ============================================ */}
      <section id="empty" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">17. Empty States</h2>
        <p className="text-sm text-slate-500 mb-6">Placeholder saat data kosong</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: ShoppingCart, title: 'Keranjang Kosong', desc: 'Belum ada produk di keranjang. Yuk mulai belanja!', btn: 'Belanja Sekarang' },
            { icon: Package, title: 'Belum Ada Pesanan', desc: 'Pesanan Anda akan muncul di sini setelah checkout.', btn: 'Lihat Produk' },
            { icon: Search, title: 'Produk Tidak Ditemukan', desc: 'Coba ubah kata kunci atau filter pencarian Anda.', btn: 'Reset Filter' },
          ].map((e) => (
            <div key={e.title} className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <e.icon className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-slate-700 mb-1">{e.title}</h3>
              <p className="text-xs text-slate-400 mb-4">{e.desc}</p>
              <button className="px-4 py-2 bg-[#51B1A6] text-white text-xs font-medium rounded-lg">{e.btn}</button>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 18. Avatars */}
      {/* ============================================ */}
      <section id="avatar" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">18. Avatars</h2>
        <p className="text-sm text-slate-500 mb-6">Avatar user dengan initial fallback</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-end gap-4">
            {/* Sizes */}
            {[
              { size: 'w-8 h-8', text: 'text-xs', name: 'S' },
              { size: 'w-10 h-10', text: 'text-sm', name: 'M' },
              { size: 'w-12 h-12', text: 'text-base', name: 'L' },
              { size: 'w-16 h-16', text: 'text-lg', name: 'XL' },
            ].map((a) => (
              <div key={a.name} className="text-center">
                <div className={`${a.size} rounded-full bg-[#51B1A6]/10 flex items-center justify-center ${a.text} font-semibold text-[#51B1A6]`}>
                  RK
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">{a.name}</span>
              </div>
            ))}
            {/* Icon fallback */}
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                <User className="w-5 h-5 text-slate-400" />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Icon</span>
            </div>
            {/* With status */}
            <div className="text-center">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-[#51B1A6]/10 flex items-center justify-center text-sm font-semibold text-[#51B1A6]">AP</div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Online</span>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ================================================== */}
      {/* PART C: E-COMMERCE SPECIFIC */}
      {/* ================================================== */}
      <div className="max-w-7xl mx-auto px-4 mb-4 mt-8">
        <h2 className="text-xs font-bold text-[#51B1A6] uppercase tracking-widest">Part C — E-commerce Specific</h2>
      </div>

      {/* ============================================ */}
      {/* 19. Product Card (same as before) */}
      {/* ============================================ */}
      <section id="product-card" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">19. Product Card</h2>
        <p className="text-sm text-slate-500 mb-6">Card produk: rating, stok bar, harga coret, badge, hover overlay</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {mockProducts.map((p) => (
            <div key={p.name} className="group bg-white rounded-xl overflow-hidden border border-slate-200 hover:shadow-xl hover:border-[#51B1A6]/40 transition-all duration-200 hover:-translate-y-1">
              <div className="aspect-square bg-slate-50 relative overflow-hidden">
                <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-16 h-16 text-slate-200" /></div>
                {p.badge && <span className={`absolute top-2 left-2 px-2 py-0.5 ${p.badgeColor} text-white text-[11px] font-semibold rounded`}>{p.badge}</span>}
                {p.originalPrice && <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-500/90 text-white text-[11px] font-bold rounded">-{Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)}%</span>}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button className="bg-white/90 backdrop-blur p-2.5 rounded-full shadow-lg mr-2"><Eye className="w-5 h-5" /></button>
                  <button className="bg-[#51B1A6] text-white p-2.5 rounded-full shadow-lg"><ShoppingCart className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-3.5">
                <p className="text-[11px] text-[#51B1A6] font-medium uppercase tracking-wide mb-1">{p.category}</p>
                <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug mb-2 group-hover:text-[#51B1A6] transition min-h-[2.5rem]">{p.name}</h3>
                <div className="flex items-center gap-1 mb-2">
                  <div className="flex">{[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.floor(p.rating) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}`} />)}</div>
                  <span className="text-[11px] text-slate-400">({p.reviews})</span>
                </div>
                <span className="text-base font-bold text-[#51B1A6]">{formatRp(p.price)}</span>
                {p.originalPrice && <span className="text-xs text-slate-400 line-through ml-2">{formatRp(p.originalPrice)}</span>}
                <StockBar stock={p.stock} maxStock={p.maxStock} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 20. Price Display */}
      {/* ============================================ */}
      <section id="price" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">20. Price Display</h2>
        <p className="text-sm text-slate-500 mb-6">Variasi tampilan harga: normal, diskon, habis</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Normal Price</p>
            <span className="text-xl font-bold text-[#51B1A6]">{formatRp(4299000)}</span>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Discounted Price</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-[#51B1A6]">{formatRp(19500000)}</span>
              <span className="text-sm text-slate-400 line-through">{formatRp(21999000)}</span>
              <span className="px-1.5 py-0.5 bg-red-500 text-white text-[11px] font-bold rounded">-11%</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Out of Stock</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-300 line-through">{formatRp(1299000)}</span>
              <span className="px-2 py-0.5 bg-slate-200 text-slate-500 text-xs font-medium rounded">Habis</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Compact (Cart / Order)</p>
            <div className="text-sm text-slate-600">{formatRp(19500000)} x 2 = <span className="font-semibold text-slate-800">{formatRp(39000000)}</span></div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 21. Quantity Selector */}
      {/* ============================================ */}
      <section id="quantity" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">21. Quantity Selector</h2>
        <p className="text-sm text-slate-500 mb-6">Tombol +/- untuk ubah jumlah</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-wrap gap-8">
          {/* Default */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Default</p>
            <div className="flex items-center gap-0 border border-slate-200 rounded-lg overflow-hidden">
              <button className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition"><Minus className="w-4 h-4" /></button>
              <span className="w-12 h-10 flex items-center justify-center text-sm font-semibold text-slate-800 border-x border-slate-200">2</span>
              <button className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition"><Plus className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Small */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Small (Cart Row)</p>
            <div className="flex items-center gap-0 border border-slate-200 rounded-md overflow-hidden">
              <button className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100"><Minus className="w-3.5 h-3.5" /></button>
              <span className="w-8 h-8 flex items-center justify-center text-xs font-semibold border-x border-slate-200">1</span>
              <button className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </div>

          {/* Min reached */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Min Reached</p>
            <div className="flex items-center gap-0 border border-slate-200 rounded-lg overflow-hidden">
              <button className="w-10 h-10 flex items-center justify-center text-slate-300 cursor-not-allowed"><Minus className="w-4 h-4" /></button>
              <span className="w-12 h-10 flex items-center justify-center text-sm font-semibold text-slate-800 border-x border-slate-200">1</span>
              <button className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 22. Cart Item Row */}
      {/* ============================================ */}
      <section id="cart-item" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">22. Cart Item Row</h2>
        <p className="text-sm text-slate-500 mb-6">Baris item di keranjang belanja</p>

        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {[
            { name: 'iPhone 15 Pro Max 256GB', cat: 'Smartphone', price: 19500000, qty: 1 },
            { name: 'AirPods Pro 2nd Gen', cat: 'Audio', price: 3299000, qty: 2 },
          ].map((item) => (
            <div key={item.name} className="flex items-center gap-4 p-4">
              <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-6 h-6 text-slate-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-slate-800 truncate">{item.name}</h4>
                <p className="text-xs text-slate-400">{item.cat}</p>
                <p className="text-sm font-bold text-[#51B1A6] mt-1">{formatRp(item.price)}</p>
              </div>
              <div className="flex items-center gap-0 border border-slate-200 rounded-md overflow-hidden">
                <button className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100"><Minus className="w-3.5 h-3.5" /></button>
                <span className="w-8 h-8 flex items-center justify-center text-xs font-semibold border-x border-slate-200">{item.qty}</span>
                <button className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100"><Plus className="w-3.5 h-3.5" /></button>
              </div>
              <p className="text-sm font-semibold text-slate-800 w-28 text-right">{formatRp(item.price * item.qty)}</p>
              <button className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 23. Checkout Stepper */}
      {/* ============================================ */}
      <section id="stepper" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">23. Checkout Stepper</h2>
        <p className="text-sm text-slate-500 mb-6">Multi-step checkout: Alamat → Kurir → Review & Bayar</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-center max-w-lg mx-auto">
            {[
              { label: 'Alamat', step: 1, done: true },
              { label: 'Kurir', step: 2, done: false, active: true },
              { label: 'Review & Bayar', step: 3, done: false },
            ].map((s, i) => (
              <div key={s.step} className="flex items-center flex-1 last:flex-initial">
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    s.done ? 'bg-[#51B1A6] text-white' :
                    s.active ? 'bg-[#51B1A6] text-white ring-4 ring-[#51B1A6]/20' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {s.done ? <Check className="w-5 h-5" /> : s.step}
                  </div>
                  <span className={`text-xs mt-2 font-medium ${s.done || s.active ? 'text-[#51B1A6]' : 'text-slate-400'}`}>{s.label}</span>
                </div>
                {i < 2 && (
                  <div className={`flex-1 h-0.5 mx-3 mt-[-1.25rem] ${s.done ? 'bg-[#51B1A6]' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 24. Order Status Timeline */}
      {/* ============================================ */}
      <section id="timeline" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">24. Order Status Timeline</h2>
        <p className="text-sm text-slate-500 mb-6">Timeline vertical untuk tracking pesanan customer</p>

        <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md">
          {[
            { icon: CheckCircle2, label: 'Pesanan Selesai', desc: 'Paket diterima oleh Rina Kartika', time: '27 Apr 2026, 14:30', active: true },
            { icon: Truck, label: 'Dalam Pengiriman', desc: 'JNE REG — Resi: JNE1234567890', time: '26 Apr 2026, 16:45', done: true },
            { icon: Package, label: 'Dikemas', desc: 'Pesanan sedang dikemas oleh toko', time: '26 Apr 2026, 10:00', done: true },
            { icon: CreditCard, label: 'Pembayaran Dikonfirmasi', desc: 'Dibayar via BCA Virtual Account', time: '25 Apr 2026, 09:15', done: true },
            { icon: Clock, label: 'Pesanan Dibuat', desc: 'Menunggu pembayaran', time: '25 Apr 2026, 09:00', done: true },
          ].map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.active ? 'bg-[#51B1A6] text-white' :
                  step.done ? 'bg-[#51B1A6]/10 text-[#51B1A6]' :
                  'bg-slate-100 text-slate-400'
                }`}>
                  <step.icon className="w-4 h-4" />
                </div>
                {i < 4 && <div className={`w-0.5 h-12 ${step.done ? 'bg-[#51B1A6]/30' : 'bg-slate-200'}`} />}
              </div>
              <div className="pb-6">
                <p className={`text-sm font-semibold ${step.active ? 'text-slate-800' : 'text-slate-600'}`}>{step.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
                <p className="text-[11px] text-slate-400 mt-1">{step.time}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 25. Payment Countdown */}
      {/* ============================================ */}
      <section id="countdown" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">25. Payment Countdown</h2>
        <p className="text-sm text-slate-500 mb-6">Timer countdown pembayaran dan action buttons</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          {/* Plenty of time */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-slate-700">Batas Pembayaran</span>
            </div>
            <div className="flex items-center gap-3 bg-amber-50 rounded-lg p-3 mb-4">
              <div className="text-center"><span className="text-lg font-bold text-amber-700">20</span><p className="text-[10px] text-amber-500">Jam</p></div>
              <span className="text-lg font-bold text-amber-400">:</span>
              <div className="text-center"><span className="text-lg font-bold text-amber-700">45</span><p className="text-[10px] text-amber-500">Menit</p></div>
              <span className="text-lg font-bold text-amber-400">:</span>
              <div className="text-center"><span className="text-lg font-bold text-amber-700">12</span><p className="text-[10px] text-amber-500">Detik</p></div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 bg-[#51B1A6] text-white text-sm font-medium rounded-lg">Bayar Sekarang</button>
              <button className="px-4 py-2 border border-red-300 text-red-500 text-sm font-medium rounded-lg">Batal</button>
            </div>
          </div>

          {/* Almost expired */}
          <div className="bg-white rounded-xl border border-red-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-600">Segera Bayar!</span>
            </div>
            <div className="flex items-center gap-3 bg-red-50 rounded-lg p-3 mb-4">
              <div className="text-center"><span className="text-lg font-bold text-red-700">00</span><p className="text-[10px] text-red-500">Jam</p></div>
              <span className="text-lg font-bold text-red-400">:</span>
              <div className="text-center"><span className="text-lg font-bold text-red-700">05</span><p className="text-[10px] text-red-500">Menit</p></div>
              <span className="text-lg font-bold text-red-400">:</span>
              <div className="text-center"><span className="text-lg font-bold text-red-700">33</span><p className="text-[10px] text-red-500">Detik</p></div>
            </div>
            <button className="w-full py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2">
              <CreditCard className="w-4 h-4" /> Bayar Sekarang
            </button>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* ============================================ */}
      {/* 26-30: Sections from before */}
      {/* ============================================ */}

      {/* 26. Hero Banner */}
      <section id="hero" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">26. Hero Banner</h2>
        <p className="text-sm text-slate-500 mb-6">Banner utama dengan gradient dan CTA</p>
        <div className="rounded-xl overflow-hidden shadow-lg">
          <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-[#51B1A6]/80 p-8 md:p-12">
            <div className="max-w-xl">
              <span className="inline-block px-3 py-1 bg-[#51B1A6] text-white text-xs font-semibold rounded-full mb-4">Promo Spesial</span>
              <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-3">Gadget Terbaru<br /><span className="text-[#51B1A6]">Diskon Hingga 30%</span></h2>
              <p className="text-slate-300 text-sm mb-6 max-w-md">Dapatkan smartphone, laptop, dan aksesoris terbaik dengan harga spesial.</p>
              <div className="flex gap-3">
                <button className="px-6 py-3 bg-[#51B1A6] text-white text-sm font-medium rounded-lg flex items-center gap-2">Belanja Sekarang <ArrowRight className="w-4 h-4" /></button>
                <button className="px-6 py-3 border border-white/30 text-white text-sm font-medium rounded-lg">Lihat Promo</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* 27. Feature Highlights */}
      <section id="features" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">27. Feature Highlights</h2>
        <p className="text-sm text-slate-500 mb-6">Keunggulan toko</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Truck, title: 'Gratis Ongkir', desc: 'Min. Rp 500rb', color: 'bg-emerald-50 text-emerald-600' },
            { icon: Shield, title: 'Garansi Resmi', desc: '100% original', color: 'bg-blue-50 text-blue-600' },
            { icon: Headphones, title: 'Support 24/7', desc: 'Chat & WA', color: 'bg-purple-50 text-purple-600' },
            { icon: CreditCard, title: 'Bayar Mudah', desc: 'VA, QRIS, eWallet', color: 'bg-amber-50 text-amber-600' },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-xl border border-slate-200 p-5 flex items-start gap-4 hover:shadow-md transition">
              <div className={`p-3 rounded-xl ${f.color}`}><f.icon className="w-6 h-6" /></div>
              <div><h3 className="font-semibold text-slate-800 text-sm">{f.title}</h3><p className="text-xs text-slate-500 mt-0.5">{f.desc}</p></div>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* 28. Category Cards */}
      <section id="categories" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">28. Category Cards</h2>
        <p className="text-sm text-slate-500 mb-6">Grid kategori produk</p>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {[{ e: '📱', n: 'Smartphone' }, { e: '💻', n: 'Laptop' }, { e: '🎧', n: 'Audio' }, { e: '⌚', n: 'Wearable' }, { e: '🔌', n: 'Aksesoris' }].map((c) => (
            <div key={c.n} className="bg-white rounded-xl border border-slate-200 p-4 text-center hover:shadow-md hover:border-[#51B1A6]/30 transition cursor-pointer group">
              <div className="text-3xl mb-2">{c.e}</div>
              <p className="text-sm font-medium text-slate-700 group-hover:text-[#51B1A6] transition">{c.n}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* 29. Section Headers */}
      <section id="section-headers" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">29. Section Headers</h2>
        <p className="text-sm text-slate-500 mb-6">Heading style untuk section produk</p>
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-8">
          <div className="flex items-center justify-between">
            <div><h2 className="text-xl font-bold text-slate-800">Produk Unggulan</h2><div className="h-1 w-12 bg-[#51B1A6] rounded-full mt-1" /></div>
            <button className="text-sm text-[#51B1A6] font-medium flex items-center gap-1">Lihat Semua <ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Flash Sale</h2>
            <div className="flex gap-1">
              {['Semua', 'Smartphone', 'Laptop', 'Audio'].map((t, i) => (
                <button key={t} className={`px-3 py-1 text-xs font-medium rounded-full ${i === 0 ? 'bg-[#51B1A6] text-white' : 'bg-slate-100 text-slate-600'}`}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <hr className="border-slate-200 max-w-7xl mx-auto" />

      {/* 30. Footer */}
      <section id="footer" className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-lg font-bold text-slate-800 mb-1">30. Footer (Dark)</h2>
        <p className="text-sm text-slate-500 mb-6">Footer lengkap dengan info, kategori, layanan, kontak, payment, kurir</p>
        <div className="rounded-xl overflow-hidden shadow-lg">
          <footer className="bg-slate-800 text-white">
            <div className="px-6 lg:px-10 py-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div>
                  <h3 className="text-xl font-bold mb-4">Next<span className="text-[#51B1A6]">Elektronik</span></h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">Toko elektronik online terpercaya. Gadget, laptop, audio & aksesoris dengan garansi resmi.</p>
                  <div className="flex gap-2">{[Instagram, Facebook, Youtube].map((Icon, i) => <button key={i} className="p-2 bg-slate-700 hover:bg-[#51B1A6] rounded-lg transition"><Icon className="w-4 h-4" /></button>)}</div>
                </div>
                <div>
                  <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-slate-300">Kategori</h4>
                  <ul className="space-y-2.5 text-slate-400 text-sm">{['Smartphone & Tablet', 'Laptop & Komputer', 'Audio & Headphone', 'Wearable & Smartwatch', 'Aksesoris Gadget'].map((item) => <li key={item}><a href="#" className="hover:text-[#51B1A6] transition flex items-center gap-1"><ChevronRight className="w-3 h-3" /> {item}</a></li>)}</ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-slate-300">Layanan</h4>
                  <ul className="space-y-2.5 text-slate-400 text-sm">{['Cara Belanja', 'Metode Pembayaran', 'Pengiriman', 'Pengembalian', 'FAQ'].map((item) => <li key={item}><a href="#" className="hover:text-[#51B1A6] transition flex items-center gap-1"><ChevronRight className="w-3 h-3" /> {item}</a></li>)}</ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-slate-300">Hubungi Kami</h4>
                  <ul className="space-y-3 text-slate-400 text-sm">
                    <li className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 text-[#51B1A6] flex-shrink-0" /><span>Jl. Mangga Dua Raya No. 1, Jakarta Utara 14430</span></li>
                    <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#51B1A6]" /><span>0812-3456-7890</span></li>
                    <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#51B1A6]" /><span>hello@nextelektronik.com</span></li>
                    <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-[#51B1A6]" /><span>Senin - Sabtu, 09:00 - 21:00</span></li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-700 px-6 lg:px-10 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-slate-400"><span>Pembayaran:</span><div className="flex gap-1.5">{['BCA', 'BNI', 'BRI', 'Mandiri', 'QRIS', 'OVO', 'DANA'].map((m) => <span key={m} className="px-2 py-0.5 bg-slate-700 rounded text-[10px] font-medium text-slate-300">{m}</span>)}</div></div>
                <div className="flex items-center gap-2 text-xs text-slate-400"><span>Pengiriman:</span><div className="flex gap-1.5">{['JNE', 'SiCepat', 'J&T', 'Anteraja', 'TIKI'].map((c) => <span key={c} className="px-2 py-0.5 bg-slate-700 rounded text-[10px] font-medium text-slate-300">{c}</span>)}</div></div>
              </div>
            </div>
            <div className="border-t border-slate-700 px-6 lg:px-10 py-4 text-center text-xs text-slate-500">© 2026 NextElektronik. FIC Batch 24 - JagoFlutter Academy</div>
          </footer>
        </div>
      </section>

      <div className="h-20" />
    </div>
  );
}
