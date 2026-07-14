'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Grid3x3, ShoppingCart, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  cartCount: number;
  isLoggedIn: boolean;
}

const NAV_ITEMS = [
  { href: '/', icon: Home, label: 'Beranda' },
  { href: '/categories', icon: Grid3x3, label: 'Kategori' },
  { href: '/cart', icon: ShoppingCart, label: 'Keranjang', badge: true },
  { href: '/account', icon: User, label: 'Saya' },
];

export function BottomNav({ cartCount, isLoggedIn }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border safe-area-pb">
      <div className="grid grid-cols-4 h-14">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);
          const href = item.href === '/account' && !isLoggedIn ? '/login' : item.href;

          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 transition-colors relative',
                isActive ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <div className="relative">
                <item.icon className={cn('w-5 h-5', isActive && 'stroke-[2.5px]')} />
                {item.badge && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-primary text-primary-foreground text-[9px] rounded-full flex items-center justify-center font-bold px-0.5 leading-none">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
