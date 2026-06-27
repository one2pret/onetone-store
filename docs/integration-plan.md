# Integration Plan: Bitship & Xendit — Next Olshop

> Plan integrasi shipping (Bitship) dan payment (Xendit) ke Next Olshop
> Referensi: MySCI Storefront & MySCI Admin

---

## Overview

**Objective**: Transformasi Next Olshop dari basic order flow (fixed shipping + manual payment) menjadi full e-commerce flow dengan:
- Pilihan kurir dinamis via **Bitship API**
- Online payment via **Xendit Invoice**
- Real-time tracking via **Bitship Webhook**
- Auto payment status via **Xendit Webhook**

**Estimasi Total**: 8 Phase (Phase 0–7)

> **UPDATE**: Plan ini sudah direvisi berdasarkan analisis mendalam kedua.
> Lihat `docs/missing-flows.md` untuk detail gap analysis.
> Perubahan utama: Address Management, Stock Restoration, Status Validation,
> Webhook Security, Payment Expiration Checker, Customer Cancel, Repayment Flow.

---

## Phase 0: Prerequisites — Data Fondasi untuk Shipping

> **WAJIB selesai duluan** — Tanpa ini, Bitship tidak bisa menghitung ongkir.
> Bitship `POST /rates/couriers` butuh: origin (lat/lng toko), destination (lat/lng customer), dan weight (berat produk).

### Gap yang Harus Ditutup

| Data yang Dibutuhkan | Kondisi Sekarang | Solusi |
|---------------------|-----------------|--------|
| **Origin latitude** | Tidak ada | Tabel `store_settings` + admin page |
| **Origin longitude** | Tidak ada | Tabel `store_settings` + admin page |
| **Origin address** | Tidak ada | Tabel `store_settings` + admin page |
| **Origin phone** | Tidak ada | Tabel `store_settings` + admin page |
| **Destination latitude** | Tidak ada (`users.address` cuma text) | Tambah field `latitude`, `longitude` di `users` ATAU buat tabel `addresses` |
| **Destination longitude** | Tidak ada | Sama seperti di atas |
| **Product weight** | Tidak ada field `weight` di `products` | Tambah field `weight` (gram) ke tabel `products` |
| **Available couriers** | Tidak ada | Tabel `couriers` + seed data + admin toggle |

### Checklist

- [x] **0.1** Tambah field `weight` ke tabel `products`
  ```typescript
  // di schema.ts — products table
  weight: int('weight').notNull().default(500), // berat dalam gram, default 500g
  ```
  > Bitship butuh berat item untuk hitung ongkir. Tanpa ini, tidak bisa call `/rates/couriers`.

- [x] **0.2** ~~Tambah lat/lng ke users~~ → **Buat tabel `addresses` (Buku Alamat)**
  ```typescript
  export const addresses = mysqlTable('addresses', {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id').notNull().references(() => users.id),
    label: varchar('label', { length: 50 }).notNull(),     // "Rumah", "Kantor"
    recipientName: varchar('recipient_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    address: text('address').notNull(),                      // alamat lengkap
    province: varchar('province', { length: 100 }),
    city: varchar('city', { length: 100 }),
    district: varchar('district', { length: 100 }),
    postalCode: varchar('postal_code', { length: 10 }),
    latitude: varchar('latitude', { length: 20 }).notNull(),
    longitude: varchar('longitude', { length: 20 }).notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
  });
  ```
  > **Kenapa tabel terpisah, bukan lat/lng di users?**
  > - Customer bisa punya banyak alamat (rumah, kantor, dll)
  > - Setiap alamat punya koordinat sendiri
  > - Pilih alamat saat checkout, tidak perlu input ulang
  > - Lebih scalable dan UX-friendly

- [x] **0.2b** Install Leaflet untuk map picker (GRATIS, tanpa API key)
  ```bash
  pnpm add leaflet react-leaflet
  pnpm add -D @types/leaflet
  ```
  > **Kenapa Leaflet, bukan Google Maps?**
  > - MySCI pakai Google Maps (`@vis.gl/react-google-maps`) — butuh API key berbayar
  > - Leaflet + OpenStreetMap tiles = **100% gratis**, tidak perlu API key
  > - Geocoding/search pakai **Nominatim API** (OpenStreetMap) — juga gratis
  > - Fitur sama: map drag, search alamat, reverse geocode, current location

- [x] **0.2c** Buat `components/ui/map-picker.tsx` — Leaflet Map Picker
  ```
  Komponen 'use client' yang menyediakan:

  1. MAP DISPLAY
     - OpenStreetMap tiles via react-leaflet
     - Draggable map dengan pin di tengah (fixed center marker)
     - Zoom controls

  2. SEARCH ALAMAT (Autocomplete)
     - Input search → call Nominatim API:
       GET https://nominatim.openstreetmap.org/search?q={query}&countrycodes=id&format=json
     - Tampilkan suggestions dropdown
     - Klik suggestion → pan map ke lokasi

  3. REVERSE GEOCODE (drag map → dapat alamat)
     - Saat map selesai di-drag (onMoveEnd):
       GET https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json
     - Parse response.address → { province, city, district, postalCode }
     - Auto-fill alamat lengkap

  4. CURRENT LOCATION
     - Tombol "Gunakan Lokasi Saya"
     - navigator.geolocation.getCurrentPosition()
     - Pan map ke posisi user

  5. OUTPUT
     - onLocationChange({ latitude, longitude, address, province, city, district, postalCode })
  ```
  > **Catatan SSR**: Leaflet butuh `dynamic import` dengan `ssr: false` di Next.js
  > karena akses `window` object.
  > ```typescript
  > const MapPicker = dynamic(() => import('@/components/ui/map-picker'), { ssr: false });
  > ```

  > **Nominatim Rate Limit**: Max 1 request/detik. Pakai debounce 500ms pada search input.

- [x] **0.2d** Buat CRUD Server Actions untuk addresses
  ```typescript
  // app/actions/addresses.ts
  getUserAddresses()                  → addresses[]
  createAddress(formData)             → address
  updateAddress(id, formData)         → address
  deleteAddress(id)                   → void
  setDefaultAddress(id)               → void
  ```

