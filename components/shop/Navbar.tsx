// components/shop/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingCart, User, Search, Menu, X, LogOut,
  Heart, ShoppingBag, ChevronDown,
  LayoutDashboard, AlertTriangle, MapPin,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { logout } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

// Toggle search: set true saat backend search endpoint sudah siap.
// Bisa juga override via env: NEXT_PUBLIC_SEARCH_ENABLED=true
const SEARCH_ENABLED =
  process.env.NEXT_PUBLIC_SEARCH_ENABLED === 'true';

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

// Top-nav (kiri): brand/utility, bukan taxonomy produk (taxonomy tetap di category bar bawah).
const TOP_NAV_LINKS: Array<{ href: string; label: string; accent?: boolean }> = [
  { href: '/products?sort=newest', label: 'New In' },
  { href: '/products?promo=true', label: 'Promo', accent: true },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  }, [pathname]);

  // Actions block dipakai di dua layout branch (search-enabled dan boutique-wordmark)
  const actionsBlock = (
    <div className="flex items-center gap-0.5 justify-end">
      {/* Wishlist */}
      <button
        aria-label="Wishlist"
        className="relative p-2.5 text-foreground hover:text-primary rounded-lg transition hidden sm:block"
      >
        <Heart className="w-5 h-5" />
      </button>

      {/* Cart */}
      <Link
        href="/cart"
        aria-label={`Keranjang${cartCount > 0 ? ` (${cartCount})` : ''}`}
        className="relative p-2.5 text-foreground hover:text-primary rounded-lg transition"
      >
        <ShoppingCart className="w-5 h-5" />
        {cartCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center font-bold px-1">
            {cartCount}
          </span>
        )}
      </Link>

      {/* User / Auth */}
      {user ? (
        <div className="hidden md:block relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg hover:bg-accent transition"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
              {getInitials(user.name)}
            </div>
            <div className="text-left hidden lg:block">
              <p className="text-sm text-foreground font-medium leading-tight max-w-[120px] truncate">
                {user.name}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {user.role === 'admin' ? 'Administrator' : 'Customer'}
              </p>
            </div>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-muted-foreground transition-transform duration-200',
                userMenuOpen && 'rotate-180'
              )}
            />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-card rounded-xl shadow-xl border border-border py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
                    {getInitials(user.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                {user.role === 'admin' && (
                  <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-primary-light text-primary text-[11px] font-medium rounded-full">
                    <LayoutDashboard className="w-3 h-3" />
                    Admin
                  </span>
                )}
              </div>
              <div className="py-1">
                {user.role === 'admin' && (
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition"
                  >
                    <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                    Dashboard
                  </Link>
                )}
                <Link
                  href="/orders"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition"
                >
                  <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                  Pesanan Saya
                </Link>
                <Link
                  href="/addresses"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition"
                >
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  Alamat Saya
                </Link>
              </div>
              <div className="border-t border-border pt-1">
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    setLogoutDialogOpen(true);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition"
                >
                  <LogOut className="w-4 h-4" />
                  Keluar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden md:flex items-center gap-2 ml-1">
          <Link
            href="/login"
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground border border-border rounded-lg hover:text-primary hover:border-primary transition"
          >
            <User className="w-4 h-4" />
            Masuk
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg transition font-medium"
          >
            Daftar
          </Link>
        </div>
      )}

      {/* Mobile menu toggle — hanya saat SEARCH_ENABLED (waktu disabled, hamburger di kiri) */}
      {SEARCH_ENABLED && (
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
          className="md:hidden p-2.5 text-foreground hover:text-primary"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      )}
    </div>
  );

  return (
    <>
      <header className="sticky top-0 z-50">
        {/* ── Main Nav ── */}
        <div className="bg-background border-b border-border/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 md:py-3">
            {/*
              LAYOUT
              ─────────────────────────────────────────────────────
              SEARCH_ENABLED = true  : logo kiri, search tengah, actions kanan (grid 3-col)
              SEARCH_ENABLED = false : boutique wordmark — flex justify-between +
                                       logo absolute centered ke viewport.
                                       Kiri: hamburger mobile + top-nav desktop.
                                       Kanan: actions.
              ─────────────────────────────────────────────────────
            */}
            {SEARCH_ENABLED ? (
              <div className="grid items-center gap-4 grid-cols-[auto_1fr_auto]">
                {/* Kolom 1: Logo */}
                <Link
                  href="/"
                  className="shrink-0 text-xl font-bold tracking-widest uppercase"
                >
                  <span className="animate-gold-shimmer">ONETONE</span>
                </Link>

                {/* Kolom 2: Search */}
                <div className="relative hidden md:block">
                  <input
                    type="text"
                    placeholder="Cari koleksi, brand, atau gaya..."
                    className="w-full pl-4 pr-12 py-2.5 bg-input border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                  />
                  <button className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary-hover text-primary-foreground p-2 rounded-md transition">
                    <Search className="w-4 h-4" />
                  </button>
                </div>
                <div className="md:hidden" />

                {/* Kolom 3: Actions */}
                {actionsBlock}
              </div>
            ) : (
              <div className="relative flex items-center justify-between gap-4">
                {/* Kiri: hamburger mobile + top-nav desktop */}
                <div className="flex items-center">
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
                    className="md:hidden -ml-1.5 p-2.5 text-foreground hover:text-primary transition"
                  >
                    {mobileMenuOpen ? (
                      <X className="w-5 h-5" />
                    ) : (
                      <Menu className="w-5 h-5" />
                    )}
                  </button>

                  <nav
                    aria-label="Menu utama"
                    className="hidden md:flex items-center gap-5 lg:gap-7"
                  >
                    {TOP_NAV_LINKS.map((link) => {
                      const basePath = link.href.split('?')[0];
                      const isActive = pathname === basePath;
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={cn(
                            'text-[13px] font-medium tracking-wide transition whitespace-nowrap',
                            link.accent
                              ? 'text-primary hover:text-primary-hover'
                              : isActive
                                ? 'text-foreground'
                                : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {link.label}
                        </Link>
                      );
                    })}
                  </nav>
                </div>

                {/* Center: logo absolute — jamin true center ke viewport */}
                <Link
                  href="/"
                  aria-label="Onetone — kembali ke beranda"
                  className="absolute left-1/2 -translate-x-1/2 text-xl md:text-2xl font-bold tracking-[0.28em] md:tracking-[0.32em] uppercase leading-none"
                >
                  <span className="animate-gold-shimmer">ONETONE</span>
                </Link>

                {/* Kanan: actions */}
                {actionsBlock}
              </div>
            )}
          </div>
        </div>

        {/* ── Category Bar ── */}
        <div className="bg-card hidden md:block border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-6 overflow-x-auto text-sm">
            <Link
              href="/products"
              className={cn(
                'whitespace-nowrap py-1 transition',
                pathname === '/products' && !pathname.includes('?')
                  ? 'text-primary font-semibold'
                  : 'text-foreground hover:text-primary'
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
                  pathname.includes(cat.slug)
                    ? 'text-primary font-semibold'
                    : 'text-foreground hover:text-primary'
                )}
              >
                {cat.name}
              </Link>
            ))}
            <Link
              href="/products?promo=true"
              className="whitespace-nowrap py-1 text-primary font-semibold hover:text-primary-hover transition"
            >
              Promo
            </Link>
          </div>
        </div>

        {/* ── Mobile Menu ── */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-card border-t border-border">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-3">
              {SEARCH_ENABLED && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cari koleksi, brand, atau gaya..."
                    className="w-full pl-4 pr-12 py-2.5 bg-input border border-border text-foreground rounded-lg text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                  />
                  <button className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground p-2 rounded-md">
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Top-nav links (mirror desktop nav kiri) */}
              {!SEARCH_ENABLED && (
                <nav aria-label="Menu utama" className="flex flex-col divide-y divide-border">
                  {TOP_NAV_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'py-3 text-sm font-medium transition',
                        link.accent ? 'text-primary' : 'text-foreground hover:text-primary'
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              )}

              <div className="flex gap-2 flex-wrap pt-2">
                <Link
                  href="/products"
                  className="px-3 py-1.5 bg-secondary text-foreground text-xs rounded-full hover:text-primary"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Semua
                </Link>
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/products?category=${cat.slug}`}
                    className="px-3 py-1.5 bg-secondary text-foreground text-xs rounded-full hover:text-primary"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
              <div className="border-t border-border pt-3">
                {user ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0">
                        {getInitials(user.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-foreground font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    {user.role === 'admin' && (
                      <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 text-sm text-primary font-medium hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>
                        <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                        Dashboard
                      </Link>
                    )}
                    <Link href="/orders" className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>
                      <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                      Pesanan Saya
                    </Link>
                    <Link href="/addresses" className="flex items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-accent" onClick={() => setMobileMenuOpen(false)}>
                      <MapPin className="w-4 h-4" />
                      Alamat Saya
                    </Link>
                    <button
                      onClick={() => { setMobileMenuOpen(false); setLogoutDialogOpen(true); }}
                      className="flex items-center gap-3 w-full px-3 py-2 text-sm text-destructive hover:text-destructive/80"
                    >
                      <LogOut className="w-4 h-4" />
                      Keluar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Link href="/login" className="flex-1 py-2.5 text-center text-sm text-foreground border border-border rounded-lg hover:bg-accent hover:text-primary" onClick={() => setMobileMenuOpen(false)}>
                      Masuk
                    </Link>
                    <Link href="/register" className="flex-1 py-2.5 text-center text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover font-medium" onClick={() => setMobileMenuOpen(false)}>
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
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setLogoutDialogOpen(false)}
          />
          <div className="relative bg-card rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">Keluar dari Akun?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Kamu akan keluar dari akun dan perlu login kembali untuk mengakses fitur yang memerlukan autentikasi.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setLogoutDialogOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded-xl transition"
                >
                  Batal
                </button>
                <form action={logout} className="flex-1">
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 text-sm font-medium text-primary-foreground bg-destructive hover:bg-destructive/80 rounded-xl transition flex items-center justify-center gap-2"
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
