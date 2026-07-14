'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Star, Coins, Tag, Package, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCOUNT_LINKS = [
  { href: '/account', icon: User, label: 'Ringkasan' },
  { href: '/account/profile', icon: User, label: 'Profil Saya' },
  { href: '/account/membership', icon: Star, label: 'Membership' },
  { href: '/account/points', icon: Coins, label: 'Poin Saya' },
  { href: '/account/vouchers', icon: Tag, label: 'Voucher' },
  { href: '/orders', icon: Package, label: 'Pesanan Saya' },
  { href: '/addresses', icon: MapPin, label: 'Alamat Saya' },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {ACCOUNT_LINKS.map((item) => {
        const isActive =
          item.href === '/account'
            ? pathname === '/account'
            : pathname === item.href;

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