- [x] **0.2e** Buat halaman manage alamat customer
  ```
  Route: /account/addresses
  UI:
  ├── List alamat (cards) + badge "Default"
  ├── Tombol "Tambah Alamat Baru"
  ├── Form alamat:
  │   ├── Label (Rumah/Kantor/Custom)
  │   ├── Nama Penerima
  │   ├── Nomor Telepon
  │   ├── 🗺️ MAP PICKER (Leaflet) — drag/search/current location
  │   ├── Alamat Lengkap (auto-fill dari map, editable)
  │   ├── Province, City, District, Postal Code (auto-fill, read-only)
  │   └── Tombol Simpan
  ├── Edit alamat (same form)
  ├── Hapus alamat
  └── Set sebagai default
  ```

- [x] **0.3** Buat tabel `store_settings` (lokasi & config toko)
  ```typescript
  export const storeSettings = mysqlTable('store_settings', {
    id: int('id').primaryKey().autoincrement(),
    key: varchar('key', { length: 50 }).notNull().unique(),
    value: text('value').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
  });
  ```
  Keys yang dibutuhkan:
  - `store_name` — nama toko (origin contact name)
  - `store_phone` — nomor telepon (origin contact phone)
  - `store_address` — alamat lengkap (origin address)
  - `store_latitude` — latitude toko
  - `store_longitude` — longitude toko
  - `payment_expiry_hours` — jam sebelum payment expired (default: 24)

- [x] **0.4** Buat tabel `couriers` (daftar kurir yang tersedia)
  ```typescript
  export const couriers = mysqlTable('couriers', {
    id: int('id').primaryKey().autoincrement(),
    name: varchar('name', { length: 50 }).notNull(),  // "JNE", "J&T Express"
    code: varchar('code', { length: 50 }).notNull(),   // "jne", "jnt"
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow(),
  });
  ```

- [x] **0.5** Seed data untuk `store_settings` & `couriers`
  ```typescript
  // Store settings seed
  await db.insert(storeSettings).values([
    { key: 'store_name', value: 'Next Olshop' },
    { key: 'store_phone', value: '08123456789' },
    { key: 'store_address', value: 'Jl. Contoh No. 1, Jakarta Selatan' },
    { key: 'store_latitude', value: '-6.200000' },
    { key: 'store_longitude', value: '106.816666' },
    { key: 'payment_expiry_hours', value: '24' },
  ]);

  // Couriers seed (kurir populer Indonesia)
  await db.insert(couriers).values([
    { name: 'JNE', code: 'jne' },
    { name: 'J&T Express', code: 'jnt' },
    { name: 'SiCepat', code: 'sicepat' },
    { name: 'AnterAja', code: 'anteraja' },
    { name: 'Ninja Express', code: 'ninja' },
    { name: 'GoSend', code: 'gosend' },
    { name: 'GrabExpress', code: 'grab' },
    { name: 'Pos Indonesia', code: 'pos' },
    { name: 'TIKI', code: 'tiki' },
    { name: 'Lion Parcel', code: 'lion' },
  ]);
  ```

- [x] **0.6** Buat admin page: Store Settings
  ```
  Route: /dashboard/settings
  Sections:
  ├── Store Info: nama, alamat, telepon
  ├── Store Location: latitude, longitude (input manual atau paste Google Maps URL)
  └── Payment: expiry hours (1-24 jam)
  ```
  - Server Action: `getStoreSettings()`, `updateStoreSettings(formData)`
  - Form validation dengan Zod

- [x] **0.7** Buat admin page: Courier Management
  ```
  Route: /dashboard/settings/couriers (atau tab di settings)
  UI: Grid/list kurir dengan toggle switch aktif/nonaktif
  ```
  - Server Action: `getCouriers()`, `toggleCourier(id, isActive)`

- [x] **0.8** Update admin product form — tambah field `weight`
  ```
  Route: /dashboard/products/create & /dashboard/products/[id]/edit
  Tambah input: "Berat (gram)" — number input, required, min=1
  ```
  - Update Server Action `createProduct()` & `updateProduct()` untuk handle weight
  - Update Zod validation schema

- [x] **0.9** ~~Update checkout form~~ → Pindah ke Phase 2 (checkout pakai address book)
  > Checkout form akan pilih dari daftar alamat (addresses table),
  > bukan input manual. Dihandle di Phase 2.

- [x] **0.10** Run `pnpm db:push` — push semua schema changes
- [x] **0.11** Run seed — populate store_settings & couriers
- [x] **0.12** Seed minimal 1 address untuk user demo (john@example.com)

### Deliverable
- Toko punya lokasi (lat/lng) yang tersimpan di DB dan bisa diubah admin
- Product punya field weight (gram)
- Customer bisa input koordinat alamat
- Daftar kurir tersedia dan bisa di-toggle admin
- **Semua data yang dibutuhkan Bitship `/rates/couriers` sudah tersedia**

### Mapping ke Bitship API
```
Setelah Phase 0 selesai, request ke Bitship:

POST /rates/couriers
{
  origin_latitude:       ← store_settings['store_latitude']     ✅
  origin_longitude:      ← store_settings['store_longitude']    ✅
  destination_latitude:  ← addresses.latitude (selected)        ✅
  destination_longitude: ← addresses.longitude (selected)       ✅
  couriers:              ← couriers.code (yang isActive=true)   ✅
  items: [{
    weight:              ← products.weight (sum dari cart)       ✅
    quantity: 1
  }]
}
```

---

## Phase 1: Database Schema Migration

> Fondasi — update schema orders + tabel baru untuk payment, shipping, tracking

### Checklist

- [x] **1.1** Update enum `orderStatus` di `orders` table
  ```
  Lama: 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
  Baru: 'waiting_payment', 'packing', 'shipping', 'delivered', 'expired', 'cancelled'
  ```

