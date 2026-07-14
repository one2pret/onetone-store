# onetone-store — Project Rules & AI Context

## Active Sprint
Phase 0: Rebrand gold-dark → white-dark — ✅ SELESAI (2026-07-14)
Opsi dipilih: B (monokrom + micro-gold untuk premium badge)
Commit: c674632 — semua token, hex replacement, build clean, docs updated

Phase 1: Data Model Additive — ✅ SELESAI (2026-07-14)
Commit: cf42445 — stores, member_tiers, memberships, vouchers, points_ledger
Kolom additive: products.store_id, orders.store_id/voucher_id/discount_amount/points_earned/points_redeemed
Seed: 1 store onetone, 3 tiers, 4 memberships, 3 vouchers, 5 points ledger entries

Phase 2: Marketplace shell + routing — ✅ SELESAI (2026-07-14)
Commit: 0c7f9c6 — (marketplace)/ + (checkout)/ route groups, 41 halaman, zero error
Routes baru: / (marketplace home), /stores/[slug], /categories, /search
Moves: cart/checkout/orders/addresses → (checkout)/, URL tidak berubah

Phase 3: Next — Account area ("Saya"): profil, membership, poin, voucher, history

## Project Overview

Aplikasi **Online Shop (Olshop)** single-store untuk UMKM/bisnis personal.
Bukan marketplace — satu toko, dua persona: **Admin** (pemilik toko) dan **Customer** (pembeli).

**Nama Produk:** onetone-olshop
**Client:** Fashion sport store (nama klien dirahasiakan)
**Target:** MVP backend + Flutter mobile dalam 30 hari

---

## Design Context (impeccable)

Baca `PRODUCT.md` di project root untuk strategic context (register, users, brand personality, anti-references, principles).
Baca `DESIGN.md` di project root untuk visual system (tokens, palette, typography, komponen).

**Register:** `product` (app UI melayani fungsi; POS + admin dominan, shop customer mengambil sebagian brand-flavor).

**Design principles ringkas:**
1. Single store, distinctive voice — bukan marketplace template
2. Product photography adalah hero — layout adalah frame
3. Effortless commerce, not effortful design — friction minimum
4. Dual persona, one family — admin & customer beda bahasa visual tapi satu brand
5. Indonesian context, world-class execution — Rupiah bukan alasan feels murah

**Anti-references (JANGAN):** marketplace look (Shopee/Tokopedia badges/neon), SaaS-cream landing 2025, gradient hero dengan 3D orb/blob.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components, Server Actions, Turbopack)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **Database**: MySQL 8 via `mysql2`
- **ORM**: Drizzle ORM 0.38+
- **Auth**: NextAuth v5 (Credentials provider, JWT strategy)
- **Validation**: Zod
- **Storage**: Cloudflare R2 (via AWS S3-compatible SDK)
- **Image Processing**: sharp (resize, WebP convert, compress)
- **Payment**: Xendit (QRIS, VA, e-wallet)
- **Shipping**: Bitship (aggregator kurir Indonesia)
- **Testing**: Vitest
- **Maps**: Leaflet

---

## Project Structure

```
app/
  (shop)/          → Customer pages
  (auth)/          → Login & Register
  (admin)/         → Admin dashboard
  api/             → REST API (Flutter consumption)
  actions/         → Server Actions (web mutations)
components/
  shop/            → Customer UI
  admin/           → Admin UI
  ui/              → shadcn/ui base
lib/
  db/              → schema, seed, connection
  auth.ts          → NextAuth config
  storage.ts       → R2 abstraction layer (SEMUA upload lewat sini)
  image-processor.ts → sharp wrapper (resize, WebP, thumb)
  drive-import.ts  → Google Drive import helper
  bitship.ts       → Bitship API client
  xendit.ts        → Xendit SDK wrapper
  stock.ts         → Stock management
  order-status.ts  → Status machine
  utils.ts         → formatRupiah, formatDate, generateOrderNumber
types/             → TypeScript type definitions
docs/              → Dokumentasi teknis
```

---

## Naming Conventions

- **Files**: kebab-case untuk routes, PascalCase untuk components
- **DB tables**: snake_case (users, cart_items, order_items, product_images)
- **Variables/functions**: camelCase
- **Types/Interfaces**: PascalCase
- **Server Actions**: verb prefix (createProduct, updateOrder)
- **API routes**: RESTful `/api/products`, `/api/orders/[id]`

---

## Coding Rules

### Next.js Patterns

- Server Components by default; `'use client'` hanya jika perlu interactivity
- Server Actions untuk semua mutasi dari web app
- API routes HANYA untuk konsumsi external (Flutter)
- `revalidatePath()` setelah setiap mutasi
- Error via `error.tsx`, loading via `loading.tsx`

### Database & ORM

