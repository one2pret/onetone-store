'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Link2, Receipt, Wallet, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/affiliate/dashboard', icon: LayoutDashboard, label: 'Ringkasan' },
  { href: '/affiliate/dashboard/links', icon: Link2, label: 'Link Saya' },
  { href: '/affiliate/dashboard/commissions', icon: Receipt, label: 'Komisi' },
  { href: '/affiliate/dashboard/payouts', icon: Wallet, label: 'Penarikan' },
  { href: '/affiliate/dashboard/settings', icon: Settings, label: 'Pengaturan' },
];

export function AffiliateDashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {NAV_LINKS.map((item) => {
        const isActive = item.href === '/affiliate/dashboard'
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + '/');

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
