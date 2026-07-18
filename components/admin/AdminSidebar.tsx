// components/admin/AdminSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingCart,
  FolderOpen, Image as ImageIcon, Settings,
  ExternalLink, X, Menu, Store, Calculator, Receipt, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const navigation = [
  { name: 'Dashboard',   href: '/dashboard',            icon: LayoutDashboard },
  { name: 'Kasir (POS)', href: '/pos',                  icon: Calculator },
  { name: 'Sesi POS',    href: '/dashboard/pos/sessions', icon: Receipt },
  { name: 'Banner',      href: '/dashboard/banners',    icon: ImageIcon },
  { name: 'Produk',      href: '/dashboard/products',   icon: Package },
  { name: 'Kategori',    href: '/dashboard/categories', icon: FolderOpen },
  { name: 'Pesanan',     href: '/dashboard/orders',     icon: ShoppingCart },
  { name: 'Member',      href: '/dashboard/members',    icon: Users },
  { name: 'Pengaturan',  href: '/dashboard/settings',   icon: Settings },
];

type SidebarContextType = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextType>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const pathname = usePathname();

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function MobileMenuButton() {
  const { toggle } = useSidebar();
  return (
    <button
      onClick={toggle}
      className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
      aria-label="Toggle menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/30">
            <Store className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground leading-tight animate-gold-shimmer">
              Onetone
            </h1>
            <p className="text-[10px] text-muted-foreground leading-tight">Admin Panel</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <p className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Menu
        </p>
        <ul className="space-y-0.5">
          {navigation.map((item) => {
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className={cn(
                    'h-[18px] w-[18px]',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                  )} />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* View Store Link */}
      <div className="p-3 border-t border-border">
        <Link
          href="/"
          target="_blank"
          className="flex items-center justify-center gap-2 px-4 py-2.5
                     bg-accent text-accent-foreground hover:bg-primary/10 hover:text-primary
                     rounded-lg transition-colors text-xs font-medium border border-border
                     hover:border-primary/30"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Lihat Toko
        </Link>
      </div>
    </>
  );
}

export function AdminSidebar() {
  const { open, setOpen } = useSidebar();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-[250px] bg-surface border-r border-border hidden lg:flex flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[280px] bg-surface border-r border-border flex flex-col lg:hidden transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarContent onClose={() => setOpen(false)} />
      </aside>
    </>
  );
}