# Development Plan & Checklist — Next Olshop

> Berdasarkan Kurikulum FIC Batch 24 (16 Sesi) — disesuaikan untuk web Next.js

---

## BULAN 1: OLSHOP FOUNDATION

### Phase 1: Project Setup & Basics (Sesi 1)
- [x] Setup project Next.js 16 dengan TypeScript
- [x] Konfigurasi Tailwind CSS 4
- [x] Setup folder structure (app router, components, lib)
- [x] Konfigurasi `tsconfig.json` dan path aliases
- [x] Setup development scripts (`pnpm dev` dengan Turbopack)
- [x] Buat root layout (`app/layout.tsx`)
- [x] Setup global styles (`app/globals.css`)

### Phase 2: Database & Admin Dashboard (Sesi 2)
- [x] Install dan konfigurasi Drizzle ORM + mysql2
- [x] Buat database schema (`lib/db/schema.ts`)
  - [x] Table: `users` (id, name, email, password, role, phone, address)
  - [x] Table: `categories` (id, name, slug, description, image)
  - [x] Table: `products` (id, categoryId, name, slug, price, stock, image, images, isActive, isFeatured)
  - [x] Table: `cart_items` (id, userId, productId, quantity)
  - [x] Table: `orders` (id, userId, orderNumber, status, subtotal, shippingCost, total, shipping info, payment info)
  - [x] Table: `order_items` (id, orderId, productId, productName, price, quantity, subtotal)
- [x] Setup database connection (`lib/db/index.ts`)
- [x] Buat seed script (`lib/db/seed.ts`)
- [x] Konfigurasi `drizzle.config.ts`
- [x] Admin layout dengan sidebar (`app/(admin)/layout.tsx`)
- [x] Admin sidebar component (`components/admin/AdminSidebar.tsx`)
- [x] Admin header component (`components/admin/AdminHeader.tsx`)
- [x] Admin dashboard page dengan statistik (`app/(admin)/dashboard/page.tsx`)
  - [x] Cards: Total orders hari ini, revenue, pending orders, jumlah produk
  - [x] Tabel recent orders
- [x] **CRUD Kategori (Admin)**
  - [x] List kategori dengan tabel
  - [x] Form tambah kategori
  - [x] Edit kategori
  - [x] Delete kategori
- [x] **CRUD Produk (Admin)**
  - [x] List produk dengan pagination
  - [x] Form tambah produk (dengan pilih kategori)
  - [ ] Upload gambar produk
  - [x] Edit produk
  - [x] Delete produk
  - [ ] Filter produk by kategori

### Phase 3: Authentication & API (Sesi 3)
- [x] Install dan setup NextAuth v5
- [x] Auth config (`lib/auth.ts` + `lib/auth.config.ts`)
- [x] NextAuth API route (`app/api/auth/[...nextauth]/route.ts`)
- [x] Login page (`app/(auth)/login/page.tsx`)
- [x] Register page (`app/(auth)/register/page.tsx`)
- [x] Server actions untuk auth (`app/actions/auth.ts`)
- [x] Middleware route protection (`middleware.ts`)
  - [x] Proteksi admin routes (require admin role)
  - [x] Proteksi customer routes (require authenticated)
  - [x] Redirect auth routes jika sudah login
- [x] **API Routes untuk Flutter**
  - [x] `GET /api/products` — list produk (public)
  - [x] `GET /api/products?category=slug` — filter by kategori
  - [x] `GET /api/products?featured=true` — featured products
  - [x] `GET /api/products/[id]` — detail produk
  - [x] `GET /api/categories` — list kategori
  - [x] `POST /api/auth/register` — register customer
  - [x] `POST /api/cart` — add to cart
  - [x] `GET /api/cart` — get cart items
  - [x] `PUT /api/cart/[id]` — update quantity
  - [x] `DELETE /api/cart/[id]` — remove item
  - [x] `POST /api/orders` — create order
  - [x] `GET /api/orders` — order history
  - [x] `GET /api/orders/[id]` — order detail

### Phase 4: Landing Page & Catalog (Sesi 4)
- [x] **Landing Page / Homepage** (`app/(shop)/page.tsx`)
  - [x] Hero section dengan CTA
  - [x] Featured products section
  - [x] Categories showcase
  - [x] Footer component
  - [x] Responsive design