- [x] **1.2** Update `orders` table — hapus field lama, tambah field baru
  ```
  Hapus: paymentMethod, paymentStatus, shippingCost (pindah ke tabel shippings)
  Tambah: willExpiredAt (datetime), paidAt (datetime),
          shippingAt (datetime), deliveredAt (datetime),
          expiredAt (datetime), cancelledAt (datetime)
  Ubah: shippingAddress → hapus (pindah ke tabel shippings)
        shippingPhone → hapus (pindah ke tabel shippings)
        shippingName → hapus (pindah ke tabel shippings)
  ```

- [x] **1.3** Buat tabel `invoices`
  ```sql
  invoices:
    id            INT AUTO_INCREMENT PK
    orderId       INT FK → orders.id
    xenditId      VARCHAR(100)        -- Xendit invoice ID
    externalId    VARCHAR(100)        -- orderId sebagai external ref
    paymentChannel VARCHAR(50)        -- BRI, DANA, QRIS, dll
    paymentMethod  VARCHAR(50)        -- BANK_TRANSFER, EWALLET, QR_CODE
    amount        DECIMAL(12,2)
    invoiceUrl    VARCHAR(500)        -- URL checkout Xendit
    status        ENUM('pending','paid','expired','cancelled')
    expiredAt     DATETIME
    paidAt        DATETIME
    cancelledAt   DATETIME
    createdAt     DATETIME DEFAULT NOW()
    updatedAt     DATETIME DEFAULT NOW()
  ```

- [x] **1.4** Buat tabel `shippings`
  ```sql
  shippings:
    id              INT AUTO_INCREMENT PK
    orderId         INT FK → orders.id
    recipientName   VARCHAR(100)
    recipientPhone  VARCHAR(20)
    recipientAddress TEXT
    recipientLatitude  VARCHAR(20)
    recipientLongitude VARCHAR(20)
    trackingId      VARCHAR(100)       -- dari Bitship
    waybillId       VARCHAR(100)       -- dari Bitship
    courierName     VARCHAR(50)        -- JNE REG, GoSend, dll
    courierCompany  VARCHAR(50)        -- jne, grab, gojek
    courierType     VARCHAR(50)        -- service type
    shippingCost    DECIMAL(12,2)
    estimateMin     INT                -- min hari/jam
    estimateMax     INT                -- max hari/jam
    estimateUnit    ENUM('hour','day') DEFAULT 'day'
    status          VARCHAR(30) DEFAULT 'pending'
    createdAt       DATETIME DEFAULT NOW()
    updatedAt       DATETIME DEFAULT NOW()
  ```

- [x] **1.5** Buat tabel `shipping_histories`
  ```sql
  shipping_histories:
    id            INT AUTO_INCREMENT PK
    shippingId    INT FK → shippings.id
    status        VARCHAR(30)
    note          TEXT
    serviceType   VARCHAR(50)
    updatedAt     DATETIME
  ```

- [x] **1.6** Buat tabel `order_status_logs` (Audit Trail)
  ```sql
  order_status_logs:
    id          INT AUTO_INCREMENT PK
    orderId     INT FK → orders.id
    fromStatus  VARCHAR(30)
    toStatus    VARCHAR(30)
    changedBy   VARCHAR(50)       -- 'customer', 'admin', 'xendit_webhook', 'bitship_webhook', 'system'
    note        TEXT
    createdAt   DATETIME DEFAULT NOW()
  ```
  > Untuk debugging: "kapan order ini berubah status dan oleh siapa?"

- [x] **1.7** Buat helper: `validateStatusTransition()`
  ```typescript
  // lib/order-status.ts
  const VALID_TRANSITIONS: Record<string, string[]> = {
    waiting_payment: ['packing', 'expired', 'cancelled'],
    packing:         ['shipping', 'cancelled'],
    shipping:        ['delivered', 'cancelled'],
    expired:         ['waiting_payment'],  // repayment special case
    delivered:       [],  // terminal
    cancelled:       [],  // terminal
  };

  export function validateStatusTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  export async function changeOrderStatus(
    orderId: number, newStatus: string, changedBy: string, note?: string
  ) {
    const order = await getOrder(orderId);
    if (!validateStatusTransition(order.status, newStatus)) {
      throw new Error(`Invalid transition: ${order.status} → ${newStatus}`);
    }
    // Update order + insert log
  }
  ```

- [x] **1.8** Define Drizzle `relations()` untuk semua tabel baru
  - orders ↔ invoices (1:1)
  - orders ↔ shippings (1:1)
  - shippings ↔ shipping_histories (1:many)
  - orders ↔ order_status_logs (1:many)
  - users ↔ addresses (1:many)

- [x] **1.9** Run `pnpm db:push` — push schema ke MySQL
- [x] **1.10** Update existing seed data jika perlu (orders lama)

### Deliverable
- Schema orders terupdate, 4 tabel baru (invoices, shippings, shipping_histories, order_status_logs)
- Status transition validation helper siap dipakai
- Relations terdefinisi
- Siap untuk Phase 2 & 3

---

## Phase 2: Bitship Integration — Shipping Rates + Checkout Revamp

> Customer pilih alamat dari address book, pilih kurir, lihat ongkir real-time

### Checklist

- [x] **2.1** Tambah env variables untuk Bitship
  ```env
  BITSHIP_API_URL=https://api.biteship.com/v1
  BITSHIP_API_KEY=xxx
  ```

- [x] **2.2** Buat `lib/bitship.ts` — Bitship API client
  ```typescript
  // Functions:
  getShippingRates(origin, destination, weight, courierCodes) → pricing[]
  createShipment(orderData) → { trackingId, waybillId }
  getTracking(trackingId) → { history[] }
  ```

- [x] **2.3** Buat Server Action `app/actions/shipping.ts`
  ```typescript
  getAvailableCouriers()     → couriers[]
  calculateShippingRates(addressId) → { express?, regular?, economy? }
  // ↑ Ambil origin dari store_settings, destination dari addresses table,
  //   weight dari cart items, couriers dari couriers table
  ```

