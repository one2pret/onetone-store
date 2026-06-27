# Missing Flows & Features — Gap Analysis Lanjutan

> Hasil analisis ulang mendalam: fitur/flow yang BELUM ada di integration plan
> tapi WAJIB ada agar sistem end-to-end bisa berjalan lancar.

---

## Kategori A: Flow Yang Hilang Total (Belum Ada di Plan Sama Sekali)

### A1. Address Management System (Buku Alamat Customer)
**Status: TIDAK ADA di plan**

Saat ini user cuma punya 1 field `address` (text). Untuk e-commerce yang serius:
- Customer butuh **buku alamat** (multiple addresses)
- Pilih alamat saat checkout
- Set alamat default
- Setiap alamat harus punya **latitude/longitude** (untuk Bitship)

**Yang dibutuhkan:**
- Tabel `addresses` (userId, name, phone, address, detail, province, city, district, postalCode, latitude, longitude, isDefault)
- CRUD Server Actions: createAddress, updateAddress, deleteAddress, setDefaultAddress
- Halaman `/account/addresses` untuk manage alamat
- Component address selector di checkout
- Ini **lebih baik** daripada simpan lat/lng di tabel `users` (Phase 0.2 saat ini)

**Impact jika tidak ada:**
- Customer harus input alamat + koordinat setiap kali checkout
- Tidak bisa reuse alamat → UX buruk

---

### A2. Stock Restoration (Kembalikan Stok)
**Status: TIDAK ADA di plan**

Saat ini plan hanya deduct stock saat create order. Tapi **tidak ada flow untuk mengembalikan stok** ketika:
1. **Payment expired** → stok harus dikembalikan
2. **Order cancelled** (oleh customer atau admin) → stok harus dikembalikan
3. **Shipping returned/rejected** → stok harus dikembalikan

**Yang dibutuhkan:**
- Function `restoreStock(orderId)` yang:
  - Query order_items untuk order tersebut
  - Increment stock product untuk setiap item
  - Harus dalam transaction
- Dipanggil di:
  - Xendit webhook handler (saat status EXPIRED)
  - Cancel order action (customer & admin)
  - Bitship webhook handler (saat status returned/rejected)

**Impact jika tidak ada:**
- Stok terus berkurang tapi barang tidak terjual → "phantom stock loss"
- Contoh: 100 stok → 50 order expired → stok masih 50 padahal barang masih 100

---

### A3. Customer Cancel Order Flow
**Status: TIDAK ADA di plan (hanya admin cancel di Phase 5.3)**

Customer harus bisa cancel order sendiri, tapi HANYA di status tertentu:
- `waiting_payment` → boleh cancel (belum bayar)
- `packing` → mungkin boleh (tergantung kebijakan)
- `shipping` → TIDAK boleh (sudah dikirim)
- `delivered` → TIDAK boleh

**Yang dibutuhkan:**
- Server Action: `cancelOrderByCustomer(orderId)`
- Validasi status: hanya `waiting_payment` yang boleh
- Restore stock
- Cancel Xendit invoice (via Xendit API)
- Update order status → cancelled
- Button "Batalkan Pesanan" di halaman order detail customer

---

### A4. Payment Pending Page / Countdown Timer
**Status: TIDAK ADA di plan**

Setelah create order, customer di-redirect ke Xendit. Tapi setelah bayar/belum bayar dan kembali ke app:
- Harus ada **halaman yang menampilkan status pembayaran**
- Countdown timer sampai payment expired
- Tombol "Bayar Sekarang" (link ke Xendit invoice)
- Info metode pembayaran yang tersedia

**Yang dibutuhkan:**
- Update `/orders/[id]` page untuk handle status `waiting_payment`:
  - Tampilkan countdown timer (`willExpiredAt` - now)
  - Tampilkan tombol "Bayar Sekarang" (link ke invoiceUrl)
  - Auto-refresh atau polling untuk cek apakah sudah paid
- Xendit success redirect → `/orders/[id]?status=success`
- Xendit failure redirect → `/orders/[id]?status=failed`

---

### A5. Repayment Flow (Bayar Ulang Invoice Expired)
**Status: Disebutkan sekilas di 3.7 tapi tanpa detail**

Ketika payment expired, customer mungkin ingin bayar ulang:
- **TIDAK bisa** pakai invoice Xendit yang sama (sudah expired)
- Harus **buat invoice Xendit BARU**
- Update invoice record di DB dengan ID baru
- Reset order status ke `waiting_payment` dengan expiry baru

**Yang dibutuhkan:**
- Server Action: `repayOrder(orderId)`
- Create new Xendit invoice
- Update invoices table (xenditId, invoiceUrl, status=pending, expiredAt)
- Update orders table (status=waiting_payment, willExpiredAt, expiredAt=null)
- Restore flow: EXPIRED → WAITING_PAYMENT (special transition)
- Button "Bayar Ulang" di order detail (visible saat status expired)

---

### A6. Order Status Transition Validation
**Status: TIDAK ADA di plan**

Tidak boleh sembarangan ubah status order. Harus ada guard:

