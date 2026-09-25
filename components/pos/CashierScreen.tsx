"use client";

// components/pos/CashierScreen.tsx
// Layar kasir utama: katalog produk + cart + checkout.
// Mode: 'catalog' (default) → 'payment' → 'receipt'.
// Mobile-first: cart sebagai bottom sheet, tap "Bayar" buka payment overlay.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, ScanBarcode, ShoppingBag, X, Plus, Minus, Trash2, LogOut, ChevronUp, Printer, History } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import {
  appendBarcodeCharacter,
  consumeBarcodeBuffer,
  EMPTY_BARCODE_BUFFER,
} from "@/lib/pos-barcode-scanner";
import { PaymentSheet } from "./PaymentSheet";
import { ReceiptView } from "./ReceiptView";
import type { PosSession } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type PosVariant = {
  id: number;
  size: string;
  color: string;
  colorHex: string | null;
  stock: number;
  priceModifier: string | null;
  isActive: boolean | null;
  sku: string | null;
  posLabel: string | null;
  barcodes: { code: string }[];
};

export type PosProduct = {
  id: number;
  name: string;
  posName: string | null;
  slug: string;
  price: string;
  stock: number | null;
  image: string | null;
  category: { id: number; name: string; slug: string } | null;
  variants: PosVariant[];
  barcodes: { code: string; variantId: number | null }[];
};

export type CartLine = {
  key: string;
  productId: number;
  variantId?: number;
  productName: string;
  variantLabel?: string | null;
  image?: string | null;
  unitPrice: number;
  quantity: number;
  maxStock: number;
};

type RecentOrder = {
  id: number;
  orderNumber: string;
  total: string;
  posPaymentMethod: "cash" | "qris" | "transfer" | null;
  createdAt: Date | null;
};

