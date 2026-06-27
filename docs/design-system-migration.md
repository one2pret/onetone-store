# Design System Migration Plan

> Migrasi seluruh codebase ke design system yang telah disepakati di `.claude/rules/02-design-system.md`.

## Audit Summary

| Kategori | Temuan | Severity |
|----------|--------|----------|
| Hardcoded `#51B1A6` hex | 50+ instance di pages & components | HIGH |
| `blue-*` dipakai sebagai primary | 15+ instance (cart, checkout, orders, admin) | HIGH |
| `gray-*` dipakai (seharusnya `slate-*`) | 100+ instance di hampir semua file | HIGH |
| Missing CSS variable mapping | `primary-hover`, `primary-light` belum jadi Tailwind token | MEDIUM |
| Inconsistent shadows | Beberapa page pakai `shadow-2xl` tanpa konteks | LOW |
| Missing `cn()` di conditional classes | 6 components pakai inline ternary | LOW |

---

## Phase 0: Foundation — Tailwind Theme Extension

**Goal**: Extend `@theme inline` di `globals.css` agar semua brand colors tersedia sebagai Tailwind classes (`bg-primary`, `text-primary-hover`, `bg-primary-light`, dll).

### Task 0.1: Extend CSS Variables & Tailwind Theme

**File**: `app/globals.css`

Tambah mapping di `@theme inline`:
```css
@theme inline {
  /* existing ... */
  --color-primary-hover: var(--primary-hover);
  --color-primary-light: var(--primary-light);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-danger: var(--danger);
}
```

Setelah ini, bisa pakai: `bg-primary-hover`, `text-primary-light`, `bg-success`, dll.

### Task 0.2: Verify Token Availability

Test bahwa class-class berikut bekerja:
- `bg-primary` → `#51B1A6`
- `hover:bg-primary-hover` → `#3D9A8F`
- `bg-primary-light` → `#C5DDD9`
- `text-success` → `#22c55e`
- `bg-warning` → `#f59e0b`
- `text-danger` → `#ef4444`

---

## Phase 1: Global Gray → Slate Migration

**Goal**: Replace ALL `gray-*` with `slate-*` across the codebase.

Ini adalah perubahan terbesar secara volume tapi paling aman (pure visual, no logic change).

### Mapping Table

| From | To |
|------|----|
| `gray-50` | `slate-50` |
| `gray-100` | `slate-100` |
| `gray-200` | `slate-200` |
| `gray-300` | `slate-300` |
| `gray-400` | `slate-400` |
| `gray-500` | `slate-500` |
| `gray-600` | `slate-600` |
| `gray-700` | `slate-700` |
| `gray-800` | `slate-800` |
| `gray-900` | `slate-900` |

### Checklist Phase 1

#### Shop Components
- [ ] `components/shop/Navbar.tsx` — ~14 instances gray → slate
- [ ] `components/shop/Footer.tsx` — ~5 instances
- [ ] `components/shop/ProductCard.tsx` — ~10 instances
- [ ] `components/shop/AddressSelector.tsx` — ~6 instances
- [ ] `components/shop/ShippingOptions.tsx` — ~4 instances
- [ ] `components/shop/TrackingTimeline.tsx` — ~3 instances
- [ ] `components/shop/PaymentCountdown.tsx` — ~2 instances

#### Admin Components
- [ ] `components/admin/AdminHeader.tsx` — ~4 instances
- [ ] `components/ui/data-table.tsx` — ~3 instances

#### Shop Pages
- [ ] `app/(shop)/page.tsx` (Home) — ~15 instances
- [ ] `app/(shop)/products/page.tsx` — ~6 instances
- [ ] `app/(shop)/products/[slug]/page.tsx` — ~8 instances
- [ ] `app/(shop)/cart/page.tsx` — ~10 instances
- [ ] `app/(shop)/checkout/page.tsx` — ~4 instances
- [ ] `app/(shop)/checkout/CheckoutForm.tsx` — ~8 instances
- [ ] `app/(shop)/orders/page.tsx` — ~5 instances
- [ ] `app/(shop)/orders/[id]/page.tsx` — ~8 instances

#### Auth Pages
- [ ] `app/(auth)/layout.tsx` — ~3 instances
- [ ] `app/(auth)/login/page.tsx` — ~6 instances
- [ ] `app/(auth)/register/page.tsx` — ~6 instances