- [x] **Shop Layout** (`app/(shop)/layout.tsx`)
  - [x] Navbar responsive dengan cart badge (`components/shop/Navbar.tsx`)
  - [x] Footer (`components/shop/Footer.tsx`)
- [x] **Katalog Produk** (`app/(shop)/products/page.tsx`)
  - [x] Grid produk responsive
  - [x] Filter by kategori (sidebar desktop + dropdown mobile)
  - [x] ProductCard component (`components/shop/ProductCard.tsx`)
- [x] **Detail Produk** (`app/(shop)/products/[slug]/page.tsx`)
  - [x] Info lengkap produk
  - [x] AddToCartButton component
  - [ ] Breadcrumb navigation
  - [ ] Related products section
- [x] **Cart Page** (`app/(shop)/cart/page.tsx`)
  - [x] List cart items dengan quantity controls
  - [x] CartItemRow component
  - [x] Order summary
  - [x] Server actions untuk cart operations
- [x] **Checkout Page** (`app/(shop)/checkout/page.tsx`)
  - [x] CheckoutForm component
  - [x] Form alamat pengiriman
  - [x] Pilih metode pembayaran
  - [x] Order summary
- [x] **Order History** (`app/(shop)/orders/page.tsx`)
  - [x] List pesanan customer
  - [x] Order detail page (`app/(shop)/orders/[id]/page.tsx`)
  - [x] Status badge styling

### Phase 5: Testing (Sesi 5-6)
- [x] Setup Vitest + Testing Library
- [x] Unit tests untuk utility functions
- [x] Unit tests untuk Zod schemas
- [x] Tests untuk server actions (products, orders, cart, auth, categories)
- [x] Tests untuk API routes
- [x] 231 tests passing, 20 test files

### Phase 6: Admin Order Management (Sesi 7-8)
- [x] Admin orders list page
- [x] Admin order detail page
- [x] Status update form (order status + payment status)
- [x] Customer order detail page

---

## BULAN 2: PRODUCTION READY

### Phase 7: UI Enhancement — shadcn/ui, sonner, nuqs, TanStack React Table (Sesi 9)
- [x] Init shadcn/ui (New York style, Zinc colors, CSS variables)
- [x] Add shadcn components: Button, Input, Textarea, Label, Select, Badge, Table, Card, Separator, DropdownMenu, Dialog
- [x] Install sonner (toast notifications)
- [x] Install nuqs (URL state management)
- [x] Install @tanstack/react-table (data tables)
- [x] Setup providers in root layout (Toaster + NuqsAdapter)
- [x] Create reusable `<DataTable>` component with sorting
- [x] **Migrate Admin Tables**
  - [x] Categories table → DataTable + column definitions
  - [x] Products table → DataTable + column definitions
  - [x] Orders table → DataTable + nuqs status filter
- [x] **Migrate Admin Forms**
  - [x] CategoryForm → shadcn Input, Textarea, Button, Label
  - [x] ProductForm → shadcn Input, Textarea, Button, Label
  - [x] StatusUpdateForm → shadcn Label + toast
- [x] **Migrate Admin Delete Buttons**
  - [x] DeleteCategoryButton → shadcn Button + toast
  - [x] DeleteProductButton → shadcn Button + toast
- [x] **Migrate Admin Order Detail**
  - [x] Order detail page → Card, Badge, Separator
- [x] **Migrate Shop Components**
  - [x] CartItemRow → shadcn Button (outline, icon)
  - [x] CheckoutForm → shadcn Input, Textarea, Button, Label
- [x] **Migrate Auth Pages**
  - [x] Login page → shadcn Input, Button, Label
  - [x] Register page → shadcn Input, Button, Label
- [x] Replace all `alert()` with `toast()` from sonner
- [x] Replace all `window.confirm()` pattern with shadcn Button + toast feedback

### Phase 8: Payment Gateway — Xendit (Sesi 10-11)
- [x] Setup akun Xendit (sandbox)
- [x] Install `xendit-node` package
- [x] Konfigurasi environment variables Xendit
- [x] **Xendit SDK Wrapper** (`lib/xendit.ts`)
  - [x] `createInvoice()` — buat invoice dengan redirect URLs + durasi
  - [x] `expireInvoice()` — expire invoice (idempotent, already-expired = success)
  - [x] 9 unit tests (`tests/unit/xendit.test.ts`)