```
Valid transitions:
waiting_payment → packing      (via Xendit webhook PAID)
waiting_payment → expired      (via Xendit webhook EXPIRED)
waiting_payment → cancelled    (via customer/admin cancel)
packing         → shipping     (via admin send to Bitship)
packing         → cancelled    (via admin cancel)
shipping        → delivered    (via Bitship webhook)
shipping        → cancelled    (via Bitship webhook: returned/rejected)
expired         → waiting_payment (via repayment — special case)

INVALID transitions (harus di-block):
delivered → apapun             (terminal state)
cancelled → apapun             (terminal state, kecuali repayment dari expired)
shipping  → packing            (tidak bisa mundur)
packing   → waiting_payment    (tidak bisa mundur)
```

**Yang dibutuhkan:**
- Helper function `validateStatusTransition(currentStatus, newStatus): boolean`
- Dipanggil di SETIAP tempat yang update order status
- Return error jika transition tidak valid

---

### A7. Webhook Middleware & Auth Exclusion
**Status: TIDAK ADA di plan**

Webhook routes (`/api/webhooks/xendit`, `/api/webhooks/bitship`) harus:
- **Tidak di-protect** oleh NextAuth middleware (karena dipanggil oleh external service)
- Bisa diakses tanpa session/token
- Tapi harus punya **verifikasi sendiri** (callback token)

**Yang dibutuhkan:**
- Update `middleware.ts` untuk exclude `/api/webhooks/*` dari auth check
- Xendit: verifikasi `x-callback-token` header
- Bitship: verifikasi token/signature (jika tersedia)

---

### A8. Payment Expiration Checker (Scheduled/Cron)
**Status: TIDAK ADA di plan**

Masalah: Bagaimana jika Xendit webhook "EXPIRED" **tidak pernah sampai**?
- Order stuck di `waiting_payment` selamanya
- Stok terdeduct selamanya

**Yang dibutuhkan:**
- API route: `GET /api/cron/check-expired-orders`
- Logic: Query orders WHERE status='waiting_payment' AND willExpiredAt < NOW()
- Untuk setiap order yang expired:
  - Update order status → expired
  - Update invoice status → expired
  - Restore stock
- Dipanggil via:
  - Vercel Cron Job (jika deploy di Vercel)
  - External cron service
  - Atau: check on page load (less reliable)

---

## Kategori B: Detail Yang Kurang di Plan Yang Sudah Ada

### B1. Stock Locking (FOR UPDATE) di createOrder
**Phase 3.4 menyebut "Validate form + stock" tapi tidak detail**

Harus pakai row-level lock untuk prevent race condition:
```typescript
await db.transaction(async (tx) => {
  // 1. Lock product rows
  for (const item of cartItems) {
    await tx.execute(
      sql`SELECT stock FROM products WHERE id = ${item.productId} FOR UPDATE`
    );
  }
  // 2. Re-validate stock
  // 3. Deduct stock
  // 4. Insert order
});
```

---

### B2. Webhook Idempotency (Cek Duplikat)
**Phase 6.1 menyebut "webhook idempotency" tapi tanpa detail**

Xendit bisa kirim webhook yang sama berkali-kali. Harus handle:
```typescript
// Di Xendit webhook handler:
const invoice = await db.query.invoices.findFirst({ where: orderId });
if (invoice.status === 'paid') {
  return Response.json({ ok: true }); // Already processed, skip
}
```

Bitship juga bisa kirim event duplikat:
- Dedup berdasarkan tracking_id + status + timestamp
- Atau simpan event_id dari Bitship

---

### B3. Xendit Invoice SETELAH DB Transaction (Bukan Sebelum)
**Phase 3.4 flow salah — invoice dibuat SEBELUM transaction**

Masalah: Jika Xendit sukses tapi DB transaction gagal:
- Xendit invoice ada → customer bisa bayar
- Tapi order tidak ada di DB → webhook 404

**Fix di plan:**
```
Flow yang BENAR:
1. Validate form + stock
2. Generate orderId (UUID/CUID)
3. Transaction:
   - Lock & validate stock
   - Insert order, order_items, shipping
   - Deduct stock, clear cart
4. SETELAH transaction sukses → Create Xendit invoice
5. Insert invoice record
6. Return paymentUrl
```
Jika Xendit gagal di step 4, order sudah ada tapi tanpa invoice → bisa retry create invoice.

---

### B4. Bitship Send Order — Idempotency & Error Recovery
**Phase 4.1 tidak handle jika Bitship API gagal setelah request terkirim**

Masalah: Admin klik "Kirim" → Bitship terima tapi response timeout → Admin klik lagi → **2 shipment**

**Yang perlu ditambah:**
- Cek apakah shipping sudah punya trackingId (sudah pernah dikirim)
- Jika sudah ada trackingId → jangan create order baru, fetch tracking saja
- Simpan Bitship order attempt status

---

### B5. Partial Checkout (Stok Tidak Cukup)
**Tidak dibahas di plan**

