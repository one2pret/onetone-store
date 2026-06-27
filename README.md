# Next Olshop — NextElektronik

Online Shop single-store untuk UMKM/bisnis personal, dibangun dengan Next.js 16 & Flutter.

**JagoFlutter Academy** — @codewithbahri

## Tech Stack

| Technology | Version | Fungsi |
|------------|---------|--------|
| Next.js | 16 | Framework React fullstack (App Router, Server Actions) |
| React | 19 | UI Library |
| TypeScript | 5 | Type-safe JavaScript |
| Tailwind CSS | 4 | Utility-first styling |
| shadcn/ui | - | UI component library |
| Drizzle ORM | 0.38 | Database ORM |
| MySQL | 8 | Database |
| NextAuth | 5 | Authentication (JWT) |
| Zod | 3.23 | Schema validation |
| Xendit | - | Payment gateway |
| Bitship | - | Shipping aggregator |
| Vitest | - | Unit & integration testing |
| Leaflet | - | Interactive maps |

## Features

### Customer (Shop)
- Homepage dengan banner & produk unggulan
- Katalog produk dengan filter kategori & pencarian
- Detail produk
- Keranjang belanja (Cart)
- Multi-step checkout (Alamat → Kurir → Review & Bayar)
- Manajemen alamat pengiriman dengan peta interaktif
- Pembayaran via Xendit (multi-channel)
- Riwayat pesanan dengan progress stepper
- Countdown pembayaran & bayar ulang (expired order)
- Lacak pengiriman (tracking timeline)
- Register & Login

### Admin Dashboard
- Dashboard statistik (pendapatan, pesanan, produk)
- Kelola Produk (CRUD dengan berat)
- Kelola Kategori
- Kelola Pesanan dengan status machine
- Kirim pesanan ke kurir (Bitship)
- Kelola Banner
- Pengaturan toko (nama, alamat, lokasi peta, kurir aktif)
- Audit log perubahan status

### Order Status Flow
```
waiting_payment → packing → shipping → delivered
       ↓              ↓
    expired       cancelled
       ↓
waiting_payment (bayar ulang)
```

### API Endpoints (untuk Flutter/Mobile)

Auth (Bearer token):
```
POST /api/auth/login            # Login → { token, user }
POST /api/auth/register         # Register
GET  /api/auth/me               # Get current user profile
```

Products & Categories:
```
GET  /api/products              # List (query: category, featured, search, page, limit)
GET  /api/products/[id]         # Detail produk
GET  /api/categories            # Semua kategori
GET  /api/banners               # Banner aktif
```

Cart (auth required):
```
GET  /api/cart                  # Keranjang user
POST /api/cart                  # Tambah { productId, quantity }
PUT  /api/cart/[id]             # Update { quantity }
DELETE /api/cart/[id]           # Hapus item
```

Addresses (auth required):
```
GET  /api/addresses             # List alamat user
POST /api/addresses             # Tambah alamat
GET  /api/addresses/[id]        # Detail alamat
PUT  /api/addresses/[id]        # Update alamat
DELETE /api/addresses/[id]      # Hapus alamat
PUT  /api/addresses/[id]/default # Set alamat utama
```

Shipping (auth required):
```
POST /api/shipping/rates        # Hitung ongkir { addressId }
```

Orders (auth required):
```
GET  /api/orders                # List pesanan (+ items, invoice, shipping)
POST /api/orders                # Buat order dari cart → { paymentUrl }
GET  /api/orders/[id]           # Detail (+ items, invoice, shipping, tracking)
POST /api/orders/[id]/cancel    # Batalkan order
POST /api/orders/[id]/repay     # Bayar ulang → { paymentUrl }
GET  /api/orders/[id]/tracking  # Info tracking
```

Webhooks (internal):
```
POST /api/webhooks/xendit       # Xendit payment callback
POST /api/webhooks/bitship      # Bitship tracking callback
GET  /api/cron/check-expired-orders  # Cron safety net
```

## Getting Started

### Prerequisites
- Node.js 20.9+
- MySQL 8
- pnpm

### Install Dependencies
```bash
pnpm install
```

### Setup Database
```sql
CREATE DATABASE `next-ecommerce-db`;
```

### Setup Environment
```bash
cp .env.example .env.local
# Edit .env.local sesuai konfigurasi
```

Environment variables yang dibutuhkan:
```env
DATABASE_URL=mysql://root:password@localhost:3306/next-ecommerce-db
AUTH_SECRET=your-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
BITSHIP_API_URL=https://api.biteship.com
BITSHIP_API_KEY=your-bitship-key
XENDIT_SECRET_KEY=your-xendit-secret
XENDIT_WEBHOOK_TOKEN=your-xendit-webhook-token
NEXT_PUBLIC_BASE_URL=https://your-ngrok-url  # untuk webhook
CRON_SECRET=your-cron-secret
```

### Push Schema & Seed
```bash
pnpm db:push
pnpm db:seed
```

### Run Development
```bash
pnpm dev
```

Buka http://localhost:3000

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Customer | john@example.com | password123 |
| Admin | admin@store.com | password123 |

## Project Structure

```
next-ecommerce/
├── app/
│   ├── (shop)/              # Customer pages
│   │   ├── page.tsx         # Homepage
│   │   ├── products/        # Katalog & detail
│   │   ├── cart/            # Keranjang
│   │   ├── checkout/        # Multi-step checkout
│   │   ├── orders/          # Riwayat & detail pesanan
│   │   └── addresses/       # Manajemen alamat
│   ├── (auth)/              # Login & Register
│   ├── (admin)/dashboard/   # Admin panel
│   │   ├── products/        # CRUD produk
│   │   ├── categories/      # CRUD kategori
│   │   ├── orders/          # Kelola pesanan
│   │   ├── banners/         # Kelola banner
│   │   └── settings/        # Pengaturan toko
│   ├── api/                 # API Routes & webhooks
│   └── actions/             # Server Actions
├── components/
│   ├── shop/                # Shop components
│   ├── admin/               # Admin components
│   └── ui/                  # shadcn/ui components
├── lib/
│   ├── db/                  # Database schema, seed, connection
│   ├── auth.ts              # NextAuth config
│   ├── bitship.ts           # Bitship API client
│   ├── xendit.ts            # Xendit SDK wrapper
│   ├── stock.ts             # Stock management
│   ├── order-status.ts      # Status machine & transitions
│   └── utils.ts             # Utilities (formatRupiah, formatDate, dll.)
├── tests/                   # Vitest test suites
└── proxy.ts                 # Next.js 16 proxy (middleware)
```

## Testing

```bash
pnpm test           # Run all tests
pnpm test:watch     # Watch mode
```

## Deployment

Lihat [docs/DEPLOY-VPS-UBUNTU.md](docs/DEPLOY-VPS-UBUNTU.md) untuk panduan deploy ke VPS Ubuntu.

```bash
pnpm build
pnpm start
```

---

**JagoFlutter Academy** — @codewithbahri | jagoflutter.com
# next-olshop-system-master