- [x] **2.4** Revamp checkout menjadi **multi-step** (`'use client'`)
  ```
  Step 1: PILIH ALAMAT
  ├── List dari addresses table (user's addresses)
  ├── Alamat default auto-selected
  ├── Tombol "Tambah Alamat Baru" → modal/form
  └── Tombol "Lanjut"

  Step 2: PILIH KURIR
  ├── Auto-fetch shipping rates saat step ini dibuka
  ├── Loading skeleton saat fetching dari Bitship
  ├── Radio: EXPRESS / REGULAR / ECONOMY
  │   └── Per opsi: nama kurir, estimasi hari, harga
  ├── Error handling jika Bitship API gagal
  └── Tombol "Lanjut"

  Step 3: REVIEW & BAYAR
  ├── Ringkasan: items, alamat, kurir, ongkir
  ├── Subtotal produk + Ongkir = Total
  ├── Catatan (optional textarea)
  └── Tombol "Bayar Sekarang" → createOrder → redirect Xendit
  ```

- [x] **2.5** Buat `components/shop/AddressSelector.tsx`
  - List alamat user dengan radio button
  - Badge "Default" pada alamat default
  - Info: label, nama, telp, alamat
  - Tombol tambah alamat baru (inline form atau modal)

- [x] **2.6** Buat `components/shop/ShippingOptions.tsx`
  - Radio button untuk EXPRESS / REGULAR / ECONOMY
  - Tampilkan: nama kurir, estimasi, harga (formatted Rupiah)
  - Loading skeleton saat fetch
  - Error state jika Bitship gagal
  - Disabled state jika belum pilih alamat

- [x] **2.7** Update `app/(shop)/checkout/CheckoutForm.tsx`
  - Multi-step form dengan step indicator
  - State: selectedAddressId, selectedCourier, note
  - Hitung total dinamis (subtotal + ongkir)
  - Validasi per step sebelum lanjut

- [x] **2.8** Cart validation sebelum checkout
  ```typescript
  // Sebelum masuk checkout page, validasi:
  // - Semua item masih ada stok?
  // - Product masih active?
  // - Cart tidak kosong?
  // Jika ada masalah → redirect ke cart dengan error message
  ```

### Deliverable
- Customer pilih alamat dari address book saat checkout
- Ongkir dihitung dinamis berdasarkan alamat terpilih
- Multi-step checkout flow yang jelas

---

## Phase 3: Xendit Integration — Online Payment

> Customer bayar online via Xendit setelah checkout

### Checklist

- [x] **3.1** Install dependency
  ```bash
  pnpm add xendit-node
  ```

- [x] **3.2** Tambah env variables untuk Xendit
  ```env
  XENDIT_SECRET_KEY=xnd_development_xxx
  XENDIT_SUCCESS_URL=http://localhost:3000/orders
  XENDIT_FAILURE_URL=http://localhost:3000/orders
  XENDIT_WEBHOOK_TOKEN=xxx  # untuk verifikasi webhook
  ```

- [x] **3.3** Buat `lib/xendit.ts` — Xendit client
  ```typescript
  import { Xendit } from "xendit-node";

  export const xenditClient = new Xendit({
    secretKey: process.env.XENDIT_SECRET_KEY!
  });

  // Functions:
  createInvoice(orderId, amount, description, expiryHours) → { id, invoiceUrl }
  expireInvoice(xenditInvoiceId) → void  // untuk cancel
  ```

- [x] **3.4** Revamp `app/actions/orders.ts` → `createOrder()`
  ```
  ⚠️ URUTAN PENTING — Xendit invoice SETELAH DB transaction:

  Flow baru:
  1. Validate form (addressId, courierId, note)
  2. Validate stock per item (query products)
  3. Calculate total (subtotal + shippingCost dari selected courier)
  4. DB Transaction (dengan FOR UPDATE lock):
     a. SELECT products FOR UPDATE (lock rows)
     b. Re-validate stock (bisa berubah sejak step 2)
     c. Insert order (status: waiting_payment, willExpiredAt)
     d. Insert order_items
     e. Insert shipping (dari selected courier + alamat)
     f. Deduct stock per product
     g. Clear cart
  5. SETELAH transaction sukses → Create Xendit invoice
     - amount: total
     - externalId: orderId
     - successRedirectUrl, failureRedirectUrl
     - invoiceDuration: paymentExpiryHours * 3600
  6. Insert invoice record (xenditId, invoiceUrl, amount, status=pending)
  7. Return { orderId, paymentUrl: invoice.invoiceUrl }

  ⚠️ Jika step 5 gagal (Xendit error):
     - Order sudah ada di DB tanpa invoice
     - Customer bisa retry via "Bayar Sekarang" yang akan create invoice baru
  ```

- [x] **3.5** Update checkout flow — redirect ke Xendit setelah submit
  - Setelah createOrder sukses, redirect ke `paymentUrl` (Xendit checkout)
  - Customer pilih metode pembayaran di Xendit
  - Setelah bayar → redirect ke `/orders/[id]?payment=success`
  - Gagal/cancel → redirect ke `/orders/[id]?payment=failed`

- [x] **3.6** Update `middleware.ts` — exclude webhook routes dari auth
  ```typescript
  // Webhook routes TIDAK perlu auth (dipanggil oleh external service)
  const publicApiRoutes = ['/api/webhooks/xendit', '/api/webhooks/bitship'];
  ```

- [x] **3.7** Buat `app/api/webhooks/xendit/route.ts` — Payment callback
  ```typescript
  POST handler:
  1. Verify callback token:
     const token = req.headers.get('x-callback-token');
     if (token !== process.env.XENDIT_WEBHOOK_TOKEN) return 401;

  2. Parse body: { external_id, status, payment_method, payment_channel, paid_at }

  3. Idempotency check:
     const invoice = findInvoice(external_id);
     if (invoice.status === 'paid') return 200; // sudah diproses

  4. If status === "PAID":
     Transaction:
     - Update invoice: status=paid, paymentChannel, paymentMethod, paidAt
     - Update order: status=packing, paidAt, willExpiredAt=null
     - Insert order_status_log (waiting_payment → packing, by: xendit_webhook)

  5. If status === "EXPIRED":
     Transaction:
     - Update invoice: status=expired, expiredAt
     - Update order: status=expired, expiredAt, willExpiredAt=null
     - ⚠️ RESTORE STOCK per order_item (increment product stock)
     - Insert order_status_log (waiting_payment → expired, by: xendit_webhook)

  6. SELALU return 200 OK (agar Xendit tidak retry terus)
  ```