Scenario: Cart ada 5 item, tapi 2 item stoknya habis saat checkout.
- Opsi A: Tolak semua (current approach) — "Stok tidak mencukupi"
- Opsi B: Checkout yang available saja (MySCI approach) — lebih user-friendly
- Opsi C: Tampilkan warning, biarkan customer pilih

Untuk MVP, **Opsi A sudah cukup** — tapi harus ada **clear error message** per item.

---

### B6. Order List Customer — Status Tabs
**Phase 3.7 / 4.5 hanya menyebut "update order detail page"**

Customer orders page (`/orders`) perlu:
- **Tabs berdasarkan status**: Belum Bayar | Dikemas | Dikirim | Selesai | Dibatalkan
- Count per tab
- Filter/tab selection via URL query params (nuqs sudah ada)

---

### B7. Xendit Invoice Cancellation via API
**Phase 5.3 cancel order tidak menyebut cancel di Xendit**

Ketika admin/customer cancel order yang masih `waiting_payment`:
- Harus **expire/cancel invoice di Xendit** juga (via Xendit API)
- Kalau tidak, customer masih bisa bayar invoice yang sudah di-cancel di DB
- Xendit webhook PAID datang → order cancelled tapi invoice paid → conflict

```typescript
// Xendit SDK
await xenditClient.Invoice.expireInvoice({ invoiceId: invoice.xenditId });
```

---

### B8. Checkout Form — Shipping Address from Address Book
**Phase 2.4-2.6 menyebut multi-step checkout tapi tidak detail soal alamat**

Checkout flow yang benar:
1. **Pilih Alamat** (dari address book, atau input baru)
2. **Pilih Kurir** (fetch rates berdasarkan alamat terpilih)
3. **Review & Bayar**

Saat ini plan langsung ke "input alamat di checkout form" → tidak pakai address book.

---

## Kategori C: Nice-to-Have (Tidak Blocking tapi Penting)

### C1. Order Status History / Audit Trail
- Tabel `order_status_logs`: orderId, fromStatus, toStatus, changedBy (user/system/webhook), changedAt, note
- Untuk debugging: "kapan order ini berubah status dan oleh siapa?"

### C2. Admin Notification (Order Masuk)
- Ketika ada order baru (paid) → notifikasi ke admin
- Bisa: email, atau badge count di dashboard
- Minimal: tampilkan count "X order menunggu dikemas" di dashboard

### C3. Shipping Cost Display di Order Detail
- Tampilkan breakdown: Subtotal Produk + Ongkos Kirim = Total
- Tampilkan nama kurir, estimasi pengiriman

### C4. Cart Validation Before Checkout
- Sebelum masuk checkout, validasi ulang:
  - Semua item masih ada stok?
  - Product masih active?
  - Harga belum berubah?
- Jika ada masalah, tampilkan warning di cart

### C5. Checkout Session Timeout
- Jika customer di checkout page > 30 menit tanpa bayar
- Tampilkan warning "Session akan expired"
- Atau: tidak perlu (karena stok baru di-deduct saat create order, bukan saat masuk checkout)

### C6. Invoice PDF Generation
- Admin bisa generate PDF invoice untuk order yang sudah paid
- Pakai `@react-pdf/renderer` atau server-side HTML-to-PDF

---

## Summary: Items yang Harus Masuk ke Plan

### MUST HAVE (Blocking — tanpa ini sistem tidak bisa end-to-end)

| # | Item | Phase yang Terdampak |
|---|------|---------------------|
| A1 | Address Management System | Phase 0 (ganti lat/lng di users → tabel addresses) |
| A2 | Stock Restoration | Phase 3, 4, 5 |
| A3 | Customer Cancel Order | Phase 3 atau 5 |
| A4 | Payment Pending Page + Countdown | Phase 3 |
| A5 | Repayment Flow (Bayar Ulang) | Phase 3 |
| A6 | Status Transition Validation | Phase 1 (helper), dipakai semua phase |
| A7 | Webhook Auth Exclusion + Verification | Phase 3, 4 |
| A8 | Payment Expiration Checker | Phase 3 atau 6 |
| B1 | Stock Locking (FOR UPDATE) | Phase 3.4 |
| B3 | Xendit Invoice SETELAH DB Transaction | Phase 3.4 |
| B4 | Bitship Send Idempotency | Phase 4.1 |
| B7 | Xendit Invoice Cancellation on Cancel | Phase 5.3 |
| B8 | Checkout Address Selection | Phase 2 |

### SHOULD HAVE (Penting untuk UX tapi tidak blocking)

| # | Item | Phase yang Terdampak |
|---|------|---------------------|
| B2 | Webhook Idempotency Detail | Phase 3, 4 |
| B5 | Partial Checkout / Error per Item | Phase 3 |
| B6 | Order List Status Tabs | Phase 3 atau 5 |
| C1 | Order Status Audit Trail | Phase 1 (tabel) |
| C2 | Admin Notification | Phase 5 |
| C3 | Shipping Cost Breakdown Display | Phase 2 |
| C4 | Cart Validation Before Checkout | Phase 2 |
