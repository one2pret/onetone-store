// components/admin/AdminHeader.tsx
'use client';

import { LogOut, Bell, ChevronDown, Search } from 'lucide-react';
import { adminLogout } from '@/app/actions/auth';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MobileMenuButton } from './AdminSidebar';

const pageTitles: Record<string, string> = {
  '/dashboard':             'Dashboard',
  '/dashboard/banners':     'Banner',
  '/dashboard/products':    'Produk',
  '/dashboard/categories':  'Kategori',
  '/dashboard/orders':      'Pesanan',
  '/dashboard/settings':    'Pengaturan',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path)) return title;
  }
  return 'Dashboard';
}

interface Props {
  user: { name?: string | null; email?: string | null; role?: string };
}

function getInitials(name?: string | null): string {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function AdminHeader({ user }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      {/* ── Header Bar ── */}
      <header className="sticky top-0 z-40 h-16 bg-card border-b border-border
                         flex items-center justify-between px-4 md:px-6">
        {/* Left */}
        <div className="flex items-center gap-2 md:gap-3">
          <MobileMenuButton />
          <h2 className="text-sm font-semibold text-foreground lg:hidden">
            {getPageTitle(pathname)}
          </h2>
          {/* Search */}
          <div className="hidden md:flex items-center gap-2 px-3 py-2
                          bg-input border border-border rounded-lg w-64
                          focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20
                          transition-all">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              placeholder="Cari menu, produk..."
              className="bg-transparent text-sm text-foreground
                         placeholder:text-muted-foreground outline-none w-full"
            />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5">
          {/* Notification Bell */}
          <button className="relative p-2 text-muted-foreground hover:text-foreground
                             hover:bg-accent rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
          </button>

          {/* User Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2.5 p-1.5 pr-3 rounded-lg
                         hover:bg-accent transition-colors"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20
                              flex items-center justify-center
                              text-primary text-xs font-bold">
                {getInitials(user.name)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-foreground leading-tight">
                  {user.name}
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight capitalize">
                  {user.role}
                </p>
              </div>
              <ChevronDown className={cn(
                'w-4 h-4 text-muted-foreground transition-transform',
                menuOpen && 'rotate-180'
              )} />
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-popover rounded-xl
                              shadow-xl shadow-black/20 border border-border
                              py-1.5 z-50 animate-fadeIn">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); setLogoutDialogOpen(true); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5
                             text-sm text-danger hover:bg-danger/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Logout Confirmation Dialog ── */}
      {logoutDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setLogoutDialogOpen(false)}
          />
          <div className="relative bg-card border border-border rounded-2xl
                          shadow-2xl shadow-black/40 w-full max-w-sm mx-4 p-6
                          animate-fadeInUp">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-danger/10 border border-danger/20
                              flex items-center justify-center mb-4">
                <LogOut className="w-6 h-6 text-danger" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">
                Keluar dari Admin?
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Kamu akan keluar dari panel admin.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setLogoutDialogOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium
                             text-foreground bg-secondary hover:bg-accent
                             border border-border rounded-xl transition-colors"
                >
                  Batal
                </button>
                <form action={adminLogout} className="flex-1">
                  <button
                    type="submit"
                    className="w-full px-4 py-2.5 text-sm font-medium
                               text-white bg-danger hover:bg-danger/90
                               rounded-xl transition-colors flex items-center justify-center gap-2"
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