#### Admin Pages
- [ ] `app/(admin)/layout.tsx` — ~1 instance (`bg-gray-50`)
- [ ] `app/(admin)/dashboard/page.tsx` — ~15 instances
- [ ] `app/(admin)/dashboard/products/page.tsx` — ~2 instances
- [ ] `app/(admin)/dashboard/products/create/page.tsx` — ~3 instances
- [ ] `app/(admin)/dashboard/products/[id]/edit/page.tsx` — ~3 instances
- [ ] `app/(admin)/dashboard/categories/page.tsx` — ~2 instances
- [ ] `app/(admin)/dashboard/categories/create/page.tsx` — ~3 instances
- [ ] `app/(admin)/dashboard/categories/[id]/edit/page.tsx` — ~3 instances
- [ ] `app/(admin)/dashboard/orders/page.tsx` — ~2 instances
- [ ] `app/(admin)/dashboard/orders/[id]/page.tsx` — ~10 instances
- [ ] `app/(admin)/dashboard/orders/_components/OrdersTable.tsx` — ~3 instances
- [ ] `app/(admin)/dashboard/orders/_components/StatusUpdateForm.tsx` — ~2 instances
- [ ] `app/(admin)/dashboard/products/_components/ProductForm.tsx` — ~5 instances

---

## Phase 2: Hardcoded Hex → Tailwind Token

**Goal**: Replace ALL `#51B1A6`, `#3D9A8F`, `#C5DDD9` with Tailwind tokens.

### Mapping Table

| From (Hardcoded) | To (Token) |
|-------------------|------------|
| `text-[#51B1A6]` | `text-primary` |
| `bg-[#51B1A6]` | `bg-primary` |
| `border-[#51B1A6]` | `border-primary` |
| `hover:bg-[#51B1A6]` | `hover:bg-primary` |
| `focus:ring-[#51B1A6]` | `focus:ring-primary` |
| `hover:bg-[#3D9A8F]` | `hover:bg-primary-hover` |
| `hover:text-[#3D9A8F]` | `hover:text-primary-hover` |
| `text-[#3D9A8F]` | `text-primary-hover` |
| `bg-[#C5DDD9]` | `bg-primary-light` |
| `hover:bg-[#51B1A6]/5` | `hover:bg-primary/5` |
| `hover:border-[#51B1A6]/30` | `hover:border-primary/30` |
| `from-[#51B1A6] to-[#3D9A8F]` | `from-primary to-primary-hover` |
| `#51B1A6` (inline style/JSX) | CSS variable `var(--primary)` |

### Checklist Phase 2

#### Shop Components
- [ ] `components/shop/Navbar.tsx` — `text-[#51B1A6]`, `bg-[#51B1A6]`, `focus:ring-[#51B1A6]`
- [ ] `components/shop/Footer.tsx` — `text-[#51B1A6]`
- [ ] `components/shop/ProductCard.tsx` — `hover:border-[#51B1A6]/30`, `text-[#51B1A6]`

#### Admin Components
- [ ] `components/admin/AdminSidebar.tsx` — `bg-[#51B1A6]` (logo + active nav)

#### Shop Pages
- [ ] `app/(shop)/page.tsx` (Home) — 10+ instances `#51B1A6`, `#3D9A8F`, `#C5DDD9`
- [ ] `app/(shop)/products/[slug]/page.tsx` — `text-[#51B1A6]`, `hover:text-[#51B1A6]`

#### Auth Pages
- [ ] `app/(auth)/layout.tsx` — `#51B1A6` inline in brand text
- [ ] `app/(auth)/login/page.tsx` — `bg-[#51B1A6]`, `hover:bg-[#3D9A8F]`, `text-[#51B1A6]`, `bg-[#C5DDD9]`
- [ ] `app/(auth)/register/page.tsx` — same as login

