# Analisis MYSCI sebagai Referensi FIC Batch 24

## Daftar Isi
1. [Overview Arsitektur MYSCI](#1-overview-arsitektur-mysci)
2. [Analisis mysci-admin](#2-analisis-mysci-admin)
3. [Analisis mysci-storefront](#3-analisis-mysci-storefront)
4. [Perbandingan Tech Stack](#4-perbandingan-tech-stack)
5. [Pisah vs Gabung: Rekomendasi](#5-pisah-vs-gabung-rekomendasi)
6. [Relevansi untuk FIC Batch 24](#6-relevansi-untuk-fic-batch-24)
7. [Kesimpulan & Rekomendasi Final](#7-kesimpulan--rekomendasi-final)

---

## 1. Overview Arsitektur MYSCI

MYSCI (Inside Sehat Cerah Indonesia) adalah platform e-commerce pet supply/veterinary yang dibangun dengan arsitektur **2-app split**:

| Aspek | mysci-admin | mysci-storefront |
|-------|-------------|-----------------|
| Fungsi | Dashboard admin | Toko customer-facing |
| Port | 3001 | 3000 |
| Pages | ~15 pages | ~27 pages |
| API Routes | ~30 routes | ~79 routes |
| DB Schema | 57 tables (shared) | 45 tables (shared) |
| Package Manager | Bun | Bun |

Kedua project **share database PostgreSQL yang sama** dan **share schema Drizzle ORM yang hampir identik**.

---

## 2. Analisis mysci-admin

### Tech Stack
```
Framework    : Next.js 16.1.6 + React 19
Language     : TypeScript 5 (strict)
Database     : PostgreSQL + Drizzle ORM 0.44
Auth         : NextAuth v5 beta + Argon2 + JWT
UI           : shadcn/ui (39 komponen) + Radix UI + Tailwind CSS 4
State        : TanStack React Query + nuqs (URL state)
Tables       : TanStack React Table
Rich Editor  : TipTap
Charts       : Recharts
Export       : ExcelJS + @react-pdf/renderer
File Upload  : Cloudflare R2 (S3-compatible)
Email        : Nodemailer + React Email
Icons        : Lucide React
Animations   : Motion (framer-motion successor)
```

### Arsitektur & Pattern

**Folder Structure (per feature):**
```
src/app/(dashboard)/customers/
  ├── page.tsx              → Server Component (auth check + metadata)
  ├── _api/                 → React Query hooks (useGetCustomers, useDeleteCustomer, dll)
  ├── _components/
  │   ├── client.tsx        → Main client component (state + UI)
  │   ├── _loading/         → Skeleton loaders
  │   ├── _dialog/          → Modal forms
  │   └── _section/         → Sub-sections
  └── [customerId]/
      └── page.tsx          → Detail page
```

**Data Fetching Pattern:**
```
Server Component (page.tsx)
  → auth() check
  → pass props to Client Component

Client Component (client.tsx)
  → useApiQuery() ← TanStack Query + axios → API Route
  → useQueryStates() ← nuqs → URL search params
  → useMutate() → POST/PUT/DELETE
```

**API Route Pattern:**
```typescript
// GET /api/admin/customers
export async function GET(req: Request) {
  const isAuth = await auth();
  if (!isAuth) return errorRes("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  // ... complex filtering, joins, pagination
  return successRes({ data, pagination, option });
}
```

### Kelebihan mysci-admin
1. **Feature-based folder structure** — setiap modul punya `_api/`, `_components/`, `_loading/`
2. **Reusable query hooks** — `useApiQuery`, `useMutate` wrapper
3. **URL state management** — filter/sort/pagination disimpan di URL (bookmarkable, shareable)
4. **Advanced Drizzle queries** — subquery, aggregation, groupBy, having
5. **Custom pagination** — `fastPaginate()` utility yang efisien
6. **Export system** — PDF + Excel report generation
7. **Rich text editor** — TipTap integration
8. **Type-safe end-to-end** — Drizzle schema → API response → React Query → UI

### Kekurangan
1. **Tidak ada testing** — zero tests
2. **Tidak ada `.env.example`** — developer baru sulit setup
3. **Banyak dependencies** — 60+ packages, heavy bundle
4. **Complex untuk pemula** — terlalu banyak abstraksi
5. **Duplikasi schema** — schema Drizzle di-copy ke 2 project

---

## 3. Analisis mysci-storefront

### Tech Stack
```
Framework    : Next.js 16.1.6 + React 19
Language     : TypeScript 5 (strict)
Database     : PostgreSQL + Drizzle ORM 0.44
Auth         : NextAuth v5 beta + Argon2 + JWT + Google OAuth
UI           : shadcn/ui (31 komponen) + Radix UI + Tailwind CSS 4
State        : TanStack React Query + nuqs
Payment      : Xendit (xendit-node)
Shipping     : Biteship API
File Upload  : Cloudflare R2 (S3-compatible)
Email        : Nodemailer + React Email
Maps         : Google Maps API
Carousel     : Embla Carousel
```

### Arsitektur & Pattern

**Route Groups:**
```
src/app/
  ├── (auth)/          → sign-in, sign-up, forgot-password, verify-otp
  ├── (main)/          → products, cart, checkout, account, orders
  └── api/
      ├── (web)/       → API untuk web client
      └── mobile/      → API untuk mobile client (Flutter)
```

**Dual API:** Storefront menyediakan 2 set API routes:
- `/api/(web)/*` — digunakan oleh web frontend sendiri
- `/api/mobile/*` — digunakan oleh Flutter app

### Kelebihan mysci-storefront
1. **Dual API support** — satu codebase serve web + mobile
2. **Payment integration** — Xendit payment gateway terintegrasi
3. **Shipping integration** — Biteship untuk kalkulasi ongkir
4. **Google OAuth** — social login support
5. **OTP verification** — email verification flow
6. **React Compiler** — `reactCompiler: true` di next.config
7. **Server Actions** — untuk Biteship integration (create-order, get-tracking)

### Kekurangan
1. **Tidak ada testing** — sama seperti admin
2. **79 API routes** — sangat banyak, sulit maintain
3. **Schema duplikasi** — copy-paste dari admin
4. **README broken** — ada merge conflict markers
5. **Mixed patterns** — kadang Server Actions, kadang API routes, kadang direct query

---

## 4. Perbandingan Tech Stack

### MYSCI vs Next Olshop (FIC24)

| Aspek | MYSCI (Admin + Storefront) | Next Olshop (FIC24) |
|-------|---------------------------|---------------------|
| **Database** | PostgreSQL + Drizzle | MySQL + Drizzle |
| **Auth** | NextAuth v5 + Argon2 | NextAuth v5 + bcryptjs |
| **UI Library** | shadcn/ui (39 komponen) | Custom components |
| **State** | React Query + nuqs | Server Components (no client state lib) |
| **Data Table** | TanStack React Table | Manual `<table>` |
| **Forms** | Manual useState | useActionState (React 19) |
| **Data Fetching** | React Query + axios → API Routes | Server Actions (direct) |
| **Payment** | Xendit | Belum |
| **Shipping** | Biteship | Fixed 15,000 |
| **File Upload** | Cloudflare R2 | Belum |
| **Package Manager** | Bun | pnpm |
| **Testing** | Tidak ada | Vitest (63 tests) |
| **Total Deps** | ~80 packages | ~15 packages |
| **Complexity** | Tinggi (production) | Rendah (educational) |

### Packages yang Bisa Diadopsi untuk FIC24

**Recommended (worth teaching):**
| Package | Fungsi | Alasan |
|---------|--------|--------|
| `shadcn/ui` | UI components | Industry standard, reusable, accessible |
| `@tanstack/react-table` | Data tables | Sorting, filtering, pagination built-in |
| `nuqs` | URL state | Clean pattern, shareable URLs |
| `sonner` | Toast notifications | Simple, elegant |
| `recharts` | Charts | Dashboard analytics |
| `react-dropzone` | File upload | Standard approach |

**Not Recommended for FIC24:**
| Package | Alasan |
|---------|--------|
| `@tanstack/react-query` | Overkill — Server Actions + `revalidatePath` sudah cukup |
| `axios` | Tidak perlu — native `fetch` + Server Actions |
| `@tiptap/*` | Terlalu complex untuk course |
| `motion` | Nice-to-have, bukan essential |
| `xendit-node` | Perlu akun bisnis, sulit untuk siswa |
| `@aws-sdk/client-s3` | Complex setup, pakai local upload dulu |
| `argon2` | bcryptjs lebih simple dan portable |

---

## 5. Pisah vs Gabung: Rekomendasi

### Opsi A: Pisah 2 Project (Seperti MYSCI)

```
next-olshop-admin/       → Admin dashboard
next-olshop-storefront/  → Customer toko
```

**Kelebihan:**
- Deployment independen (admin bisa di-deploy terpisah)
- Tim bisa kerja paralel tanpa konflik
- Bundle size lebih kecil per-app
- Security: admin tidak exposed ke publik
- Scaling: admin traffic << storefront traffic

**Kekurangan:**
- **Schema duplikasi** — harus sync manual (MYSCI punya masalah ini)
- **2x setup** — 2 repo, 2 deployment, 2 CI/CD
- **Shared code sulit** — utils, types, schema harus di-copy atau pakai monorepo
- **Lebih complex** untuk course (siswa harus manage 2 project)
- **Auth terpisah** — 2 session management
- **Cost 2x** — 2 server/hosting

### Opsi B: Gabung 1 Project (Seperti Next Olshop sekarang)

```
next-olshop/
  app/
    (shop)/          → Customer pages
    (admin)/         → Admin pages (under /dashboard/*)
    api/             → Shared API routes
```

**Kelebihan:**
- **1 schema, 1 source of truth** — tidak ada duplikasi
- **Shared utilities** — types, utils, auth di satu tempat
- **1 deployment** — lebih murah, lebih simple
- **Easier to teach** — siswa fokus di 1 project
- **Code reuse** — components, actions bisa di-share
- **Consistent auth** — 1 session, role-based routing

**Kekurangan:**
- Bundle size sedikit lebih besar
- Admin + customer di 1 domain (tapi route protection via middleware sudah handle ini)
- Jika traffic tinggi, scaling kurang fleksibel

### Verdict: **GABUNG (1 Project) untuk FIC24**

Alasan utama:
1. **Educational context** — siswa belajar lebih efektif dengan 1 codebase
2. **No schema duplication** — problem terbesar MYSCI adalah sync schema
3. **Next.js route groups** sudah solve separation concern: `(shop)` vs `(admin)`
4. **Middleware** handle auth/role protection dengan baik
5. **Real-world relevance** — banyak startup UMKM pakai 1 app (Shopify pattern)
6. **Time constraint** — 16 sesi, 2 bulan. 2 project = tidak cukup waktu

**Untuk production scale-up nanti**, bisa dipecah ke monorepo (Turborepo) jika diperlukan.

---

## 6. Relevansi untuk FIC Batch 24

### Apakah MYSCI Bagus untuk Referensi?

**Score: 7/10** — Bagus sebagai referensi arsitektur, tapi **TIDAK cocok** sebagai template langsung.

#### Yang Bisa Diadopsi:

| Pattern MYSCI | Adaptasi untuk FIC24 |
|---------------|---------------------|
| Feature-based folder (`_api/`, `_components/`) | Adopt untuk admin pages |
| `successRes`/`errorRes` helper | Sudah mirip di Next Olshop |
| URL state management (nuqs) | Bisa ditambahkan di Phase 2 |
| shadcn/ui components | Adopt untuk UI consistency |
| Data table pattern | Adopt TanStack React Table |
| Export PDF/Excel | Nice-to-have di akhir course |

#### Yang TIDAK Cocok:

| Pattern MYSCI | Alasan Tidak Cocok |
|---------------|-------------------|
| React Query + axios → API Routes | Unnecessary indirection. Server Actions lebih direct |
| 80+ dependencies | Terlalu berat untuk learning |
| Bun package manager | pnpm lebih mainstream untuk learning |
| Argon2 | Butuh native compilation, bcryptjs lebih portable |
| Dual API (web + mobile) | Overengineering untuk course |
| No testing | Next Olshop sudah lebih baik di aspek ini |

### Rekomendasi Roadmap Adopsi

**Sesi 1-8 (Fondasi):** Tetap pakai pattern Next Olshop yang sudah ada
- Server Components + Server Actions (bukan React Query + API routes)
- Manual tables (belajar fundamental dulu)
- bcryptjs + NextAuth basic

**Sesi 9-12 (Enhancement):** Mulai adopt beberapa pattern MYSCI
- Install shadcn/ui untuk UI polish
- Tambahkan TanStack React Table untuk admin
- nuqs untuk filter URL state
- sonner untuk toast notifications

**Sesi 13-16 (Advanced):** Production-level features
- Image upload (local disk atau Cloudflare R2)
- Recharts untuk dashboard analytics
- Export PDF sederhana
- API routes untuk Flutter consumption

---

## 7. Kesimpulan & Rekomendasi Final

### TL;DR

| Pertanyaan | Jawaban |
|-----------|---------|
| MYSCI bagus untuk referensi? | **Ya**, tapi sebagai inspirasi arsitektur, bukan template langsung |
| Pisah atau gabung? | **Gabung** (1 project) untuk FIC24 — lebih efisien untuk learning |
| Next Olshop pattern sudah benar? | **Ya** — Server Actions approach lebih simple & modern |
| Packages yang perlu ditambah? | shadcn/ui, sonner, nuqs (Phase 2 course) |

### Perbandingan Approach

```
MYSCI Approach:
  Client Component → useApiQuery() → axios → API Route → Drizzle → DB
  (4 layers, complex, tapi flexible)

Next Olshop Approach:
  Server Component → Server Action → Drizzle → DB
  (2 layers, simple, direct, recommended by Next.js team)
```

Next Olshop sudah menggunakan approach yang **direkomendasikan oleh Vercel/Next.js team**: Server Components + Server Actions. MYSCI masih menggunakan pattern lama (API routes + React Query) yang lebih cocok untuk SPA, bukan untuk Server Components era.

### Action Items untuk FIC24

1. **Keep** arsitektur Next Olshop yang sudah ada (gabung, Server Actions)
2. **Adopt** shadcn/ui untuk UI components (sesi 9+)
3. **Adopt** sonner untuk toast notifications
4. **Reference** MYSCI untuk:
   - Feature-based folder structure di admin
   - Export PDF/Excel pattern
   - Payment gateway integration pattern (Xendit)
   - Shipping API integration pattern (Biteship)
5. **Ignore** MYSCI's React Query + axios pattern (unnecessary untuk Next.js 16)
6. **Keep** testing advantage Next Olshop punya (MYSCI zero tests)

---

*Dokumen ini ditulis sebagai analisis arsitektur untuk keputusan teknis FIC Batch 24 — JagoFlutter Academy.*
*Terakhir diupdate: 25 April 2026*
