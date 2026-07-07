# POS Module — Dokumentasi Ringkasan

> Modul kasir offline untuk onetone-store.
> Status: **Phase 1 (MVP) selesai** — siap dipakai produksi.
> Terakhir diupdate: 2026-07-07

---

## 1. Ringkasan Eksekutif

**Apa yang dibangun:**
- Sistem kasir berbasis web (mobile-first), full-screen mode terpisah dari admin panel
- Reuse infrastruktur toko online: produk, varian, stok, R2 storage — zero duplikasi
- Session-based (konsep Odoo POS): buka kasir → transaksi → tutup kasir dengan Z-report
- 3 metode pembayaran: Tunai, QRIS statis, Transfer manual
- Struk dapat di-print via browser (58mm) atau dishare ke WhatsApp

**Filosofi desain:**
- POS = **channel penjualan kedua**, bukan sistem terpisah
- Tabel `orders` dipakai bersama online + POS (via kolom `channel`)
- Stok POS pakai `lib/stock.ts` — sama dengan checkout online, sinkron real-time

**Yang bisa dikerjakan setelah P1:**
- Kasir jualan offline, stok berkurang otomatis di website & aplikasi
- Admin lihat rekap Z-report per sesi, selisih kas, riwayat transaksi
- Setting QRIS dan footer struk dari halaman pengaturan

---

## 2. Arsitektur & Keputusan Kunci

### 2.1 Schema — kolom baru di `orders`

```typescript
channel: mysqlEnum(['online', 'pos']).default('online')
posSessionId: int (nullable, FK ke pos_sessions)
posPaymentMethod: mysqlEnum(['cash', 'qris', 'transfer']) (nullable)
cashReceived: decimal (nullable)
cashChange: decimal (nullable)
userId: nullable (untuk walk-in customer POS tanpa akun)
shippingAddress/Phone/Name: nullable (POS tidak butuh alamat kirim)
```

### 2.2 Tabel baru: `pos_sessions`

```typescript
id, cashierId, openedAt, closedAt,
openingCash, closingCash, expectedCash, cashDifference,
status: ['open', 'closed'], notes
```

- 1 sesi = 1 shift kasir
- `expectedCash` = `openingCash` + total cash sales dalam sesi
- `cashDifference` = `closingCash` (fisik) − `expectedCash` (sistem) → untuk audit

### 2.3 Reuse Existing (WAJIB dipahami)

| Fungsi | Sumber | Dipakai di |
|--------|--------|-----------|
| Validasi stok | `lib/stock.ts::validateStock` | createPosOrder + checkout online |
| Kurangi stok | `lib/stock.ts::deductStock` | createPosOrder + checkout online |
| Upload R2 | `lib/storage.ts` | uploadPosQris + upload produk |
| Auth check | `lib/auth.ts` | semua server actions POS |

**Aturan emas:** kalau nanti perlu perubahan logic stok, edit satu tempat saja (`lib/stock.ts`), otomatis online + POS sinkron.

### 2.4 Role & akses (MVP)

- POS hanya dapat diakses user dengan `role='admin'`
- Enum `users.role` **tidak ditambahkan** `cashier` — sengaja skip untuk simplicity MVP
- Kalau nanti butuh multi-kasir tanpa akses admin penuh, tambah role `cashier` + update middleware

### 2.5 Payment methods

- **Tunai** — numpad + quick amount (uang pas / 20K / 50K / 100K / 200K / 500K), kembalian dihitung otomatis
- **QRIS statis** — gambar QRIS diupload sekali di settings, kasir tunjukkan ke customer, konfirmasi manual
- **Transfer** — kasir konfirmasi manual setelah cek mutasi bank

QRIS dinamis via Xendit adalah fitur P2 (butuh integrasi API + webhook).

---

## 3. Struktur File

### 3.1 Backend (`app/actions/`)

```
pos-sessions.ts    ─ openSession, closeSession, getActiveSession,
                     getSessionSummary, getAllPosSessions,
                     getPosSessionDetail, getTodayPosSales

pos-orders.ts      ─ createPosOrder, getPosOrder, getPosProducts,
                     getRecentPosOrders

pos-settings.ts    ─ getPosSettings, uploadPosQris, removePosQris,
                     updateReceiptFooter
```

### 3.2 UI Kasir (`app/(pos)/` + `components/pos/`)

