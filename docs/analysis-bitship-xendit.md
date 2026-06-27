# Analisis Integrasi Bitship & Xendit — Next Olshop

> Dokumen analisis berdasarkan studi kode MySCI Storefront & MySCI Admin

---

## 1. Kondisi Saat Ini (Next Olshop)

### Order Flow Sekarang
```
Add to Cart → Cart Page → Checkout Form → Create Order → Order Detail
```

### Masalah Utama
| Area | Kondisi Sekarang | Target |
|------|-----------------|--------|
| **Shipping** | Fixed Rp15.000 | Dinamis via Bitship (pilih kurir) |
| **Payment** | Manual (COD/Transfer) | Online payment via Xendit |
| **Tracking** | Tidak ada | Real-time tracking via Bitship webhook |
| **Status** | Manual update oleh admin | Otomatis via webhook Xendit & Bitship |

### Database Schema Sekarang
- `orders`: ada `shippingCost`, `paymentMethod` (cod/transfer), `paymentStatus` (unpaid/paid)
- `order_items`: items per order
- **Tidak ada**: tabel shipping, invoice, shipping_histories, couriers

### Tech Stack
- Next.js 16, MySQL + Drizzle ORM, NextAuth v5
- Belum ada: `xendit-node` SDK, Bitship API client

---

## 2. Referensi: MySCI Storefront (Bitship + Xendit)

### 2.1 Bitship Integration

**Config:**
```typescript
// src/config.ts
export const biteshipUrl = process.env.BITESHIP_URL!; // https://api.biteship.com/v1
export const biteshipAPI = process.env.NEXT_PUBLIC_API_BITESHIP!; // API key
```

**3 Endpoint Bitship yang Dipakai:**

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/rates/couriers` | POST | Cek ongkir & pilihan kurir |
| `/orders` | POST | Buat order pengiriman |
| `/trackings/{id}` | GET | Ambil status tracking |

**Flow Cek Ongkir (Bitship Rates):**
```
Request:
{
  origin_latitude, origin_longitude,     // Lokasi toko
  destination_latitude, destination_longitude,  // Alamat customer
  couriers: "jne,grab,gojek",           // Kurir aktif
  items: [{ weight, quantity }]          // Berat total
}

Response:
{
  pricing: [{
    courier_name, company, price,
    shipment_duration_range, shipment_duration_unit,
    type  // service type
  }]
}
```

**Kategorisasi Ongkir (MySCI Logic):**
- **EXPRESS**: Durasi tercepat
- **REGULAR**: Balance antara harga dan kecepatan
- **ECONOMY**: Harga termurah
- Di-cache ke tabel `order_draft_shippings`

**Flow Buat Order Bitship:**
```typescript
const requestBody = {
  origin_contact_name: store.name,
  origin_contact_phone: store.phone,
  origin_address: store.address,
  origin_coordinate: { latitude, longitude },
  destination_contact_name: address.name,
  destination_contact_phone: address.phone,
  destination_address: address.full,
  destination_coordinate: { latitude, longitude },
  courier_company: selectedCourier.company,
  courier_type: selectedCourier.type,
  delivery_type: "now",
  reference_id: orderId,
  items: [{ name, weight, quantity, value, sku }]
};
// Response: { id, trackingId, waybillId, status }
```

**Bitship Webhook (Tracking Update):**
```
POST /api/orders/status  ← webhook dari Bitship

Event body:
{
  event: "order.status",
  order_id, courier_tracking_id, courier_waybill_id,
  courier_company, courier_type, courier_driver_name,
  courier_driver_phone, courier_link,
  status: "confirmed"|"picking_up"|"delivered"|"cancelled"|...,
  updated_at
}
```

**Status Mapping Bitship → Order:**
| Bitship Status | Order Status |
|---------------|-------------|
| confirmed, scheduled, allocated, picking_up, picked, on_hold, dropping_off | SHIPPING |
| cancelled, return_in_transit, returned, rejected, disposed, courier_not_found | CANCELLED |
| delivered | DELIVERED |

### 2.2 Xendit Integration

**SDK:**
```typescript
import { Xendit } from "xendit-node"; // v7.0.0
export const xendit = new Xendit({ secretKey: process.env.NEXT_PUBLIC_API_XENDIT! });
```

**Flow Create Invoice:**
```typescript
const { Invoice } = xendit;
const invoice = await Invoice.createInvoice({
  data: {
    amount: totalPrice,
    currency: "IDR",
    externalId: orderId,
    successRedirectUrl: "/account/orders?tab=processed",
    failureRedirectUrl: "/account/orders?tab=failed",
    invoiceDuration: expiredHours * 3600, // dalam detik
  }
});
// Response: { id, invoiceUrl, status }
```

**Xendit Webhook (Payment Callback):**
```
POST /api/checkout/payment-status  ← webhook dari Xendit

