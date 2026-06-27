# Sesi 00 — Overview & Arsitektur

> ⏱️ Estimasi: 15 menit
> 🎯 Tujuan: Peserta paham **apa yang akan dibangun**, **kenapa pakai stack ini**, dan **alur data end-to-end**.

---

## 1. Apa Itu "Next Olshop"?

**Next Olshop** adalah aplikasi online shop **single-store** untuk UMKM/bisnis personal.

> ⚠️ **BUKAN MARKETPLACE** seperti Tokopedia/Shopee — ini satu toko, satu owner, banyak customer.

### Dua Persona
| Role | Hak Akses | Halaman |
|------|-----------|---------|
| **Admin** (owner toko) | Kelola produk, kategori, pesanan, pengiriman, statistik | `/dashboard/*` |
| **Customer** (pembeli) | Belanja, checkout, bayar, lacak pesanan | `/`, `/cart`, `/orders` |

---

## 2. Fitur Utama yang Akan Dibangun

### Customer-Facing
- Landing page + product catalog
- Search & filter produk by kategori
- Cart (tambah, edit qty, hapus)
- Checkout multi-step (alamat → kurir → bayar)
- Riwayat pesanan + tracking
- Repay untuk order expired

### Admin-Facing
- Dashboard statistik (revenue, orders, customers)
- CRUD Produk + Kategori
- Manage Pesanan (update status, kirim ke kurir)
- Manage Banner, Courier, Store Settings

### Integrations
- **Xendit** → terima pembayaran (QRIS, VA, e-wallet, retail)
- **Bitship** → cek ongkir + cetak resi pengiriman

---

## 3. Tech Stack — Kenapa?

| Tools | Alasan |
|-------|--------|
| **Next.js 16** | Full-stack di satu repo (frontend + backend). App Router = modern. Turbopack = fast. |
| **TypeScript** | Type safety. Wajib untuk project skala production. |
| **MySQL + Drizzle** | Drizzle = type-safe ORM, ringan, SQL-first. MySQL = stabil, familiar. |
| **NextAuth v5** | Standard auth library, JWT-based, edge-compatible. |
| **Tailwind CSS 4** | Utility-first, responsive, dev cepat. |
| **Zod** | Schema validation, integrasi mulus dengan TypeScript. |
| **Xendit + Bitship** | Lokal Indonesia, dokumentasi bagus, sandbox gratis. |

---

## 4. Arsitektur — High Level

```
┌──────────────────────────────────────────────────────┐
│                  CLIENTS                             │
│  ┌────────────────┐    ┌────────────────────────┐    │
│  │  Web Browser   │    │   Flutter Mobile App   │    │
│  │  (Customer +   │    │   (Customer Only)      │    │
│  │   Admin)       │    │                        │    │
│  └────────────────┘    └────────────────────────┘    │
└────────┬──────────────────────────┬──────────────────┘
         │                          │
         │ Server Components        │ REST API (JSON)
         │ Server Actions           │
         ▼                          ▼
┌──────────────────────────────────────────────────────┐
│              NEXT.JS 16 BACKEND                      │
│                                                      │
│   ┌─────────────┐   ┌──────────────┐   ┌────────┐    │
│   │ App Router  │   │ Server       │   │  API   │    │
│   │ (Pages)     │   │ Actions      │   │ Routes │    │
│   │             │   │ (Mutations)  │   │(/api)  │    │
│   └─────────────┘   └──────────────┘   └────────┘    │
│                                                      │
│   ┌────────────────────────────────────────────────┐ │
│   │ Middleware (Auth, Route Protection)            │ │
│   └────────────────────────────────────────────────┘ │
│                                                      │
│   ┌────────────────────────────────────────────────┐ │
│   │ Libraries: Drizzle, NextAuth, Zod, Xendit, ... │ │
│   └────────────────────────────────────────────────┘ │
└────────┬─────────────┬─────────────┬─────────────────┘
         │             │             │
         ▼             ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌────────────┐
   │  MySQL  │  │  Xendit  │  │  Bitship   │
   │   DB    │  │   API    │  │    API     │
   └─────────┘  └──────────┘  └────────────┘
```