```
app/(pos)/
├── layout.tsx                    ─ full-screen, admin-only auth
└── pos/
    ├── page.tsx                  ─ router: buka sesi / layar kasir
    └── close/page.tsx            ─ halaman tutup kasir (Z-report)

components/pos/
├── OpenSessionForm.tsx           ─ form buka kasir (modal awal)
├── CashierScreen.tsx             ─ layar kasir utama + variant picker + cart
├── PaymentSheet.tsx              ─ overlay pembayaran (tunai/QRIS/transfer)
├── ReceiptView.tsx               ─ layar sukses + struk print/WA
└── CloseSessionForm.tsx          ─ Z-report + rekonsiliasi kas
```

### 3.3 Admin (`app/(admin)/`)

```
app/(admin)/dashboard/pos/sessions/
├── page.tsx                      ─ list semua sesi kasir
└── [id]/page.tsx                 ─ detail Z-report + transaksi

app/(admin)/dashboard/settings/_components/
└── PosSettingsCard.tsx           ─ upload QRIS + footer struk
```

### 3.4 File yang dimodifikasi

- `lib/db/schema.ts` — kolom baru orders + tabel pos_sessions + relations + types
- `lib/storage.ts` — tambah `Cache-Control: immutable` untuk semua upload
- `components/admin/AdminSidebar.tsx` — menu "Kasir (POS)" & "Sesi POS"
- `app/(admin)/dashboard/page.tsx` — card "POS Hari Ini"
- `app/(admin)/dashboard/settings/page.tsx` — integrasi PosSettingsCard

---

## 4. Cara Pakai

### 4.1 Setup awal (admin, sekali saja)

1. Login sebagai admin
2. Buka `/dashboard/settings`
3. Scroll ke "Pengaturan POS"
4. Upload gambar QRIS statis (dari bank/e-wallet merchant)
5. Isi footer struk (contoh: "Terima kasih! Retur maks 7 hari + struk")

### 4.2 Alur kasir harian

```
Login admin
   ↓
Klik "Kasir (POS)" di sidebar (atau langsung /pos)
   ↓
Buka Kasir → masukkan modal awal (uang kembalian di laci)
   ↓
Cari produk / filter kategori / pilih varian → masuk cart
   ↓
Klik BAYAR → pilih metode → konfirmasi
   ↓
Layar struk → Print / Kirim WA / Transaksi Baru
   ↓
(akhir shift) → icon LogOut → halaman tutup kasir
   ↓
Hitung uang fisik → input ke sistem → lihat selisih
   ↓
Tutup Sesi → kembali ke halaman buka kasir
```

### 4.3 Alur admin (rekap)

```
/dashboard                       ─ card "POS Hari Ini" (total + jumlah tx)
/dashboard/pos/sessions          ─ list semua sesi + status + selisih
/dashboard/pos/sessions/[id]     ─ detail Z-report + list transaksi per sesi
/dashboard/orders                ─ semua order (online + POS, kolom channel)
```

---

## 5. Route Reference

| Path | Access | Deskripsi |
|------|--------|-----------|
| `/pos` | admin | Layar kasir utama (auto redirect ke buka sesi kalau belum ada) |
| `/pos/close` | admin | Tutup sesi + Z-report |
| `/dashboard/pos/sessions` | admin | List semua sesi kasir |
| `/dashboard/pos/sessions/[id]` | admin | Detail sesi + transaksi |
| `/dashboard/settings` | admin | Upload QRIS + footer struk (di section POS) |

---

## 6. Data Flow

### 6.1 Buat transaksi POS

```
[UI] CashierScreen.addToCart → local state cart
   ↓
[UI] PaymentSheet.handleConfirm → createPosOrder(sessionId, items, method, cashReceived)
   ↓
[Server] pos-orders.ts::createPosOrder
   1. Auth check (admin only)
   2. Validasi sesi aktif + ownership
   3. Ambil detail produk/varian → hitung unit price + subtotal
   4. validateStock() ← reuse lib/stock.ts
   5. Hitung kembalian jika tunai
   6. INSERT orders (channel='pos', status='delivered', paidAt=NOW)
   7. INSERT order_items (snapshot: nama, varian, harga)
   8. deductStock() ← reuse lib/stock.ts
   9. revalidatePath /pos, /dashboard/orders, /dashboard/products
   ↓
[UI] ReceiptView load pakai getPosOrder(orderId)
```

### 6.2 Tutup sesi + Z-report

```
[UI] CloseSessionForm submit → closeSession(sessionId, closingCash, notes)
   ↓
[Server] pos-sessions.ts::closeSession
   1. Auth check + ownership
   2. getSessionSummary → agregasi order per payment method
   3. Hitung cashDifference = closingCash - expectedCash
   4. UPDATE pos_sessions (closedAt, closingCash, expectedCash,
      cashDifference, status='closed')
   ↓
[UI] router.push('/pos') → tampil form buka kasir baru
```