Body:
{
  external_id: orderId,
  payment_method: "BANK_TRANSFER"|"EWALLET"|"CREDIT_CARD"|"QR_CODE",
  status: "PAID"|"EXPIRED",
  payment_channel: "BRI"|"DANA"|"GOPAY"|"QRIS"|...,
  paid_at: "ISO timestamp"
}
```

**Payment Status Flow:**
```
PENDING → PAID    → order status: PACKING
PENDING → EXPIRED → order status: EXPIRED (+ email notifikasi)
```

**Metode Pembayaran yang Didukung Xendit:**
- **Bank Transfer**: BRI, BCA, BNI, Mandiri, BSI, CIMB, Permata, dll
- **E-Wallet**: GoPay, OVO, DANA, ShopeePay, LinkAja
- **QR Code**: QRIS
- **Kartu Kredit**: Visa, Mastercard

### 2.3 Database Schema (MySCI)

**orders:**
```
id, userId, status (WAITING_PAYMENT|PACKING|SHIPPING|DELIVERED|EXPIRED|CANCELLED),
productPrice, shippingPrice, totalDiscount, totalPrice, note,
willExpired, shippingAt, cancelledAt, expiredAt, paidAt, deliveredAt
```

**invoices:**
```
id, orderId, paymentId (xendit), paymentChannel, paymentMethod, amount,
status (PENDING|PAID|EXPIRED|CANCELLED), expiredAt, paidAt, cancelledAt
```

**shippings:**
```
id, orderId, name, phone, address, address_note, latitude, longitude,
trackingId (bitship), waybillId, collectionMethod,
courierName, courierCompany, courierType,
price, fastestEstimate, longestEstimate, duration (HOUR|DAY),
status (15 status dari Bitship)
```

**shipping_histories:**
```
id, shippingId, status, note, serviceType, updatedAt
```

**couriers:**
```
id, name, value, isActive
```

---

## 3. Referensi: MySCI Admin

### Admin Order Actions
| Status Order | Aksi Admin |
|-------------|-----------|
| WAITING_PAYMENT | "Mark as Paid" / "Cancel Order" |
| PACKING | "Send Order" (→ Bitship) / "Cancel Order" |
| SHIPPING | View tracking only |
| DELIVERED | View only |

### Admin "Send Order" Flow
1. Admin klik "Send Order" pada order status PACKING
2. System ambil data alamat, kurir, dan items
3. Call Bitship `POST /orders` → dapat trackingId, waybillId
4. Call Bitship `GET /trackings/{trackingId}` → dapat history awal
5. Insert ke tabel `shippings` dan `shipping_histories`
6. Update order status → SHIPPING

### Admin Settings: Shipping
- **Payment Expiration**: 1-24 jam sebelum expired
- **Store Address**: Manual input atau parse Google Maps URL
- **Available Couriers**: Toggle aktif/nonaktif per kurir (dengan logo)

### Admin Generate Invoice PDF
- Menggunakan `@react-pdf/renderer`
- Data: order detail, items, shipping, payment method/channel

---

## 4. Complete Flow Diagram (Target untuk Next Olshop)

```
┌─────────────────────────────────────────────────────────────────┐
│                     CUSTOMER FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. BROWSE & ADD TO CART                                         │
│     /products → /cart                                            │
│                                                                  │
│  2. CHECKOUT                                                     │
│     /checkout                                                    │
│     ├── Isi alamat pengiriman (nama, telp, alamat lengkap)      │
│     ├── Pilih kurir → call Bitship /rates/couriers              │
│     │   └── Tampilkan: EXPRESS / REGULAR / ECONOMY + harga      │
│     ├── Review order summary                                     │
│     └── Klik "Bayar Sekarang"                                   │
│                                                                  │
│  3. CREATE ORDER + XENDIT INVOICE                                │
│     Server Action:                                               │
│     ├── Validate stock                                           │
│     ├── Calculate total (product + shipping)                     │
│     ├── Create Xendit invoice → dapat invoiceUrl                │
│     ├── Insert: order, order_items, shipping, invoice            │
│     ├── Deduct stock, clear cart                                 │
│     └── Return payment_url                                       │
│                                                                  │
│  4. PAYMENT                                                      │
│     Redirect ke Xendit checkout page                             │
│     Customer pilih metode: Bank Transfer / E-Wallet / QRIS      │
│     ├── Bayar → Xendit webhook: PAID → order = PACKING          │
│     └── Expired → Xendit webhook: EXPIRED → order = EXPIRED     │
│                                                                  │
│  5. TRACKING                                                     │
│     /orders/[id]                                                 │
│     └── Tampilkan timeline tracking dari shipping_histories      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                      ADMIN FLOW                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ORDER MASUK (WAITING_PAYMENT)                                │
│     └── Tunggu Xendit webhook, atau "Mark as Paid" manual       │
│                                                                  │
│  2. ORDER PAID (PACKING)                                         │
│     └── Admin klik "Kirim Order"                                │
│         ├── Call Bitship POST /orders                            │
│         ├── Dapat trackingId + waybillId                         │
│         └── Order status → SHIPPING                              │
│                                                                  │
│  3. SHIPPING                                                     │
│     └── Bitship webhook auto update status & history             │
│                                                                  │
│  4. DELIVERED                                                    │
│     └── Bitship webhook: delivered → order = DELIVERED           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                     WEBHOOK HANDLERS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  POST /api/webhooks/xendit                                       │
│  └── Update invoice status + order status                        │
│                                                                  │
│  POST /api/webhooks/bitship                                      │
│  └── Update shipping status + insert history + update order      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Gap Analysis: Next Olshop vs Target

