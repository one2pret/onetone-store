// components/admin/AdminSearchBar.tsx
'use client';

import { useState, useRef, useEffect, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, Tag, LayoutDashboard, Image as ImageIcon, ShoppingCart, Settings, FolderOpen, Loader2 } from 'lucide-react';
import { searchAdmin, type SearchResultItem } from '@/app/actions/search';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Dashboard',  href: '/dashboard',            icon: LayoutDashboard },
  { label: 'Banner',     href: '/dashboard/banners',    icon: ImageIcon },
  { label: 'Produk',     href: '/dashboard/products',   icon: Package },
  { label: 'Kategori',   href: '/dashboard/categories', icon: FolderOpen },
  { label: 'Pesanan',    href: '/dashboard/orders',     icon: ShoppingCart },
  { label: 'Pengaturan', href: '/dashboard/settings',   icon: Settings },
];

function highlight(text: string, query: string) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/30 text-primary rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function AdminSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [dbResults, setDbResults] = useState<SearchResultItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter nav items berdasarkan query
  const filteredNav = query.length >= 1
    ? NAV_ITEMS.filter(n => n.label.toLowerCase().includes(query.toLowerCase()))
    : [];

  // Semua hasil gabungan untuk keyboard nav
  const allResults = [
    ...filteredNav.map(n => ({ type: 'nav' as const, label: n.label, href: n.href, icon: n.icon })),
    ...dbResults.map(r => ({ type: r.type, label: r.label, href: r.href, sublabel: r.sublabel, icon: r.type === 'product' ? Package : Tag })),
  ];

  // Debounced DB search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setDbResults([]); return; }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchAdmin(query);
        setDbResults(res);
      });
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Reset active index saat hasil berubah
  useEffect(() => { setActiveIndex(0); }, [allResults.length]);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    function handleGlobal(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', handleGlobal);
    return () => window.removeEventListener('keydown', handleGlobal);
  }, []);

  // Click outside tutup dropdown
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function handleNavigate(href: string) {
    router.push(href);
    setQuery('');
    setOpen(false);
    setDbResults([]);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allResults[activeIndex]) handleNavigate(allResults[activeIndex].href);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  }

  const showDropdown = open && query.length >= 1;
  const isEmpty = allResults.length === 0 && !isPending;

  return (
    <div className="relative">
      {/* Input */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 bg-input border rounded-lg w-64 transition-all',
        open ? 'border-primary/60 ring-1 ring-primary/20' : 'border-border',
        'focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20'
      )}>
        {isPending
          ? <Loader2 className="w-4 h-4 text-muted-foreground flex-shrink-0 animate-spin" />
          : <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Cari menu, produk..."
          className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-full"
        />
        {/* Shortcut hint */}
        {!query && (
          <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted border border-border rounded shrink-0">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 mt-2 w-80 bg-popover border border-border rounded-xl shadow-2xl shadow-black/30 z-50 overflow-hidden animate-fadeIn"
        >
          {isPending && allResults.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Mencari...
            </div>
          )}

          {isEmpty && query.length >= 2 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Tidak ada hasil untuk &ldquo;<span className="text-foreground font-medium">{query}</span>&rdquo;
            </div>
          )}

          {/* Hasil nav */}
          {filteredNav.length > 0 && (
            <div>
              <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Menu</p>
              {filteredNav.map((item, i) => {
                const globalIdx = i;
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onClick={() => handleNavigate(item.href)}
                    onMouseEnter={() => setActiveIndex(globalIdx)}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2 text-sm transition-colors text-left',
                      activeIndex === globalIdx ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'
                    )}
                  >
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span>{highlight(item.label, query)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Hasil produk */}
          {dbResults.filter(r => r.type === 'product').length > 0 && (
            <div>
              <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Produk</p>
              {dbResults.filter(r => r.type === 'product').map((item, i) => {
                const globalIdx = filteredNav.length + i;
                return (
                  <button
                    key={item.href}
                    onClick={() => handleNavigate(item.href)}
                    onMouseEnter={() => setActiveIndex(globalIdx)}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2 text-sm transition-colors text-left',
                      activeIndex === globalIdx ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'
                    )}
                  >
                    <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate">{highlight(item.label, query)}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">{item.sublabel}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Hasil kategori */}
          {dbResults.filter(r => r.type === 'category').length > 0 && (
            <div>
              <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Kategori</p>
              {dbResults.filter(r => r.type === 'category').map((item, i) => {
                const globalIdx = filteredNav.length + dbResults.filter(r => r.type === 'product').length + i;
                return (
                  <button
                    key={item.href}
                    onClick={() => handleNavigate(item.href)}
                    onMouseEnter={() => setActiveIndex(globalIdx)}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2 text-sm transition-colors text-left',
                      activeIndex === globalIdx ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'
                    )}
                  >
                    <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate">{highlight(item.label, query)}</p>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">{item.sublabel}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer hint */}
          {allResults.length > 0 && (
            <div className="border-t border-border px-3 py-2 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span><kbd className="bg-muted border border-border rounded px-1">↑↓</kbd> navigasi</span>
              <span><kbd className="bg-muted border border-border rounded px-1">Enter</kbd> buka</span>
              <span><kbd className="bg-muted border border-border rounded px-1">Esc</kbd> tutup</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