- [x] **3.8** Buat `lib/stock.ts` — Stock helper functions
  ```typescript
  // Kembalikan stok saat order cancelled/expired
  async function restoreStock(orderId: number, tx?: Transaction) {
    const items = await getOrderItems(orderId);
    for (const item of items) {
      await updateProduct(item.productId, {
        stock: sql`stock + ${item.quantity}`
      });
    }
  }

  // Kurangi stok saat create order (dalam transaction, dengan FOR UPDATE)
  async function deductStock(items: CartItem[], tx: Transaction) {
    for (const item of items) {
      await tx.execute(
        sql`SELECT stock FROM products WHERE id = ${item.productId} FOR UPDATE`
      );
      // validate stock >= quantity
      await tx.update(products).set({
        stock: sql`stock - ${item.quantity}`
      }).where(eq(products.id, item.productId));
    }
  }
  ```

- [x] **3.9** Update order detail page (`/orders/[id]`) — Payment info
  - **Status `waiting_payment`**:
    - Countdown timer (willExpiredAt - now)
    - Tombol "Bayar Sekarang" (link ke invoiceUrl)
    - Tombol "Batalkan Pesanan"
    - Auto-refresh / polling status
  - **Status `expired`**:
    - Tombol "Bayar Ulang" (→ create new invoice)
    - Info: "Pembayaran telah kedaluwarsa"
  - **Status `packing`/`shipping`/`delivered`**:
    - Metode pembayaran yang dipakai
    - Tanggal pembayaran
  - **Semua status**:
    - Breakdown: Subtotal + Ongkir = Total
    - Info alamat pengiriman
    - Info kurir

- [x] **3.10** Buat customer cancel order flow
  ```typescript
  // app/actions/orders.ts
  async function cancelOrderByCustomer(orderId: number) {
    // 1. Validate: order milik user & status = waiting_payment
    // 2. Cancel Xendit invoice via API: expireInvoice(xenditId)
    // 3. Transaction:
    //    - Update order: status=cancelled, cancelledAt
    //    - Update invoice: status=cancelled, cancelledAt
    //    - Restore stock
    //    - Insert order_status_log
  }
  ```

- [x] **3.11** Buat repayment flow (Bayar Ulang untuk expired)
  ```typescript
  // app/actions/orders.ts
  async function repayOrder(orderId: number) {
    // 1. Validate: order status = expired & milik user
    // 2. Create NEW Xendit invoice (invoice lama sudah expired)
    // 3. Update invoice record (xenditId baru, invoiceUrl baru, status=pending)
    // 4. Update order: status=waiting_payment, willExpiredAt baru
    // 5. Insert order_status_log (expired → waiting_payment, by: customer)
    // 6. Return { paymentUrl: newInvoice.invoiceUrl }
  }
  ```

- [x] **3.12** Update customer order list (`/orders`) — Status tabs
  ```
  Tabs: Belum Bayar | Dikemas | Dikirim | Selesai | Dibatalkan
  - Setiap tab menampilkan count
  - Filter via URL query params (nuqs)
  - Belum Bayar: tampilkan countdown expiry
  ```

- [x] **3.13** Update admin order detail — payment actions
  - "Mark as Paid" button (admin override, status: waiting_payment → packing)
  - "Cancel Order" button (admin, cancel invoice + restore stock)
  - Payment status badge (pending/paid/expired/cancelled)

### Deliverable
- Customer bayar online via Xendit (Bank Transfer, E-Wallet, QRIS)
- Payment status otomatis update via webhook (dengan security verification)
- Stock otomatis dikembalikan saat expired/cancelled
- Customer bisa cancel order & bayar ulang
- Status transition validated
- Admin bisa manual mark as paid / cancel

---

## Phase 4: Bitship Integration — Shipping & Tracking

> Admin kirim order via Bitship, customer lihat tracking real-time

### Checklist

- [x] **4.1** Buat admin action: "Kirim Order" (dengan idempotency)
  ```typescript
  // app/actions/orders.ts
  async function sendOrderToBitship(orderId: number) {
    // 1. Validate: order status HARUS = packing (via validateStatusTransition)
    // 2. ⚠️ IDEMPOTENCY CHECK:
    //    Cek apakah shipping.trackingId sudah ada
    //    Jika sudah ada → jangan call Bitship lagi, fetch tracking saja
    // 3. Build Bitship request body:
    //    - origin: dari store_settings (name, phone, address, lat/lng)
    //    - destination: dari shipping record (recipient info + lat/lng)
    //    - courier: dari shipping (courierCompany, courierType)
    //    - items: dari order_items (name, weight, quantity, value)
    // 4. Call Bitship POST /orders → { trackingId, waybillId, status }
    // 5. Call Bitship GET /trackings/{trackingId} → initial history
    // 6. Transaction:
    //    - Update shipping: trackingId, waybillId, status
    //    - Insert shipping_histories (initial)
    //    - Update order: status=shipping, shippingAt
    //    - Insert order_status_log (packing → shipping, by: admin)
    //
    // ⚠️ Jika step 4 sukses tapi step 5 gagal:
    //    - Shipping sudah ada di Bitship
    //    - Simpan trackingId dulu, history bisa di-sync nanti
    //    - JANGAN ulangi step 4 (akan create duplicate shipment)
  }
  ```

- [x] **4.2** Update `app/(admin)/dashboard/orders/[id]/page.tsx`
  - Tampilkan action buttons berdasarkan status:
    - `waiting_payment`: "Mark as Paid" / "Cancel"
    - `packing`: **"Kirim Order"** / "Cancel"
    - `shipping`: Info tracking (no actions)
    - `delivered`: Info tracking (no actions)
  - Setelah kirim: tampilkan tracking ID, waybill, status kurir

