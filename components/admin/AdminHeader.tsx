// components/admin/AdminHeader.tsx
'use client';

import { LogOut, User, Bell, ChevronDown, LayoutDashboard, Search } from 'lucide-react';
import { adminLogout } from '@/app/actions/auth';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { MobileMenuButton } from './AdminSidebar';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/banners': 'Banner',
  '/dashboard/products': 'Produk',
  '/dashboard/categories': 'Kategori',
  '/dashboard/orders': 'Pesanan',
  '/dashboard/settings': 'Pengaturan',
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname.startsWith(path)) return title;
  }
  return 'Dashboard';
}

interface Props {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
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
      <header className="sticky top-0 z-40 h-16 bg-white border-b border-slate-200/60 flex items-center justify-between px-4 md:px-6 shadow-sm">
        {/* Left — mobile menu + title + search */}
        <div className="flex items-center gap-2 md:gap-3">
          <MobileMenuButton />
          <h2 className="text-sm font-semibold text-slate-700 lg:hidden">{getPageTitle(pathname)}</h2>
          <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg w-64">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari menu, produk..."
              className="bg-transparent text-sm text-slate-600 placeholder:text-slate-400 outline-none w-full"
            />
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2.5 p-1.5 pr-3 rounded-lg hover:bg-slate-50 transition"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                {getInitials(user.name)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-slate-700 leading-tight">{user.name}</p>
                <p className="text-[11px] text-slate-400 leading-tight capitalize">{user.role}</p>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-slate-400 transition-transform', menuOpen && 'rotate-180')} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-700">{user.name}</p>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setLogoutDialogOpen(true);
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition"
                >
                  <LogOut className="w-4 h-4" />
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Logout dialog */}
      {logoutDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setLogoutDialogOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <LogOut className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Keluar dari Admin?</h3>
              <p className="text-sm text-slate-500 mb-6">Kamu akan keluar dari panel admin.</p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setLogoutDialogOpen(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  Batal
                </button>
                <form action={adminLogout} className="flex-1">
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