- [x] **Payment Methods** (via Xendit Invoice — mendukung semua metode otomatis)
  - [x] Virtual Account (BCA, BNI, BRI, Mandiri)
  - [x] QRIS payment
  - [x] E-Wallet (OVO, DANA, LinkAja, ShopeePay)
  - [x] Invoice / Payment Link
- [x] **Webhook Handler** (`app/api/webhooks/xendit/route.ts`)
  - [x] Endpoint: `POST /api/webhooks/xendit`
  - [x] Verifikasi `x-callback-token` header
  - [x] Handle event: `PAID` → update invoice + order → packing
  - [x] Handle event: `EXPIRED` → update invoice + order → expired + restore stock
  - [x] Idempotent (skip already processed)
  - [x] Auto-update order status + audit log (`changedBy: webhook:xendit`)
  - [x] 12 tests (`tests/api/webhooks-xendit.test.ts`)
- [x] **Payment Flow (Customer)**
  - [x] Checkout → createOrder → Xendit invoice → redirect ke payment page
  - [x] PaymentCountdown component (countdown ke `willExpiredAt`)
  - [x] "Bayar Sekarang" button (waiting_payment + ada invoice)
  - [x] "Batalkan Pesanan" button (`cancelOrderByCustomer`)
  - [x] "Bayar Ulang" button (expired → new invoice → waiting_payment)
- [x] **Cron Safety Net** (`app/api/cron/check-expired-orders/route.ts`)
  - [x] GET endpoint, verify `CRON_SECRET` bearer token
  - [x] Find orders: `status=waiting_payment AND willExpiredAt < NOW()`
  - [x] Expire Xendit invoice + transition → expired + restore stock
  - [x] 6 tests (`tests/api/cron-expired-orders.test.ts`)
- [x] **Order Status Flow**
  - [x] waiting_payment → packing (PAID) → shipping → delivered
  - [x] waiting_payment → expired (auto/webhook) → waiting_payment (repay)
  - [x] waiting_payment → cancelled (customer cancel)
- [x] **Stock Management Helper** (`lib/stock.ts`)
  - [x] `deductStock()` — kurangi stok saat order
  - [x] `restoreStock()` — kembalikan stok saat cancel/expired
  - [x] `validateStock()` — validasi ketersediaan stok + error message
  - [x] 8 tests (`tests/unit/stock.test.ts`)

### Phase 9: Shipping Integration — Bitship (Sesi 12)
- [x] Setup akun Bitship
- [x] Konfigurasi API key dan origin address (`.env`)
- [x] **Bitship API Client** (`lib/bitship.ts`)
  - [x] `getShippingRates()` — fetch ongkir berdasarkan origin/destination/items
  - [x] `createShipment()` — buat order pengiriman, return trackingId + waybillId
  - [x] `getTracking()` — cek status tracking
  - [x] 14 unit tests (`tests/unit/bitship.test.ts`)
- [x] **Cek Ongkir** (`calculateShippingRates` server action)
  - [x] Orchestrate: get address, get store settings, get active couriers, get cart items + weight
  - [x] Call Bitship API
  - [x] Return grouped rates (express / regular / economy)
  - [x] Auth required + address ownership validation
- [x] **Checkout Integration** (multi-step `CheckoutForm`)
  - [x] Step 1: Pilih alamat (`AddressSelector` component)
  - [x] Step 2: Pilih kurir (`ShippingOptions` component — grouped rates)
  - [x] Step 3: Review & Bayar → createOrder → redirect ke Xendit
  - [x] Hitung berat dari cart items (product.weight * quantity)
  - [x] Total = subtotal + ongkir kurir
  - [x] Simpan info pengiriman di `shippings` table
- [x] **Admin Kirim Order** (`sendOrderToBitship` server action)
  - [x] Admin-only, order harus status `packing`
  - [x] Call Bitship `createShipment()` → store trackingId/waybillId
  - [x] Transition order → `shipping`
  - [x] Idempotent (sudah ada trackingId → skip Bitship call)
  - [x] `SendOrderButton` component di admin order detail
  - [x] 17 tests total (`tests/actions/shipping.test.ts`)