#### Special Pages
- [ ] `app/design-system/page.tsx` — OK to keep hex (it's a reference page showing actual values)
- [ ] `app/admin-ui/page.tsx` — OK to keep hex (reference page)

---

## Phase 3: Blue → Primary Token

**Goal**: Replace semua `blue-*` yang dipakai sebagai primary/CTA dengan `primary` token.

### Mapping Table

| From (Blue) | To (Primary) | Context |
|-------------|--------------|---------|
| `bg-blue-600` | `bg-primary` | CTA buttons |
| `hover:bg-blue-700` | `hover:bg-primary-hover` | Button hover |
| `text-blue-600` | `text-primary` | Links, total price, action icons |
| `text-blue-700` | `text-primary` | Active tab text |
| `bg-blue-100` | `bg-primary-light` | Active tab bg, completed step |
| `text-blue-500` | `text-primary` | Checkmarks, active indicators |
| `border-blue-500` | `border-primary` | Selected card border |
| `bg-blue-50` | `bg-primary/5` | Selected card background |
| `bg-blue-100 text-blue-700` (active filter) | `bg-primary/10 text-primary` | Category/status tabs |

### Checklist Phase 3

#### Shop Pages
- [ ] `app/(shop)/cart/page.tsx` — `bg-blue-600`, `hover:bg-blue-700`, `text-blue-600` (CTA + total)
- [ ] `app/(shop)/orders/page.tsx` — `bg-blue-600` (empty state CTA)
- [ ] `app/(shop)/orders/[id]/page.tsx` — `text-blue-600` (total price)
- [ ] `app/(shop)/products/page.tsx` — `bg-blue-100 text-blue-700` (active category)

#### Shop Components
- [ ] `app/(shop)/checkout/CheckoutForm.tsx` — `bg-blue-600`, `bg-blue-100 text-blue-700`, `text-blue-600`
- [ ] `components/shop/AddressSelector.tsx` — `border-blue-500`, `bg-blue-50`, `bg-blue-100 text-blue-700`, `text-blue-500`
- [ ] `components/shop/ShippingOptions.tsx` — `border-blue-500`, `bg-blue-50`, `text-blue-500`
- [ ] `components/shop/TrackingTimeline.tsx` — `text-blue-500`

#### Admin Pages
- [ ] `app/(admin)/dashboard/page.tsx` — `text-blue-600` (links)
- [ ] `app/(admin)/dashboard/orders/[id]/page.tsx` — `text-blue-600` (links)
- [ ] `app/(admin)/dashboard/orders/_components/OrdersTable.tsx` — `text-blue-600` (Eye icon)

**Note**: `blue-*` yang merupakan bagian dari status badge system (e.g. `bg-blue-100 text-blue-700` untuk status `packing`) TETAP dipertahankan — itu semantic color untuk status, bukan primary.

---

## Phase 4: Typography & Spacing Polish

**Goal**: Pastikan typography levels dan spacing sesuai design system.

### Typography Fixes

| Elemen | Seharusnya | Yang Perlu Dicek |
|--------|------------|------------------|
| Page titles (H1) | `text-4xl font-bold text-slate-900` | Admin pages pakai `text-2xl text-gray-800` → `text-2xl font-bold text-slate-800` (H2 for sub-pages OK) |
| Section titles (H2) | `text-2xl font-bold text-slate-800` | Home page sections |
| Card titles (H3) | `text-lg font-semibold text-slate-800` | Product cards, stat cards |
| Body text | `text-sm text-slate-600` | Descriptions |
| Captions | `text-xs text-slate-400` | Timestamps, helpers |
| Price | `text-xl font-bold text-primary` | Product prices |
| Overline | `text-[11px] font-semibold text-primary uppercase tracking-wider` | Category labels |
| Mono | `font-mono text-sm text-primary` | Order numbers |

### Checklist Phase 4

- [ ] Home page hero: verify `text-4xl md:text-5xl font-bold text-slate-900`
- [ ] Home page sections: verify `text-2xl font-bold text-slate-800`
- [ ] Admin page headings: verify `text-2xl font-bold text-slate-800`
- [ ] Product prices: verify `text-xl font-bold text-primary`
- [ ] Category overlines on ProductCard: verify `text-[11px] font-semibold text-primary uppercase tracking-wider`
- [ ] Order numbers: verify `font-mono text-sm text-primary`
- [ ] Card padding: verify `p-5` (20px)
- [ ] Container: verify `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

---

## Phase 5: Shadow & Border Radius Consistency

**Goal**: Standardize shadow levels dan border radius.

### Shadow Standards

| Context | Class |
|---------|-------|
| Cards default | `shadow-sm` |
| Card hover | `shadow-md` |
| Dropdowns | `shadow` |
| Modals | `shadow-xl` |
| Navbar/Footer (sticky) | `shadow-lg` |

### Border Radius Standards

| Context | Class |
|---------|-------|
| Buttons | `rounded-lg` |
| Cards | `rounded-xl` |
| Inputs | `rounded-lg` |
| Badges | `rounded-full` |
| Avatars | `rounded-full` |

### Checklist Phase 5

- [ ] ProductCard: verify `rounded-xl` + `shadow-sm` → `hover:shadow-md`
- [ ] All Card components: verify `rounded-xl`
- [ ] Auth form cards: `rounded-2xl` → normalize to `rounded-xl`
- [ ] Stat cards (admin): verify `rounded-xl shadow-sm`
- [ ] Remove `shadow-2xl` from home page hero (use `shadow-xl` max)

---

## Phase 6: Component-Level cn() Cleanup

**Goal**: Replace inline ternary class logic dengan `cn()` helper.

### Checklist Phase 6

- [ ] `components/shop/ProductCard.tsx` — hover state classes
- [ ] `components/shop/Navbar.tsx` — mobile menu toggle
- [ ] `components/shop/AddressSelector.tsx` — selected/unselected states
- [ ] `components/shop/ShippingOptions.tsx` — selected rate
- [ ] `app/(shop)/checkout/CheckoutForm.tsx` — step indicators
- [ ] `components/shop/TrackingTimeline.tsx` — latest event highlight

---

## Phase 7: Metadata & Branding

**Goal**: Fix app metadata dan branding text.

### Checklist Phase 7

- [ ] `app/layout.tsx` — metadata title: "NextShop - E-Commerce" → "NextElektronik - Online Shop"
- [ ] `app/layout.tsx` — metadata description: update ke Indonesian
- [ ] Verify "NextElektronik" branding di Navbar, Sidebar, Footer, Auth layout
- [ ] Favicon & OG image: pastikan ada dan sesuai brand

---

## Execution Order & Estimates

| Phase | Scope | Files | Priority |
|-------|-------|-------|----------|
| **0** | Foundation — extend Tailwind theme | 1 file | P0 (prerequisite) |
| **1** | Gray → Slate migration | ~30 files | P1 (biggest visual impact) |
| **2** | Hardcoded hex → tokens | ~10 files | P1 |
| **3** | Blue → Primary | ~11 files | P1 |
| **4** | Typography & spacing polish | ~15 files | P2 |
| **5** | Shadow & radius consistency | ~8 files | P2 |
| **6** | cn() cleanup | 6 files | P3 (code quality) |
| **7** | Metadata & branding | 2 files | P3 |

**Recommended order**: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7

Phase 0 HARUS duluan karena Phase 2 bergantung pada token `primary-hover` dan `primary-light` yang available.

Phase 1-3 bisa dikerjakan bersamaan setelah Phase 0 selesai.

---

## Validation Checklist (Post-Migration)

- [ ] `pnpm build` — zero TypeScript errors
- [ ] `pnpm vitest run` — all 231 tests pass
- [ ] Visual check: Home page — primary teal consistent, no blue CTAs
- [ ] Visual check: Product listing — active category in teal, not blue
- [ ] Visual check: Product detail — price in teal
- [ ] Visual check: Cart — CTA button teal, total price teal
- [ ] Visual check: Checkout — step indicators teal, selected address teal
- [ ] Visual check: Orders — status badges correct colors
- [ ] Visual check: Order detail — payment info, tracking timeline
- [ ] Visual check: Login/Register — brand teal, no hardcoded hex
- [ ] Visual check: Admin dashboard — stat cards, links
- [ ] Visual check: Admin orders — table, detail page
- [ ] Responsive check: mobile & tablet breakpoints still look correct
- [ ] No `#51B1A6` in codebase (except design-system & admin-ui reference pages)
- [ ] No `gray-` in codebase (except design-system & admin-ui reference pages)
- [ ] No `blue-600`/`blue-700` used as primary CTA (blue in status badges is OK)

---

## Files Affected (Complete List)

### Components (10 files)
1. `components/shop/Navbar.tsx`
2. `components/shop/Footer.tsx`
3. `components/shop/ProductCard.tsx`
4. `components/shop/AddressSelector.tsx`
5. `components/shop/ShippingOptions.tsx`
6. `components/shop/TrackingTimeline.tsx`
7. `components/shop/PaymentCountdown.tsx`
8. `components/admin/AdminSidebar.tsx`
9. `components/admin/AdminHeader.tsx`
10. `components/ui/data-table.tsx`

### Pages (22 files)
11. `app/globals.css`
12. `app/layout.tsx`
13. `app/(auth)/layout.tsx`
14. `app/(auth)/login/page.tsx`
15. `app/(auth)/register/page.tsx`
16. `app/(admin)/layout.tsx`
17. `app/(admin)/dashboard/page.tsx`
18. `app/(admin)/dashboard/products/page.tsx`
19. `app/(admin)/dashboard/products/create/page.tsx`
20. `app/(admin)/dashboard/products/[id]/edit/page.tsx`
21. `app/(admin)/dashboard/categories/page.tsx`
22. `app/(admin)/dashboard/categories/create/page.tsx`
23. `app/(admin)/dashboard/categories/[id]/edit/page.tsx`
24. `app/(admin)/dashboard/orders/page.tsx`
25. `app/(admin)/dashboard/orders/[id]/page.tsx`
26. `app/(admin)/dashboard/orders/_components/OrdersTable.tsx`
27. `app/(admin)/dashboard/orders/_components/StatusUpdateForm.tsx`
28. `app/(admin)/dashboard/products/_components/ProductForm.tsx`
29. `app/(shop)/page.tsx`
30. `app/(shop)/products/page.tsx`
31. `app/(shop)/products/[slug]/page.tsx`
32. `app/(shop)/cart/page.tsx`
33. `app/(shop)/checkout/page.tsx`
34. `app/(shop)/checkout/CheckoutForm.tsx`
35. `app/(shop)/orders/page.tsx`
36. `app/(shop)/orders/[id]/page.tsx`

**Total: ~36 files**

### Excluded (reference pages — keep as-is)
- `app/design-system/page.tsx` — showcase, hex values intentional
- `app/admin-ui/page.tsx` — showcase, hex values intentional