- [x] **4.3** Buat `app/api/webhooks/bitship/route.ts` — Tracking webhook
  ```typescript
  POST handler:
  1. Graceful body parsing (return 200 jika body kosong/invalid)

  2. If event !== "order.status" → return 200

  3. Find shipping by trackingId + waybillId
     If not found → return 200 (ignore unknown shipments)

  4. Idempotency: Check current shipping status
     If shipping.status already matches → skip update

  5. Call Bitship GET /trackings/{trackingId} → get full history

  6. Deduplicate history:
     - Compare new entries vs existing shipping_histories
     - Only insert truly new entries

  7. Transaction:
     - Insert new shipping_histories
     - Update shipping.status
     - Update order status via validateStatusTransition():
       · picking_up/dropping_off/etc → shipping (tetap)
       · delivered → delivered + set deliveredAt
       · cancelled/returned/rejected → cancelled + ⚠️ RESTORE STOCK
     - Insert order_status_log

  8. SELALU return 200 OK
  ```

- [x] **4.4** Buat `components/shop/TrackingTimeline.tsx`
  ```
  Visual timeline vertikal:
  ● DELIVERED (hijau)     — "Paket telah diterima" — 27 Apr 14:30
  │
  ● DROPPING_OFF (biru)   — "Kurir dalam perjalanan" — 27 Apr 09:00
  │
  ● PICKED (biru)         — "Paket dijemput kurir" — 26 Apr 16:00
  │
  ● CONFIRMED (abu)       — "Order dikonfirmasi" — 26 Apr 15:30

  - Warna: hijau (delivered), biru (in-transit), orange (on_hold/return), merah (cancelled)
  - Icon per status (Lucide icons)
  - Timestamp formatted Indonesian locale
  - Note dari Bitship
  ```

- [x] **4.5** Update `app/(shop)/orders/[id]/page.tsx`
  - Section: Tracking (visible saat status shipping/delivered)
    - Info kurir: nama, waybill ID
    - Estimasi pengiriman
    - Tracking timeline component
  - Section: Shipping Info
    - Alamat penerima
    - Ongkos kirim

- [x] **4.6** Buat Server Action: `getOrderTracking(orderId)`
  - Query shipping + shipping_histories (ordered by updatedAt DESC)
  - Return formatted tracking data
  - Validate: order milik user yang request

### Deliverable
- Admin bisa kirim order dengan 1 klik (idempotent — aman di-click berkali-kali)
- Tracking otomatis update via Bitship webhook
- Stock otomatis dikembalikan jika paket returned/rejected
- Customer lihat tracking timeline real-time

---

## Phase 5: Enhanced Admin & Order Management

> Admin features lengkap untuk manage orders, settings

### Checklist

- [ ] **5.1** Update admin orders table
  - Tambah kolom: payment status, shipping status, shipping kurir
  - Filter by: order status, date range
  - Quick actions per row: mark paid, cancel, send (berdasarkan status)

- [x] **5.2** Buat admin order detail enhanced
  - Section: Order Info, Products, Payment, Shipping, Tracking History
  - **Action buttons berdasarkan status** (conditional render):
    - `waiting_payment`: "Mark as Paid" / "Cancel Order"
    - `packing`: "Kirim Order" / "Cancel Order"
    - `shipping`: View Tracking
    - `delivered`: View Only
    - `cancelled`/`expired`: View Only (info saja)

- [x] **5.3** Admin cancel order flow (dengan Xendit cancel + stock restore)
  ```typescript
  async function cancelOrderByAdmin(orderId: number) {
    // 1. Validate: status harus waiting_payment atau packing
    // 2. If status = waiting_payment:
    //    - Cancel Xendit invoice via API (expireInvoice)
    // 3. Transaction:
    //    - Update order: status=cancelled, cancelledAt
    //    - Update invoice: status=cancelled, cancelledAt
    //    - Update shipping: status=cancelled (jika ada)
    //    - ⚠️ RESTORE STOCK
    //    - Insert order_status_log (admin cancel)
  }
  ```

- [x] **5.4** Dashboard stats update
  - Orders by status breakdown (chart atau cards)
  - Revenue hari ini (only paid orders)
  - Pending payments count (waiting_payment)
  - Orders menunggu dikemas (packing)
  - Orders dalam pengiriman (shipping)

- [ ] **5.5** Admin notification: "X order menunggu dikemas"
  - Badge count di sidebar menu "Orders"
  - Highlight di dashboard

---

## Phase 6: Payment Expiration & Safety Nets

> Handles edge cases yang bisa bikin data inconsistent

### Checklist

- [x] **6.1** Payment expiration checker (Cron/Scheduled)
  ```typescript
  // app/api/cron/check-expired-orders/route.ts
  // GET handler (dipanggil oleh cron job)
  async function checkExpiredOrders() {
    // 1. Query: orders WHERE status='waiting_payment' AND willExpiredAt < NOW()
    // 2. Untuk setiap order yang expired:
    //    - Update order status → expired
    //    - Update invoice status → expired
    //    - RESTORE STOCK
    //    - Insert order_status_log (by: system_cron)
    // 3. Return: { processed: count }
  }
  ```
  > **Kenapa perlu?** Jika Xendit webhook EXPIRED tidak pernah sampai (network issue),
  > order stuck di waiting_payment selamanya dan stok terdeduct.

  Deployment options:
  - **Vercel**: Cron Jobs di `vercel.json` (gratis 1x/hari di hobby plan)
  - **VPS**: crontab `*/15 * * * *` curl endpoint
  - **Fallback**: Check on page load (less reliable)

- [x] **6.2** Protect cron endpoint
  ```typescript
  // Cron endpoint butuh secret header agar tidak bisa dipanggil sembarang
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) return Response.json({}, { status: 401 });
  ```

- [ ] **6.3** Bitship shipping sync (jika webhook miss)
  ```typescript
  // app/api/cron/sync-shipping/route.ts
  // Untuk orders yang status=shipping tapi sudah > 7 hari tanpa update:
  // → Call Bitship GET /trackings/{trackingId}
  // → Sync status dan history
  ```

### Deliverable
- Sistem self-healing: expired orders auto-detected
- Stok tidak pernah "hilang" karena webhook miss
- Shipping status tetap up-to-date

---

## Phase 7: Polish, Testing & Deployment

> Finalisasi, testing end-to-end, deployment prep

### Checklist