interface Props {
  session: PosSession;
  products: PosProduct[];
  recentOrders: RecentOrder[];
  qrisUrl: string | null;
  receiptFooter: string | null;
  cashierName?: string;
  locationName?: string;
  maxDiscountPercent: number;
  storeName?: string | null;
  storePhone?: string | null;
  storeAddress?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CashierScreen({ session, products, recentOrders, qrisUrl, receiptFooter, cashierName, locationName, maxDiscountPercent, storeName, storePhone, storeAddress }: Props) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false); // mobile bottom sheet
  const [variantPickerFor, setVariantPickerFor] = useState<PosProduct | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [receiptOrderId, setReceiptOrderId] = useState<number | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.category) map.set(p.category.slug, p.category.name);
    }
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const searchable = [
        p.name,
        p.posName,
        ...p.barcodes.map(barcode => barcode.code),
        ...p.variants.flatMap(variant => [variant.sku, variant.posLabel, variant.size, variant.color, ...variant.barcodes.map(barcode => barcode.code)]),
      ].filter(Boolean).join(" ").toLowerCase();
      const matchSearch = !q || searchable.includes(q);
      const matchCat = !categoryFilter || p.category?.slug === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [products, search, categoryFilter]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [cart]
  );
  const cartQty = useMemo(() => cart.reduce((sum, l) => sum + l.quantity, 0), [cart]);

  // ── Cart operations ─────────────────────────────────────────────────────────

  const addToCart = useCallback((product: PosProduct, variant?: PosVariant) => {
    // Kalau produk ada varian tapi belum dipilih → buka picker
    if (product.variants.length > 0 && !variant) {
      setVariantPickerFor(product);
      return;
    }

    const base = Number(product.price);
    const modifier = Number(variant?.priceModifier ?? 0);
    const unitPrice = base + modifier;
    const key = variant ? `${product.id}-${variant.id}` : `${product.id}`;
    const maxStock = variant ? variant.stock : product.stock ?? 0;

    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        if (existing.quantity + 1 > maxStock) {
          toast.error(`Stok tidak cukup (${maxStock})`);
          return prev;
        }
        return prev.map((l) =>
          l.key === key ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      if (maxStock < 1) {
        toast.error("Stok habis");
        return prev;
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          variantId: variant?.id,
          productName: product.posName?.trim() || product.name,
          variantLabel: variant ? (variant.posLabel?.trim() || `${variant.size} / ${variant.color}`) : null,
          image: product.image,
          unitPrice,
          quantity: 1,
          maxStock,
        },
      ];
    });
    setVariantPickerFor(null);
  }, []);

  const barcodeTargets = useMemo(() => {
    const targets = new Map<string, { product: PosProduct; variant?: PosVariant }>();

    for (const product of products) {
      for (const barcode of product.barcodes) {
        const variant = barcode.variantId === null
          ? undefined
          : product.variants.find(item => item.id === barcode.variantId);
        if (barcode.variantId === null || variant) targets.set(barcode.code, { product, variant });
      }
      for (const variant of product.variants) {
        for (const barcode of variant.barcodes) {
          targets.set(barcode.code, { product, variant });
        }
      }
    }

    return targets;
  }, [products]);

  const barcodeBuffer = useRef(EMPTY_BARCODE_BUFFER);

  useEffect(() => {
    if (paymentOpen || receiptOrderId !== null) {
      barcodeBuffer.current = EMPTY_BARCODE_BUFFER;
    }

    function handleScannerKey(event: KeyboardEvent) {
      if (
        paymentOpen ||
        receiptOrderId !== null ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing
      ) return;

      const timestamp = performance.now();
      if (event.key === "Enter") {
        const code = consumeBarcodeBuffer(barcodeBuffer.current, timestamp);
        barcodeBuffer.current = EMPTY_BARCODE_BUFFER;
        if (!code) return;

        event.preventDefault();
        const target = barcodeTargets.get(code);
        setSearch("");
        if (!target) {
          toast.error(`Barcode ${code} tidak ditemukan atau tidak aktif`);
          return;
        }

        addToCart(target.product, target.variant);
        return;
      }

      if (event.key.length === 1) {
        barcodeBuffer.current = appendBarcodeCharacter(barcodeBuffer.current, event.key, timestamp);
      }
    }

    window.addEventListener("keydown", handleScannerKey, true);
    return () => window.removeEventListener("keydown", handleScannerKey, true);
  }, [addToCart, barcodeTargets, paymentOpen, receiptOrderId]);

  function updateQty(key: string, delta: number) {
    setCart((prev) => {
      return prev
        .map((l) => {
          if (l.key !== key) return l;
          const next = l.quantity + delta;
          if (next > l.maxStock) {
            toast.error(`Stok maksimal ${l.maxStock}`);
            return l;
          }
          return { ...l, quantity: Math.max(0, next) };
        })
        .filter((l) => l.quantity > 0);
    });
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  function clearCart() {
    setCart([]);
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  function handleCheckout() {
    if (cart.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }
    setPaymentOpen(true);
    setCartOpen(false);
  }

  function handlePaymentSuccess(orderId: number) {
    setPaymentOpen(false);
    setReceiptOrderId(orderId);
    setCart([]);
    router.refresh(); // refresh recent orders + product stock
  }

  function handleCloseSessionClick() {
    if (cart.length > 0) {
      toast.error("Selesaikan atau kosongkan transaksi berjalan dulu");
      return;
    }
    router.push("/pos/close");
  }

  // ── Receipt overlay (setelah bayar sukses) ──────────────────────────────────

  if (receiptOrderId !== null) {
    return (
      <ReceiptView
        orderId={receiptOrderId}
        footer={receiptFooter}
        cashierName={cashierName}
        storeName={storeName}
        storePhone={storePhone}
        storeAddress={storeAddress}
        onDone={() => setReceiptOrderId(null)}
      />
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row w-full lg:h-svh lg:overflow-hidden">
      {/* ═══════ Kolom kiri: Katalog ═══════ */}
      <div className="flex flex-col lg:flex-1 lg:min-h-0 lg:h-svh lg:overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <h1 className="text-base font-bold text-slate-900">Kasir Onetone</h1>
              <p className="text-[11px] text-slate-500">
                Sesi #{session.id} • Modal: {formatRupiah(Number(session.openingCash))}
                {cashierName && (
                  <span className="ml-2 font-medium text-slate-700">· {cashierName}</span>
                )}
                {locationName && <span className="ml-2 font-medium text-primary">· {locationName}</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 lg:hidden"
              title="Riwayat transaksi sesi"
              aria-label="Buka riwayat transaksi sesi"
            >
              <History className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => window.open("/pos/test-print", "_blank", "noopener,noreferrer")}
              className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              title="Test print 58 mm"
              aria-label="Buka test print 58 mm"
            >
              <Printer className="h-5 w-5" />
            </button>
            <button
              onClick={handleCloseSessionClick}
              className="p-2 text-slate-600 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition"
              title="Tutup sesi kasir"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, SKU, atau barcode"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-100 border border-transparent rounded-lg outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
            <ScanBarcode className="h-3.5 w-3.5" aria-hidden="true" />
            Scanner siap · gunakan suffix Enter
          </p>

          {/* Category chips */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto mt-3 pb-1 -mx-4 px-4 scrollbar-hide">
              <CategoryChip active={!categoryFilter} onClick={() => setCategoryFilter("")}>
                Semua
              </CategoryChip>
              {categories.map((c) => (
                <CategoryChip
                  key={c.slug}
                  active={categoryFilter === c.slug}
                  onClick={() => setCategoryFilter(c.slug)}
                >
                  {c.name}
                </CategoryChip>
              ))}
            </div>
          )}
        </header>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 pb-32 lg:pb-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">
                {search || categoryFilter ? "Produk tidak ditemukan" : "Belum ada produk"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  // 8 gambar pertama (2 row grid) di-eager untuk optimal LCP
                  priority={index < 8}
                  onClick={() => addToCart(product)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════ Kolom kanan (desktop): Cart selalu tampil ═══════ */}
      <aside className="hidden lg:flex lg:flex-col lg:h-svh lg:w-[380px] xl:w-[420px] bg-white border-l border-slate-200 lg:min-h-0 lg:overflow-hidden">
        <CartPanel
          cart={cart}
          total={cartTotal}
          qty={cartQty}
          onUpdateQty={updateQty}
          onRemove={removeLine}
          onClear={clearCart}
          onCheckout={handleCheckout}
          recentOrders={recentOrders}
          onReprint={setReceiptOrderId}
        />
      </aside>

      {/* ═══════ Cart Bottom Bar (mobile) ═══════ */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
        {!cartOpen ? (
          <button
            onClick={() => setCartOpen(true)}
            disabled={cart.length === 0}
            className="w-full px-4 py-3.5 flex items-center justify-between disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingBag className="w-6 h-6 text-slate-700" />
                {cartQty > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                    {cartQty}
                  </span>
                )}
              </div>
              <div className="text-left">
                <p className="text-[11px] text-slate-500">
                  {cart.length} item • {cartQty} qty
                </p>
                <p className="text-sm font-bold text-slate-900">{formatRupiah(cartTotal)}</p>
              </div>
            </div>
            <ChevronUp className="w-5 h-5 text-slate-400" />
          </button>
        ) : null}
      </div>

      {/* ═══════ Cart Sheet (mobile) ═══════ */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <div
            className="flex-1 bg-black/40"
            onClick={() => setCartOpen(false)}
          />
          <div className="bg-white rounded-t-2xl h-[85svh] flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Keranjang ({cartQty})</h2>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <CartPanel
              cart={cart}
              total={cartTotal}
              qty={cartQty}
              onUpdateQty={updateQty}
              onRemove={removeLine}
              onClear={clearCart}
              onCheckout={handleCheckout}
              recentOrders={recentOrders}
              onReprint={setReceiptOrderId}
              compact
            />
          </div>
        </div>
      )}

      {/* ═══════ Variant Picker Sheet ═══════ */}
      {variantPickerFor && (
        <VariantPickerSheet
          product={variantPickerFor}
          onClose={() => setVariantPickerFor(null)}
          onPick={(variant) => addToCart(variantPickerFor, variant)}
        />
      )}

      {/* ═══════ Payment Sheet ═══════ */}
      {paymentOpen && (
        <PaymentSheet
          sessionId={session.id}
          cart={cart}
          total={cartTotal}
          maxDiscountPercent={maxDiscountPercent}
          qrisUrl={qrisUrl}
          onClose={() => setPaymentOpen(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap " +
        (active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200")
      }
    >
      {children}
    </button>
  );
}

function ProductCard({
  product,
  onClick,
  priority = false,
}: {
  product: PosProduct;
  onClick: () => void;
  priority?: boolean;
}) {
  const basePrice = Number(product.price);
  const hasVariants = product.variants.length > 0;
  const totalStock = hasVariants
    ? product.variants.reduce((s, v) => s + v.stock, 0)
    : product.stock ?? 0;
  const outOfStock = totalStock <= 0;
  const pricedVariants = product.variants.some(variant => variant.stock > 0)
    ? product.variants.filter(variant => variant.stock > 0)
    : product.variants;
  const variantPrices = pricedVariants.map(variant => basePrice + Number(variant.priceModifier ?? 0));
  const minPrice = variantPrices.length ? Math.min(...variantPrices) : basePrice;
  const maxPrice = variantPrices.length ? Math.max(...variantPrices) : basePrice;
  const priceLabel = minPrice === maxPrice ? formatRupiah(minPrice) : `Mulai ${formatRupiah(minPrice)}`;

  return (
    <button
      onClick={onClick}
      disabled={outOfStock}
      aria-label={`${product.posName?.trim() || product.name}, ${priceLabel}, stok ${totalStock}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-primary/30 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="aspect-square relative bg-slate-100">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.posName?.trim() || product.name}
            fill
            unoptimized
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-8 h-8 text-slate-300" />
          </div>
        )}
        {outOfStock && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-xs font-semibold text-rose-600 bg-white px-2 py-1 rounded shadow">
              Habis
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="text-xs font-medium text-slate-800 line-clamp-2 min-h-[2.4em]">
          {product.posName?.trim() || product.name}
        </p>
        <div className="mt-auto pt-2">
          <p className="whitespace-nowrap text-sm font-extrabold tabular-nums text-slate-950 sm:text-base">
            {priceLabel}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500">
            <span>{hasVariants ? `${product.variants.length} varian` : "Tanpa varian"}</span>
            <span className={outOfStock ? "font-semibold text-rose-600" : "font-medium text-slate-600"}>
              Stok {totalStock}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function VariantPickerSheet({
  product,
  onClose,
  onPick,
}: {
  product: PosProduct;
  onClose: () => void;
  onPick: (variant: PosVariant) => void;
}) {
  const base = Number(product.price);

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="bg-white rounded-t-2xl max-h-[80svh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-900">{product.posName?.trim() || product.name}</h2>
            <p className="text-xs text-slate-500">Pilih ukuran & warna</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-3 space-y-2">
          {product.variants.map((v) => {
            const modifier = Number(v.priceModifier ?? 0);
            const finalPrice = base + modifier;
            const disabled = v.stock <= 0 || !v.isActive;
            return (
              <button
                key={v.id}
                disabled={disabled}
                onClick={() => onPick(v)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:border-primary hover:bg-primary/5 transition disabled:opacity-40 disabled:cursor-not-allowed text-left"
              >
                {v.colorHex && (
                  <div
                    className="w-8 h-8 rounded-full border border-slate-200 shrink-0"
                    style={{ backgroundColor: v.colorHex }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {v.posLabel?.trim() || `${v.size} / ${v.color}`}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Stok: {v.stock} {disabled && "(habis)"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-extrabold tabular-nums text-slate-950">
                  {formatRupiah(finalPrice)}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CartPanel({
  cart,
  total,
  qty,
  onUpdateQty,
  onRemove,
  onClear,
  onCheckout,
  recentOrders,
  onReprint,
  compact = false,
}: {
  cart: CartLine[];
  total: number;
  qty: number;
  onUpdateQty: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  recentOrders: RecentOrder[];
  onReprint: (orderId: number) => void;
  compact?: boolean;
}) {
  return (
    <>
      {/* Header */}
      {!compact && (
        <div className="shrink-0 px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Keranjang</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {cart.length} item • {qty} qty
          </p>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
        {cart.length === 0 ? (
          <div className="py-10 text-center">
            <ShoppingBag className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">Keranjang kosong</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Tap produk di sebelah untuk mulai transaksi
            </p>
          </div>
        ) : (
          cart.map((line) => (
            <div
              key={line.key}
              className="flex gap-3 p-2.5 bg-slate-50 rounded-xl"
            >
              <div className="relative w-14 h-14 rounded-lg bg-white overflow-hidden shrink-0 border border-slate-200">
                {line.image ? (
                  <Image
                    src={line.image}
                    alt={line.productName}
                    fill
                    unoptimized
                    sizes="56px"
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 line-clamp-1">
                  {line.productName}
                </p>
                {line.variantLabel && (
                  <p className="text-[10px] text-slate-500">{line.variantLabel}</p>
                )}
                <p className="text-xs font-bold text-primary mt-0.5">
                  {formatRupiah(line.unitPrice * line.quantity)}
                </p>
                <p className="text-[10px] text-slate-400">
                  {formatRupiah(line.unitPrice)} × {line.quantity}
                </p>
              </div>
              <div className="flex flex-col items-end justify-between gap-1">
                <button
                  onClick={() => onRemove(line.key)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                  aria-label="Hapus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200">
                  <button
                    onClick={() => onUpdateQty(line.key, -1)}
                    className="p-1.5 text-slate-600 hover:text-primary transition"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-xs font-semibold w-5 text-center">
                    {line.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQty(line.key, +1)}
                    className="p-1.5 text-slate-600 hover:text-primary transition"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Recent orders (desktop only, minimal) */}
        {cart.length === 0 && recentOrders.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2 px-1">
              Transaksi Terbaru
            </p>
            <div className="space-y-1.5">
              {recentOrders.slice(0, 5).map((o) => (
                <button
                  type="button"
                  key={o.id}
                  onClick={() => onReprint(o.id)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[11px] text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                  title="Buka dan cetak ulang struk"
                >
                  <span className="font-mono">{o.orderNumber}</span>
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                    {formatRupiah(Number(o.total))}
                    <Printer className="h-3 w-3" aria-hidden="true" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer / checkout — sticky di bawah panel */}
      {cart.length > 0 && (
        <div className="shrink-0 px-4 py-3 border-t border-slate-200 bg-white space-y-2 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Total</span>
            <span className="text-xl font-bold text-slate-900">
              {formatRupiah(total)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClear}
              className="px-3 py-3 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              Batal
            </button>
            <button
              onClick={onCheckout}
              className="flex-1 py-3 text-sm font-bold text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition"
            >
              BAYAR {formatRupiah(total)}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