---

## 7. Yang Sengaja Di-Skip di P1

| Item | Alasan | Recommend Phase |
|------|--------|-----------------|
| Role `cashier` | Simplicity MVP, admin cukup | P2 kalau multi-kasir |
| Barcode scan | Hardware belum ada di klien | P2 |
| Thermal printer Bluetooth | Print browser sudah jalan | P2 (RawBT/Web Bluetooth) |
| Diskon per item | Belum ada permintaan klien | P2 |
| Retur/refund | Kompleks (audit trail) | P2 |
| QRIS dinamis Xendit | Butuh aktivasi merchant | P2 |
| Reprint struk | Butuh riwayat di layar kasir | P2 |
| Offline mode | Butuh Service Worker complex | P3 |
| Multi-outlet | Butuh refactor stok per lokasi | P3 |
| Unit test createPosOrder | Manual test sudah cukup MVP | Kapanpun |

---

## 8. Optimasi yang Sudah Diterapkan

### 8.1 Bandwidth R2

- **Cache-Control `immutable`** di `lib/storage.ts` — filename UUID aman cache selamanya di browser & CDN edge
- **Thumbnail (400px)** di katalog POS, bukan main (800px) — hemat ~4x
- **Priority + eager loading** untuk 8 gambar first-fold — fix warning LCP + first paint cepat

**Estimasi cost R2 untuk POS operasi normal:** < Rp 200/bulan (praktis gratis)

### 8.2 UX

- **Sticky BAYAR button** — pakai `flex-1 min-h-0` + `shrink-0` supaya tombol selalu terlihat meski cart panjang
- **Cart bottom sheet** di mobile — full-screen 85svh dengan overflow internal
- **Variant picker** — bottom sheet muncul otomatis kalau produk punya varian
- **Quick cash buttons** — uang pas / kelipatan umum untuk speed
- **Auto refresh stok** setelah tiap transaksi via `router.refresh()`

---

## 9. Troubleshooting

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| "Sesi kasir bukan milikmu" | User login ganti tapi sesi terbuka milik admin lain | Login sebagai owner sesi, atau tutup sesi dari database manual |
| Tombol BAYAR tidak terlihat | Cache CSS lama di Turbopack | Hard refresh browser (Cmd+Shift+R) |
| Gambar produk blank di POS | R2 CDN URL salah / thumb belum digenerate | Cek object exists di R2, verifikasi `NEXT_PUBLIC_CDN_URL` |
| QRIS tidak muncul saat pilih QRIS | Belum upload gambar QRIS | Ke `/dashboard/settings` → Pengaturan POS → upload |
| Stok tidak berkurang setelah transaksi | validateStock gagal / order tidak insert | Cek console error, lihat log server action |
| Warning LCP di console | Gambar first-fold tanpa priority | Sudah difix — cek `ProductCard` pakai `priority` prop |

---

## 10. Roadmap Berikutnya

### Phase 2 (upgrade operasional, ~1 minggu)

- [ ] Barcode scanning via kamera HP (`html5-qrcode`)
- [ ] PWA — installable, ikon home screen (butuh `manifest.json` + service worker basic)
- [ ] Thermal printer Bluetooth (rekomendasi: RawBT Android intent — zero coding)
- [ ] Diskon per item / per order (schema: `order_items.discountAmount`)
- [ ] Refund / retur → `restoreStock()` reuse, status `refunded`
- [ ] QRIS dinamis via Xendit (webhook auto-confirm)
- [ ] Riwayat transaksi + reprint struk di layar kasir
- [ ] PIN login cepat untuk ganti kasir tanpa logout email/password

### Phase 3 (skala & white-label)

- [ ] Offline mode: IndexedDB queue + Service Worker
- [ ] Laporan Excel: harian/mingguan/bulanan, produk terlaris, jam ramai
- [ ] Customer lookup by no. HP → basis loyalty/member
- [ ] Multi-outlet: tabel `locations` + stok per lokasi
- [ ] Shift management per kasir + laporan performa

---

## 11. Perintah Cepat

```bash
# Push schema baru (setelah edit lib/db/schema.ts)
pnpm db:push

# Dev server
pnpm dev

# Type check
npx tsc --noEmit
```

**Demo login:**
- Admin: `admin@store.com` / `password123`
- Buka `/pos` setelah login

---

*Dikelola oleh: Wawan (solo developer)*
*AI Assistance: Claude Code (implementasi P1 MVP)*
