// components/shop/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingCart, User, Search, Menu, X, LogOut,
  Heart, Package, ChevronDown, ShoppingBag,
  LayoutDashboard, AlertTriangle, MapPin,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { logout } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

interface Category {
  id: number;
  slug: string;
  name: string;
}

interface NavbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
  cartCount: number;
  categories?: Category[];
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Navbar({ user, cartCount, categories = [] }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="sticky top-0 z-50">
        {/* ── Main Nav ── */}
        <div className="bg-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <Link href="/" className="text-xl font-bold text-white shrink-0">
                Next<span className="text-primary">Elektronik</span>
              </Link>

              {/* Category dropdown button — desktop */}
              <button className="hidden lg:flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2.5 rounded-lg transition">
                <Package className="w-4 h-4" />
                Kategori
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Search bar */}
              <div className="flex-1 max-w-2xl relative hidden md:block">
                <input
                  type="text"
                  placeholder="Cari produk, merek, atau kategori..."
                  className="w-full pl-4 pr-12 py-2.5 bg-white rounded-lg text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <button className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary-hover text-white p-2 rounded-md transition">
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {/* Right icons */}
              <div className="flex items-center gap-0.5 ml-auto md:ml-0">
                {/* Wishlist */}
                <button className="relative p-2.5 text-slate-300 hover:text-white rounded-lg transition hidden sm:block">
                  <Heart className="w-5 h-5" />
                </button>

                {/* Cart */}
                <Link href="/cart" className="relative p-2.5 text-slate-300 hover:text-white rounded-lg transition">
                  <ShoppingCart className="w-5 h-5" />
                  {cartCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold px-1">
                      {cartCount}
                    </span>
                  )}
                </Link>

                {/* User / Auth */}
                {user ? (
                  <div className="hidden md:block relative" ref={userMenuRef}>
                    {/* Avatar button */}
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-700 transition"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                        {getInitials(user.name)}
                      </div>
                      <div className="text-left hidden lg:block">
                        <p className="text-sm text-white font-medium leading-tight max-w-[120px] truncate">
                          {user.name}
                        </p>
                        <p className="text-[11px] text-slate-400 leading-tight">
                          {user.role === 'admin' ? 'Administrator' : 'Customer'}
                        </p>
                      </div>
                      <ChevronDown className={cn(
                        'w-4 h-4 text-slate-400 transition-transform duration-200',
                        userMenuOpen && 'rotate-180'
                      )} />
                    </button>

                    {/* Dropdown menu */}
                    {userMenuOpen && (
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                        {/* User info header */}
                        <div className="px-4 py-3 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
                              {getInitials(user.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
                              <p className="text-xs text-slate-500 truncate">{user.email}</p>
                            </div>
                          </div>
                          {user.role === 'admin' && (
                            <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-primary/10 text-primary text-[11px] font-medium rounded-full">
                              <LayoutDashboard className="w-3 h-3" />
                              Admin
                            </span>
                          )}
                        </div>

                        {/* Menu items */}
                        <div className="py-1">
                          {user.role === 'admin' && (
                            <Link
                              href="/dashboard"
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                            >
                              <LayoutDashboard className="w-4 h-4 text-slate-400" />
                              Dashboard
                            </Link>
                          )}
                          <Link
                            href="/orders"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                          >
                            <ShoppingBag className="w-4 h-4 text-slate-400" />
                            Pesanan Saya
                          </Link>
                          <Link
                            href="/addresses"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
                          >
                            <MapPin className="w-4 h-4 text-slate-400" />
                            Alamat Saya
                          </Link>
                        </div>

                        {/* Logout */}
                        <div className="border-t border-slate-100 pt-1">
                          <button
                            onClick={() => {
                              setUserMenuOpen(false);
                              setLogoutDialogOpen(true);
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                          >
                            <LogOut className="w-4 h-4" />
                            Keluar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="hidden md:flex items-center gap-2 ml-2">
                    <Link href="/login" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white transition">
                      <User className="w-5 h-5" />
                      Masuk
                    </Link>
                    <Link href="/register" className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg transition font-medium">
                      Daftar
                    </Link>
                  </div>
                )}

                {/* Mobile menu toggle */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2.5 text-slate-300 hover:text-white"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Category Bar ── */}
        <div className="bg-slate-700 hidden md:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-6 overflow-x-auto text-sm">
            <Link
              href="/products"
              className={cn(
                'whitespace-nowrap py-1 transition',
                pathname === '/products' && !pathname.includes('?')
                  ? 'text-primary font-semibold'
                  : 'text-slate-300 hover:text-white'
              )}
            >
              Semua Produk
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                className={cn(
                  'whitespace-nowrap py-1 transition',
                  'text-slate-300 hover:text-white'
                )}
              >
                {cat.name}
              </Link>
            ))}
            <Link
              href="/products"
              className="whitespace-nowrap py-1 text-primary font-semibold hover:text-primary-hover transition"
            >
              Promo
            </Link>
          </div>
        </div>

        {/* ── Mobile Menu ── */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-800 border-t border-slate-700">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-3">
              {/* Mobile search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari produk..."
                  className="w-full pl-4 pr-12 py-2.5 bg-slate-700 text-white rounded-lg text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <button className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary text-white p-2 rounded-md">
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile categories */}
              <div className="flex gap-2 flex-wrap">
                <Link href="/products" className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs rounded-full hover:text-white">
                  Semua
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/products?category=${cat.slug}`}
                    className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs rounded-full hover:text-white"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>

              <div className="border-t border-slate-700 pt-3">
                {user ? (
                  <div className="space-y-1">
                    {/* Mobile user info */}
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {getInitials(user.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium truncate">{user.name}</p>
                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    {user.role === 'admin' && (
                      <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm text-primary font-medium" onClick={() => setMobileMenuOpen(false)}>
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                      </Link>
                    )}
                    <Link href="/orders" className="flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                      <ShoppingBag className="w-4 h-4" />
                      Pesanan Saya
                    </Link>
                    <Link href="/addresses" className="flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                      <MapPin className="w-4 h-4" />
                      Alamat Saya
                    </Link>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setLogoutDialogOpen(true);
                      }}
                      className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300"
                    >
                      <LogOut className="w-4 h-4" />
                      Keluar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Link href="/login" className="flex-1 py-2.5 text-center text-sm text-white border border-slate-600 rounded-lg hover:bg-slate-700" onClick={() => setMobileMenuOpen(false)}>
                      Masuk
                    </Link>
                    <Link href="/register" className="flex-1 py-2.5 text-center text-sm bg-primary text-white rounded-lg hover:bg-primary-hover font-medium" onClick={() => setMobileMenuOpen(false)}>
                      Daftar
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── Logout Confirmation Dialog ── */}
      {logoutDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setLogoutDialogOpen(false)}
          />
          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                Keluar dari Akun?
              </h3>
              <p className="text-sm text-slate-500 mb-6">
                Kamu akan keluar dari akun dan perlu login kembali untuk mengakses fitur yang memerlukan autentikasi.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setLogoutDialogOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Batal
                </button>
                <form action={logout} className="flex-1">
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Ya, Keluar
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