- Schema di `lib/db/schema.ts` — jangan raw SQL
- Drizzle `relations()` untuk semua relasi
- Decimal untuk harga: `decimal('price', { precision: 12, scale: 2 })`
- Timestamps: `createdAt`, `updatedAt` dengan default `now()`

### Storage Rules (PENTING)

- **JANGAN** simpan file di `/public/uploads` atau folder apapun di server
- **SEMUA** upload gambar lewat `lib/storage.ts` → Cloudflare R2
- **DB hanya simpan** `object_key` (path relatif), bukan full URL
- Rekonstruksi URL: `${process.env.NEXT_PUBLIC_CDN_URL}/${objectKey}`
- Filename: selalu UUID, jangan nama asli user
- Format output: WebP (original tetap disimpan)
- Sizes: original, webp (800px), thumb (400px)
- Validasi MIME dari content (bukan ekstensi) sebelum upload
- Checksum (SHA256) untuk deteksi duplikasi

### Bucket Structure di R2

```
onetone-store/
  products/
    {product-slug}/
      {uuid}-original.jpg
      {uuid}-main.webp      ← 800px
      {uuid}-thumb.webp     ← 400px
  temp/
    {session-id}/           ← auto-cleanup 24 jam
```

### API Response Format

```typescript
// Success
{ success: true, data: T }
// Error
{ success: false, error: string }
// List
{ success: true, data: T[], meta: { page, limit, total } }
```

### Auth Pattern

```typescript
// Selalu cek di awal server action/API
const session = await auth();
if (!session?.user) return { success: false, error: "Unauthorized" };
if (session.user.role !== "admin") return { success: false, error: "Forbidden" };
```

---

## Database Schema — Tabel Utama

| Table | Purpose |
|-------|---------|
| users | Admin & customer accounts |
| categories | Product categories |
| products | Product catalog |
| product_images | Gambar produk (metadata + R2 object_key) |
| cart_items | Shopping cart per user |
| orders | Customer orders |
| order_items | Items per order (dengan snapshot price/name) |
| invoices | Xendit invoice records |
| shippings | Bitship tracking records |
| addresses | Customer addresses |
| order_status_logs | Audit trail setiap status change |
| banners | Promotional banners |

---

## Order Status Machine

```
waiting_payment → packing → shipping → delivered ✓
       ↓              ↓
    expired       cancelled ✗
       ↓
waiting_payment (repay)
```

---

## Key Commands

```bash
pnpm dev              # Dev server (Turbopack)
pnpm build            # Production build
pnpm db:push          # Push schema ke MySQL
pnpm db:studio        # Drizzle Studio UI
pnpm db:seed          # Seed sample data
pnpm test             # Vitest watch mode
pnpm test:run         # Vitest single run
```

---

## Environment Variables

```bash
# Database
DATABASE_URL=mysql://...

# Auth
AUTH_SECRET=

# Storage — Cloudflare R2
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=onetone-store
NEXT_PUBLIC_CDN_URL=https://cdn.onetone.id

# Google Drive (untuk import fitur)
GOOGLE_PICKER_API_KEY=
GOOGLE_CLIENT_ID=

# Payment
XENDIT_SECRET_KEY=
XENDIT_WEBHOOK_TOKEN=

# Shipping
BITSHIP_API_URL=https://api.biteship.com
BITSHIP_API_KEY=

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000
CRON_SECRET=
```

---

## Current Sprint Focus

**Minggu 1 (Sekarang):**
- [ ] lib/storage.ts — Cloudflare R2 abstraction
- [ ] lib/image-processor.ts — sharp resize/WebP
- [ ] product_images schema & migration
- [ ] Admin upload gambar produk
- [ ] lib/drive-import.ts — Google Drive integration

**Minggu 2:**
- [ ] API audit semua 13+ endpoints
- [ ] Webhook hardening Xendit + Bitship
- [ ] Testing suite

**Minggu 3:**
- [ ] Flutter app skeleton
- [ ] Auth + product catalog Flutter
- [ ] Cart Flutter

**Minggu 4:**
- [ ] Checkout + order Flutter
- [ ] Deploy VPS
- [ ] Client handover

---

## Demo Accounts

| Role | Email | Password |
|------|-------|---------|
| Admin | admin@store.com | password123 |
| Customer | john@example.com | password123 |

---

## Design Principles

- **Mobile-first**: Responsive di semua ukuran
- **Indonesian context**: Rupiah, alamat Indonesia, kurir lokal
- **Fast**: Server Components, minimal client JS
- **Secure**: Semua validasi di server, storage privat
- **Maintainable**: Abstraction layer untuk setiap external service

---

*Dikelola oleh: Wawan (solo developer)*
*AI Tools: Claude.ai Pro (planning), Cline/VSCode (coding), Claude Code CLI (agentic)*