### Schema Changes
| Perubahan | Detail |
|----------|--------|
| **Tabel baru: `shippings`** | orderId, name, phone, address, trackingId, waybillId, courierName, courierCompany, courierType, price, estimateDays, status |
| **Tabel baru: `shipping_histories`** | shippingId, status, note, serviceType, updatedAt |
| **Tabel baru: `invoices`** | orderId, xenditPaymentId, paymentChannel, paymentMethod, amount, status, expiredAt, paidAt |
| **Tabel baru: `couriers`** | name, value, isActive |
| **Tabel baru: `store_settings`** | key-value untuk alamat toko, lat/lng, payment expiration |
| **Update: `orders`** | Hapus paymentMethod/paymentStatus, tambah willExpired, paidAt, deliveredAt, shippingAt. Ubah status enum. |
| **Update: `users`** | Mungkin perlu latitude, longitude untuk alamat |

### New Dependencies
```
xendit-node ^7.0.0    # Xendit SDK
```
> Bitship tidak butuh SDK — cukup `fetch()` ke REST API

### New Environment Variables
```env
# Xendit
XENDIT_SECRET_KEY=xnd_development_xxx
XENDIT_CALLBACK_URL=https://yourdomain.com/api/webhooks/xendit
XENDIT_SUCCESS_REDIRECT=https://yourdomain.com/orders
XENDIT_FAILURE_REDIRECT=https://yourdomain.com/orders

# Bitship
BITSHIP_API_URL=https://api.biteship.com/v1
BITSHIP_API_KEY=your-bitship-api-key
BITSHIP_WEBHOOK_URL=https://yourdomain.com/api/webhooks/bitship

# Store
STORE_LATITUDE=-6.200000
STORE_LONGITUDE=106.816666
STORE_ADDRESS="Jl. Contoh No. 1, Jakarta"
STORE_PHONE="08123456789"
STORE_NAME="Next Olshop"
PAYMENT_EXPIRY_HOURS=24
```

### Files yang Harus Dibuat/Diubah
| File | Aksi |
|------|------|
| `lib/db/schema.ts` | Update schema (orders, tambah 4 tabel baru) |
| `lib/bitship.ts` | **Baru** — Bitship API client (rates, create order, tracking) |
| `lib/xendit.ts` | **Baru** — Xendit client (create invoice) |
| `app/actions/orders.ts` | **Update** — revamp createOrder, tambah shipping logic |
| `app/actions/shipping.ts` | **Baru** — getShippingRates, dll |
| `app/api/webhooks/xendit/route.ts` | **Baru** — Xendit payment callback |
| `app/api/webhooks/bitship/route.ts` | **Baru** — Bitship tracking webhook |
| `app/(shop)/checkout/page.tsx` | **Update** — tambah pilihan kurir |
| `app/(shop)/checkout/CheckoutForm.tsx` | **Update** — multi-step checkout |
| `app/(shop)/orders/[id]/page.tsx` | **Update** — tambah tracking timeline |
| `app/(admin)/dashboard/orders/[id]/page.tsx` | **Update** — tambah "Kirim Order" button |
| `app/(admin)/dashboard/settings/page.tsx` | **Baru** — store settings, kurir management |
| `components/shop/ShippingOptions.tsx` | **Baru** — UI pilihan kurir |
| `components/shop/TrackingTimeline.tsx` | **Baru** — UI tracking history |
| `components/admin/SendOrderButton.tsx` | **Baru** — trigger Bitship order |

---

## 6. Perbedaan Teknis: MySCI vs Next Olshop

| Aspek | MySCI | Next Olshop |
|-------|-------|-------------|
| Database | PostgreSQL | MySQL |
| ORM | Drizzle (pg-core) | Drizzle (mysql-core) |
| ID Generation | CUID2 (@paralleldrive/cuid2) | Auto-increment int |
| Auth | NextAuth v5 + JWT custom | NextAuth v5 Credentials |
| API Style | REST di route handlers | Server Actions + REST API |
| Schema Enum | pgEnum() | mysqlEnum() |
| Decimal | numeric(precision, scale) | decimal(precision, scale) |
| Package Manager | Bun | pnpm |

**Adaptasi yang Perlu:**
- `pgTable` → `mysqlTable` (sudah pakai)
- `pgEnum` → `mysqlEnum` (sudah pakai)
- `numeric()` → `decimal()` (sudah pakai)
- `text("id").$defaultFn(cuid2)` → tetap pakai `int auto_increment` atau beralih ke CUID
- Hapus referensi PostgreSQL-specific (jika ada)
