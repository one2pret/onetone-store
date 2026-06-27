# Mengajar Backend Next Olshop — Panduan Step by Step

> Dokumen ini dibuat untuk membantu mengajar di **JagoFlutter Academy (FIC Batch 24)** dengan tema **"Create Project Backend Next.js untuk Flutter"**.
> Target akhir: peserta bisa membuat backend e-commerce single-store seperti **Next Olshop** yang siap dikonsumsi Flutter app.

---

## Daftar Isi (Urutan Mengajar)

| # | Topik | File | Estimasi |
|---|-------|------|----------|
| 00 | Overview & Arsitektur | [00-overview.md](./00-overview.md) | 15 menit |
| 01 | Setup Project Next.js 16 | [01-setup-project.md](./01-setup-project.md) | 30 menit |
| 02 | Database (MySQL + Drizzle) | [02-database.md](./02-database.md) | 45 menit |
| 03 | Authentication (NextAuth v5) | [03-auth.md](./03-auth.md) | 45 menit |
| 04 | Server Actions (CRUD Produk) | [04-server-actions.md](./04-server-actions.md) | 45 menit |
| 05 | REST API untuk Flutter | [05-api-routes.md](./05-api-routes.md) | 45 menit |
| 06 | Cart & Checkout Flow | [06-cart-orders.md](./06-cart-orders.md) | 60 menit |
| 07 | Payment Gateway (Xendit) | [07-payment-xendit.md](./07-payment-xendit.md) | 45 menit |
| 08 | Shipping API (Bitship) | [08-shipping-bitship.md](./08-shipping-bitship.md) | 45 menit |
| 09 | Testing (Vitest) | [09-testing.md](./09-testing.md) | 30 menit |
| 10 | Deploy ke VPS | [10-deploy.md](./10-deploy.md) | 30 menit |

**Total**: ~7-8 jam materi (bisa dipecah jadi 4-5 sesi @ 2 jam).

---

## Cara Pakai Dokumen Ini

1. **Untuk Pengajar**: ikuti urutan file. Tiap file punya:
   - **Tujuan** sesi
   - **Konsep** (slide-ready, jelaskan dulu)
   - **Live Coding** (step demi step yang harus diketik)
   - **Latihan** (peserta praktek mandiri)
   - **Common Issues** (error yang sering muncul + solusi)

2. **Untuk Peserta**: clone repo final (`next-ecommerce`) sebagai referensi. Tapi **JANGAN copy-paste** — ketik ulang biar paham.

3. **Persiapan Sebelum Kelas**:
   - Node.js 20+ terinstall
   - MySQL running lokal (atau pakai Docker)
   - VS Code + extension: Tailwind CSS IntelliSense, ESLint, Prisma (untuk highlight SQL)
   - Postman/Insomnia/Bruno untuk test API
   - Akun Xendit (dashboard.xendit.co — mode test)
   - Akun Bitship (biteship.com — sandbox API key)

---

## Filosofi Mengajar

- **Build > Theory**: 70% live coding, 30% konsep. Bikin peserta ngetik.
- **Real World**: pakai stack production-grade (Drizzle, NextAuth, Xendit, Bitship). Bukan toy project.
- **Indonesian Context**: harga dalam Rupiah, kurir lokal (JNE, J&T), alamat Indonesia.
- **Type-Safe Everything**: TypeScript strict mode, Zod validation, Drizzle inference.
- **API-First**: backend harus bisa dikonsumsi Flutter app.

---

## Stack yang Akan Diajarkan

```
┌─────────────────────────────────────────┐
│  Flutter App (Mobile)                   │
└─────────────────────────────────────────┘
                  │
                  │ REST API (JSON)
                  ▼
┌─────────────────────────────────────────┐
│  Next.js 16 Backend                     │
│  ├── App Router (Server Components)     │
│  ├── Server Actions (Web Mutations)     │
│  ├── API Routes (Flutter Consumption)   │
│  ├── NextAuth v5 (JWT, Credentials)     │
│  └── Middleware (Route Protection)      │
└─────────────────────────────────────────┘
                  │
        ┌─────────┼──────────┐
        ▼         ▼          ▼
   ┌────────┐ ┌──────┐ ┌──────────┐
   │ MySQL  │ │Xendit│ │ Bitship  │
   │Drizzle │ │ Pay  │ │ Shipping │
   └────────┘ └──────┘ └──────────┘
```

---

## Tips Mengajar

- **Test Account Demo**:
  - Customer: `john@example.com` / `password123`
  - Admin: `admin@store.com` / `password123`

- **Cara Tangani Pertanyaan "Kenapa Pakai X?"**:
  - Drizzle: type-safe, ringan, SQL-first (bukan ORM berat seperti Prisma)
  - NextAuth v5: standar de-facto Next.js auth, edge-compatible
  - Xendit: payment gateway Indonesia paling lengkap (QRIS, e-wallet, VA, retail)
  - Bitship: aggregator kurir Indonesia (JNE, J&T, SiCepat dalam satu API)
  - Server Actions: kurangi boilerplate API route untuk mutasi web

- **Jika Peserta Stuck**:
  - Selalu cek terminal output dulu
  - `pnpm db:studio` untuk inspect database
  - Cek `.env` — paling sering miss env var
  - Network tab browser untuk debug API call

---

## Output Akhir Peserta

Setelah selesai semua sesi, peserta punya:

- [ ] Repo Next.js backend siap deploy
- [ ] 12 tabel database (users, products, orders, payments, shipping, dll)
- [ ] Auth system (register, login, role-based access)
- [ ] 13+ REST API endpoints siap dikonsumsi Flutter
- [ ] Payment integration (Xendit) — bisa terima pembayaran real
- [ ] Shipping integration (Bitship) — bisa cek ongkir & cetak resi
- [ ] Admin dashboard untuk kelola produk & pesanan
- [ ] Project deployed di VPS atau Vercel