- [x] **Bitship Webhook** (`app/api/webhooks/bitship/route.ts`)
  - [x] Receive tracking updates dari Bitship
  - [x] Update shipping status + insert shipping_history
  - [x] `delivered` → transition order → delivered
  - [x] `cancelled/returned/rejected` → transition order → cancelled + restore stock
  - [x] Graceful ignore unknown trackingId
  - [x] 10 tests (`tests/api/webhooks-bitship.test.ts`)
- [x] **Tracking UI**
  - [x] `TrackingTimeline` component (vertical timeline dari shipping_histories)
  - [x] Tampilkan di customer order detail (shipping/delivered status)
  - [x] Tampilkan di admin order detail

### Phase 10: Admin Dashboard Advanced (Sesi 13)
- [x] **Statistik Penjualan**
  - [x] Total penjualan hari ini / minggu / bulan
  - [x] Jumlah pesanan per status
  - [ ] Produk terlaris
  - [ ] Grafik penjualan sederhana (chart)
- [x] **Order Management (Admin)**
  - [x] List pesanan dengan filter status
  - [x] Detail pesanan lengkap
  - [x] Update status pesanan
  - [x] Info pembayaran (status, metode, channel, waktu bayar)
  - [x] Kirim order ke kurir via Bitship (`SendOrderButton`)
- [x] **Shipping Management (Admin)**
  - [x] Tracking info dari Bitship (TrackingTimeline)
  - [x] Auto-update via webhook (delivered/cancelled)
  - [x] Waybill/tracking ID tersimpan di shipping record
- [ ] **User Management (Admin)**
  - [ ] List customers
  - [ ] Detail customer + order history

### Phase 11: Polish & Deploy (Sesi 14-16)
- [ ] **UI/UX Polish**
  - [ ] Empty states (cart kosong, no orders, no products)
  - [ ] Loading skeletons / shimmer effects
  - [x] Error handling dengan toast notifications
  - [ ] Smooth page transitions
  - [ ] Consistent typography dan spacing
  - [ ] Dark mode (optional)
- [ ] **SEO & Performance**
  - [ ] Meta tags dan Open Graph
  - [ ] Image optimization (next/image)
  - [ ] generateMetadata untuk dynamic pages
  - [ ] Sitemap generation
- [ ] **Security Hardening**
  - [ ] Rate limiting pada API
  - [ ] Input sanitization
  - [ ] CSRF protection
  - [ ] Secure headers
- [ ] **Deployment**
  - [ ] Setup VPS (Ubuntu + Node.js + PM2 + Nginx)
  - [ ] MySQL production database
  - [ ] Domain + SSL (Let's Encrypt)
  - [ ] Environment variables production
  - [ ] CI/CD pipeline (optional)
  - [ ] Monitoring & logging

---

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Setup & Basics | ✅ Done | 100% |
| Phase 2: Database & Admin | ✅ Done | ~95% (image upload belum) |
| Phase 3: Auth & API | ✅ Done | 100% |
| Phase 4: Landing & Catalog | ✅ Done | ~95% (breadcrumb belum) |
| Phase 5: Testing | ✅ Done | 100% (231 tests, 20 files) |
| Phase 6: Admin Order Mgmt | ✅ Done | 100% |
| Phase 7: UI Enhancement | ✅ Done | 100% |
| Phase 8: Payment (Xendit) | ✅ Done | 100% |
| Phase 9: Shipping (Bitship) | ✅ Done | 100% |
| Phase 10: Admin Advanced | 🔄 Partial | ~80% (chart + user mgmt belum) |
| Phase 11: Polish & Deploy | 🔄 Partial | ~10% |

**Overall Progress: ~96%** — Payment + Shipping terintegrasi. Dashboard stats selesai. Tinggal image upload, chart, user mgmt, polish & deploy.

---

## Priority Next Steps
1. 🔜 Image upload untuk produk
2. 🔜 Grafik penjualan (chart)
3. 🔜 User management (admin)
4. 🔜 UI polish (empty states, loading skeletons)
5. 🔜 Deploy ke VPS