- [x] **7.1** Error handling & UX polish
  - Bitship API timeout/error → friendly error message + retry button
  - Xendit invoice creation failure → tampilkan error, order tetap ada, bisa retry
  - Loading states: skeleton saat fetch rates, spinner saat create order
  - Toast notifications (sonner) untuk setiap aksi berhasil/gagal
  - Redirect flow yang smooth setelah payment

- [ ] **7.2** Update API routes (untuk Flutter consumption)
  ```
  POST /api/orders           — create order with Xendit + Bitship
  GET  /api/orders           — list orders (with status filter)
  GET  /api/orders/[id]      — order detail + payment + shipping
  GET  /api/orders/[id]/tracking — tracking timeline
  POST /api/orders/[id]/cancel  — cancel order
  POST /api/orders/[id]/repay   — repayment (new invoice)
  POST /api/shipping/rates   — get shipping rates
  GET  /api/couriers         — available couriers
  GET  /api/addresses        — user's addresses
  POST /api/addresses        — create address
  PUT  /api/addresses/[id]   — update address
  DELETE /api/addresses/[id] — delete address
  ```

- [ ] **7.3** Testing end-to-end
  - [ ] Test Xendit sandbox: create invoice, bayar, webhook PAID
  - [ ] Test Xendit sandbox: create invoice, biarkan expire, webhook EXPIRED
  - [ ] Test Bitship sandbox: get rates, create order, webhook tracking
  - [ ] Test full flow: cart → checkout → pilih alamat → pilih kurir → bayar → paid → admin kirim → tracking → delivered
  - [ ] Test cancel flow: customer cancel (waiting_payment) → stock restored
  - [x] Test admin cancel: admin cancel (packing) → stock restored + Xendit cancelled
  - [ ] Test repayment: expired → bayar ulang → new invoice → paid
  - [ ] Test edge: concurrent checkout same product (stock locking)
  - [ ] Test edge: webhook arrives twice (idempotency)
  - [ ] Test edge: Bitship API down during checkout (error handling)
  - [ ] Test cron: expired order detection & stock restoration

- [ ] **7.4** Security checklist
  - [ ] Xendit webhook: verify `x-callback-token` header
  - [ ] Bitship webhook: verify token/signature
  - [ ] Cron endpoints: verify `x-cron-secret` header
  - [ ] Webhook routes excluded dari auth middleware
  - [ ] No sensitive data exposed in client-side code
  - [ ] XENDIT_SECRET_KEY not in NEXT_PUBLIC_ prefix
  - [ ] Input validation (Zod) pada semua form & API inputs

- [ ] **7.5** Deployment preparation
  - [ ] Set semua env variables di production
  - [ ] Configure Xendit webhook URL di dashboard: `https://domain.com/api/webhooks/xendit`
  - [ ] Configure Bitship webhook URL di dashboard: `https://domain.com/api/webhooks/bitship`
  - [ ] SSL certificate aktif (WAJIB untuk webhooks)
  - [ ] Setup cron job untuk check-expired-orders (setiap 15 menit)
  - [ ] Setup cron job untuk sync-shipping (setiap 6 jam)
  - [ ] Test webhooks dengan production keys
  - [ ] Switch Xendit dari development → production key

### Deliverable
- Sistem production-ready & teruji end-to-end
- Webhook configured dan aman
- Cron jobs berjalan
- API routes siap untuk Flutter

---

## Order Status State Machine (Final)

```
                    ┌──────────────┐
                    │   CART       │
                    └──────┬───────┘
                           │ createOrder()
                           ▼
                ┌──────────────────┐
                │ WAITING_PAYMENT  │
                └────┬────┬───────┘
                     │    │
            Xendit   │    │  Xendit
            PAID     │    │  EXPIRED
                     ▼    ▼
              ┌──────┐  ┌─────────┐
              │PACKING│  │ EXPIRED │
              └──┬───┘  └─────────┘
                 │
         Admin   │ sendOrder()
         Kirim   │ → Bitship
                 ▼
              ┌──────────┐
              │ SHIPPING  │
              └──┬───┬───┘
                 │   │
        Bitship  │   │  Bitship
        delivered│   │  cancelled/
                 │   │  returned
                 ▼   ▼
          ┌──────┐ ┌──────────┐
          │DELIVERED│CANCELLED │
          └────────┘└──────────┘

  * Cancel bisa dari: WAITING_PAYMENT, PACKING (oleh admin)
```

---

## Environment Variables Summary

```env
# === Database (sudah ada) ===
DATABASE_URL="mysql://root:password@localhost:3306/next-ecommerce-db"

# === Auth (sudah ada) ===
AUTH_SECRET="xxx"
AUTH_URL="http://localhost:3000"

# === App (sudah ada) ===
NEXT_PUBLIC_APP_NAME="Next Olshop"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# === Xendit (BARU) ===
XENDIT_SECRET_KEY="xnd_development_xxx"
XENDIT_SUCCESS_URL="http://localhost:3000/orders"
XENDIT_FAILURE_URL="http://localhost:3000/orders"
XENDIT_WEBHOOK_TOKEN="xxx"

# === Bitship (BARU) ===
BITSHIP_API_URL="https://api.biteship.com/v1"
BITSHIP_API_KEY="xxx"

# === Cron (BARU) ===
CRON_SECRET="random-secret-for-cron-endpoint"

# === Store Config (simpan di DB store_settings, bukan env) ===
# store_name, store_address, store_phone, store_latitude, store_longitude,
# payment_expiry_hours → semua di tabel store_settings
```

---

## Dependencies yang Perlu Ditambah

```bash
# Map Picker (Phase 0) — GRATIS, pengganti Google Maps
pnpm add leaflet react-leaflet
pnpm add -D @types/leaflet

# Xendit SDK (Phase 3)
pnpm add xendit-node
```

> **Tidak pakai Google Maps** — MySCI pakai `@vis.gl/react-google-maps` + `@react-google-maps/api`
> yang butuh API key berbayar. Kita pakai **Leaflet + OpenStreetMap + Nominatim** — semua gratis.
>
> Nominatim API (geocoding) tidak butuh library — cukup `fetch()` ke:
> - Search: `https://nominatim.openstreetmap.org/search?q=...&countrycodes=id&format=json`
> - Reverse: `https://nominatim.openstreetmap.org/reverse?lat=...&lon=...&format=json`