### Aturan Penting
- **Web App (Browser)** → pakai **Server Actions** untuk mutasi
- **Flutter App** → pakai **REST API Routes** (`/api/*`)
- **Webhook dari Xendit/Bitship** → masuk ke `/api/webhooks/*`

---

## 5. Alur Bisnis (User Journey)

### Alur Belanja Customer
```
Browse Produk → Add to Cart → Checkout
                              ├── Pilih Alamat
                              ├── Pilih Kurir (cek ongkir Bitship)
                              └── Pilih Bayar (buat invoice Xendit)
                              ▼
                              Bayar di Xendit Page
                              ▼
                              Webhook Xendit → Order jadi "packing"
                              ▼
                              Admin Kirim ke Bitship → Order jadi "shipping"
                              ▼
                              Webhook Bitship "delivered" → Order selesai
```

### Order Status Machine
```
                 ┌── expired ──┐ (repay)
                 │             │
waiting_payment ─┼── packing ──┼──> shipping ──> delivered ✓
                 │             │
                 └── cancelled │ (any non-terminal)
                               └──> cancelled ✗
```

---

## 6. Struktur Folder

```
next-ecommerce/
├── app/
│   ├── (shop)/          ← Customer pages
│   ├── (auth)/          ← Login & Register
│   ├── (admin)/         ← Admin dashboard
│   ├── api/             ← REST API + webhooks
│   └── actions/         ← Server Actions
├── components/
│   ├── shop/            ← Customer UI
│   ├── admin/           ← Admin UI
│   └── ui/              ← shadcn/ui base
├── lib/
│   ├── db/              ← Drizzle schema, connection, seed
│   ├── auth.ts          ← NextAuth config
│   ├── utils.ts         ← formatRupiah, formatDate, dll
│   ├── xendit.ts        ← Payment wrapper
│   └── bitship.ts       ← Shipping wrapper
└── middleware.ts        ← Auth middleware
```

---

## 7. Roadmap Kelas

| Sesi | Topik | Output |
|------|-------|--------|
| 01 | Setup Project | Next.js running di `localhost:3000` |
| 02 | Database | 12 tabel + seed data |
| 03 | Auth | Login/register working, middleware protect routes |
| 04 | Server Actions | CRUD produk dari admin dashboard |
| 05 | REST API | 13+ endpoints untuk Flutter |
| 06 | Cart & Orders | Customer bisa checkout end-to-end |
| 07 | Xendit | Invoice generation + webhook handler |
| 08 | Bitship | Cek ongkir + cetak resi |
| 09 | Testing | Vitest setup + 30+ tests |
| 10 | Deploy | Live di VPS Ubuntu |

---

## 8. Demo Aplikasi Final (Tampilkan Sebelum Mulai!)

**WAJIB**: tunjukkan demo aplikasi yang sudah jadi sebelum mulai coding.

```bash
# Pengajar buka:
- http://localhost:3000           ← shop
- http://localhost:3000/dashboard ← admin (login: admin@store.com / password123)
- Postman collection              ← API endpoints
- Flutter app                     ← konsumsi API
```

**Tujuan demo**: peserta lihat **finished product**, jadi tahu **kenapa belajar materi ini**.

---

## 9. Yang Perlu Disiapkan Peserta

Sebelum sesi pertama, pastikan peserta sudah:

- [ ] Install Node.js 20+ (cek: `node -v`)
- [ ] Install pnpm (`npm i -g pnpm`)
- [ ] Install MySQL (atau Docker MySQL)
- [ ] Install VS Code + extension Tailwind CSS IntelliSense
- [ ] Install Postman/Bruno
- [ ] Buat akun Xendit (dashboard.xendit.co) — ambil **test** API key
- [ ] Buat akun Bitship (biteship.com) — ambil **test** API key
- [ ] Clone repo referensi: `git clone <next-ecommerce-repo>`

---

## ➡️ Lanjut ke [Sesi 01 — Setup Project](./01-setup-project.md)