---

## Priority Order

| Phase | Nama | Priority | Dependency | Checklist Items |
|-------|------|----------|-----------|-----------------|
| Phase 0 | Prerequisites | **CRITICAL** | - | 12 items |
| Phase 1 | Schema Migration | **CRITICAL** | Phase 0 | 10 items |
| Phase 2 | Bitship Rates + Checkout | **HIGH** | Phase 0 + 1 | 8 items |
| Phase 3 | Xendit Payment | **HIGH** | Phase 1 | 13 items |
| Phase 4 | Bitship Shipping & Tracking | **HIGH** | Phase 2 + 3 | 6 items |
| Phase 5 | Enhanced Admin | **MEDIUM** | Phase 4 | 5 items |
| Phase 6 | Safety Nets (Cron) | **MEDIUM** | Phase 3 + 4 | 3 items |
| Phase 7 | Polish, Testing & Deploy | **HIGH** | All above | 5 items |

**Total: ~62 checklist items**

```
Phase 0 (Prerequisites)
  │
  ▼
Phase 1 (Schema Migration)
  │
  ├──────────────────────────┐
  ▼                          ▼
Phase 2 (Bitship Rates)    Phase 3 (Xendit Payment)
  │                          │
  └──────────┬───────────────┘
             ▼
Phase 4 (Shipping & Tracking)
  │
  ├─────────────────┐
  ▼                 ▼
Phase 5 (Admin)   Phase 6 (Safety Nets)
  │                 │
  └────────┬────────┘
           ▼
Phase 7 (Polish, Test & Deploy)
```

> Phase 0 & 1 WAJIB duluan — fondasi schema & data.
> Phase 2 dan 3 bisa dikerjakan **parallel** setelah Phase 1 selesai.
> Phase 4 butuh Phase 2 (kurir) + Phase 3 (payment) selesai dulu.
> Phase 5 dan 6 bisa **parallel**.
> Phase 7 setelah semuanya selesai.

---

## File Structure (After Integration)

```
lib/
  db/
    schema.ts             ← UPDATED (7 tabel baru + update orders & products & users)
  bitship.ts              ← NEW (Bitship API client: rates, createShipment, getTracking)
  xendit.ts               ← NEW (Xendit client: createInvoice, expireInvoice)
  stock.ts                ← NEW (deductStock, restoreStock — with FOR UPDATE)
  order-status.ts         ← NEW (validateStatusTransition, changeOrderStatus)
  auth.ts                 (existing)
  utils.ts                (existing)

app/
  actions/
    orders.ts             ← UPDATED (createOrder, cancelOrder, repayOrder, sendToBitship)
    cart.ts               (existing)
    addresses.ts          ← NEW (CRUD address book)
    shipping.ts           ← NEW (getShippingRates, getTracking)
    settings.ts           ← NEW (store settings, couriers CRUD)

  api/
    webhooks/
      xendit/route.ts     ← NEW (payment callback + token verification)
      bitship/route.ts    ← NEW (tracking webhook + signature check)
    cron/
      check-expired-orders/route.ts  ← NEW (payment expiration checker)
      sync-shipping/route.ts         ← NEW (shipping status sync)
    orders/               (existing, update response format)
    orders/[id]/
      tracking/route.ts   ← NEW (for Flutter — tracking)
      cancel/route.ts     ← NEW (for Flutter — cancel order)
      repay/route.ts      ← NEW (for Flutter — repayment)
    shipping/
      rates/route.ts      ← NEW (for Flutter — get rates)
    couriers/
      route.ts            ← NEW (for Flutter — available couriers)
    addresses/
      route.ts            ← NEW (for Flutter — CRUD addresses)
      [id]/route.ts       ← NEW (for Flutter — single address)

  (shop)/
    checkout/
      page.tsx            ← UPDATED (multi-step: alamat → kurir → review → bayar)
      CheckoutForm.tsx    ← UPDATED (step wizard component)
    orders/
      page.tsx            ← UPDATED (status tabs: belum bayar/dikemas/dikirim/selesai/batal)
      [id]/
        page.tsx          ← UPDATED (tracking, payment info, countdown, cancel/repay)
    account/
      addresses/
        page.tsx          ← NEW (manage alamat customer)

  (admin)/
    dashboard/
      page.tsx            ← UPDATED (enhanced stats)
      orders/
        [id]/
          page.tsx        ← UPDATED (send order, mark paid, cancel, tracking)
      settings/
        page.tsx          ← NEW (store info, location, payment expiry)
        couriers/
          page.tsx        ← NEW (courier management toggle)

components/
  shop/
    AddressSelector.tsx   ← NEW (pilih alamat di checkout)
    ShippingOptions.tsx   ← NEW (pilih kurir: EXPRESS/REGULAR/ECONOMY)
    TrackingTimeline.tsx  ← NEW (visual tracking history)
    PaymentCountdown.tsx  ← NEW (countdown timer + bayar button)
    OrderStatusTabs.tsx   ← NEW (tabs filter by status)
  admin/
    OrderActionButtons.tsx ← NEW (conditional actions per status)

middleware.ts             ← UPDATED (exclude /api/webhooks/* & /api/cron/*)
```

### New Database Tables Summary

```
Existing (updated):
  users           + (remove: address field, replaced by addresses table)
  products        + weight (gram)
  orders          + willExpiredAt, paidAt, shippingAt, deliveredAt, expiredAt, cancelledAt
                  - paymentMethod, paymentStatus, shippingCost, shippingAddress, shippingPhone, shippingName

New tables:
  addresses           (buku alamat customer, multi-address + lat/lng)
  store_settings      (lokasi toko, config)
  couriers            (daftar kurir + toggle aktif)
  invoices            (Xendit payment records)
  shippings           (Bitship shipping records + recipient info)
  shipping_histories  (tracking timeline entries)
  order_status_logs   (audit trail: siapa ubah status kapan)
```
