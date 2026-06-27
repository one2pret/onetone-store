# Setup Bitship (Shipping API) — Staging/Sandbox

> Step-by-step untuk integrasi Bitship ke Next Olshop di environment sandbox (test mode).
> Order API di sandbox tidak mengirim paket sungguhan.

---

## 1. Buat Akun Bitship

1. Buka [https://dashboard.biteship.com/signup](https://dashboard.biteship.com/signup)
2. Isi form registrasi:
   - **Nama depan & belakang**
   - **Nomor HP** — harus unik (belum terdaftar sebelumnya)
   - **Email**
   - **Password**
3. Klik **Register / Daftar**
4. Cek inbox email → klik link verifikasi
5. Login ke dashboard: [https://dashboard.biteship.com/signin](https://dashboard.biteship.com/signin)

---

## 2. Masuk ke Mode Testing (Sandbox)

1. Login ke [https://dashboard.biteship.com](https://dashboard.biteship.com)
2. Di **sidebar kiri**, cari toggle **"Mode Testing"**
3. Klik toggle untuk switch ke **Testing Mode**
4. Dashboard akan menunjukkan bahwa kamu di mode testing

### Perbedaan Sandbox vs Production

| Fitur | Sandbox | Production |
|-------|---------|------------|
| **Order API** (buat pengiriman) | Simulasi, kurir tidak benar-benar kirim | Kurir sungguhan |
| **Rates API** (cek ongkir) | Data real (tetap dihitung usage) | Data real |
| **Tracking API** (lacak paket) | Data real (tetap dihitung usage) | Data real |
| **Webhook** | Berfungsi normal | Berfungsi normal |

> **PENTING**: Rates API dan Tracking API menggunakan data real meskipun di sandbox, dan dihitung sebagai **paid usage**. Minta kuota gratis ke Bitship support (hingga 5.000 request gratis untuk sandbox).

---

## 3. Dapatkan API Key

1. Buka halaman **Integrations**: [https://dashboard.biteship.com/integrations](https://dashboard.biteship.com/integrations)
2. Klik **"Pengaturan"** (Settings)
3. Klik **"Tambah Kunci API"** (Add API Key)
4. Beri nama key: misal `next-olshop-test`
5. Klik confirm/generate
6. **COPY KEY SEKARANG** — key hanya ditampilkan sekali!

Key sandbox punya prefix: `biteship_test.`

Contoh: `biteship_test.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Simpan ke `.env`:

```bash
BITSHIP_API_KEY=biteship_test.YOUR_API_KEY_HERE
BITSHIP_API_URL=https://api.biteship.com
```

> **URL sama** untuk sandbox dan production. Yang menentukan environment adalah **prefix key**: `biteship_test.` vs `biteship_live.`

---

## 4. Setup Webhook untuk Tracking Update

Webhook Bitship mengirim notifikasi setiap kali status pengiriman berubah.

### 4a. Untuk Local Development (pakai ngrok)

1. Jalankan Next.js app: `pnpm dev`
2. Jalankan ngrok:
   ```bash
   ngrok http 3000
   ```
3. Copy URL ngrok: `https://abc123.ngrok-free.app`

### 4b. Tambah Webhook di Dashboard

1. Buka [https://dashboard.biteship.com/integrations](https://dashboard.biteship.com/integrations)
2. Klik **"Pengaturan"** (Settings)
3. Klik **"Tambah Webhook"** (Add Webhook)
4. Masukkan URL:
   ```
   https://abc123.ngrok-free.app/api/webhooks/bitship
   ```
5. Pilih events yang mau di-subscribe:
   - **`order.status`** — status pengiriman berubah (WAJIB)
   - **`order.waybill_id`** — waybill number di-update
   - **`order.price`** — harga aktual berbeda dari estimasi
6. Klik **Save**

**Untuk production nanti:**
```
https://yourdomain.com/api/webhooks/bitship
```

### Webhook Payload Contoh (`order.status`)

```json
{
  "event": "order.status",
  "order_id": "biteship-order-id-123",
  "courier_tracking_id": "BITSHIP-TRK-001",
  "courier_waybill_id": "JNE1234567890",
  "courier_company": "jne",
  "status": "delivered",
  "order_price": 38000
}
```

### Status Tracking yang Dikirim Bitship

| Status | Arti | Aksi di App |
|--------|------|-------------|
| `confirmed` | Order dikonfirmasi kurir | — (tetap shipping) |
| `allocated` | Kurir dialokasikan | — (tetap shipping) |
| `pickingUp` | Kurir menuju pickup | — (tetap shipping) |
| `picked` | Paket diambil | — (tetap shipping) |
| `droppingOff` | Paket dalam perjalanan | — (tetap shipping) |
| `delivered` | Paket diterima | Order → **delivered** |
| `rejected` | Ditolak | Order → **cancelled** + restore stok |
| `returned` | Dikembalikan | Order → **cancelled** + restore stok |
| `cancelled` | Dibatalkan | Order → **cancelled** + restore stok |
| `onHold` | Ditahan | — (tetap shipping) |

---

## 5. Konfigurasi `.env` Lengkap

```bash
# Bitship (Sandbox)
BITSHIP_API_KEY=biteship_test.YOUR_API_KEY_HERE
BITSHIP_API_URL=https://api.biteship.com
```

---

## 6. Testing API — Cek Ongkir

Setelah key terpasang, test cek ongkir via curl:

```bash
curl -X POST https://api.biteship.com/v1/rates/couriers \
  -H "Authorization: biteship_test.YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "origin_latitude": -6.1380,
    "origin_longitude": 106.8294,
    "destination_latitude": -6.2441,
    "destination_longitude": 106.7834,
    "couriers": "jne,sicepat,jnt,anteraja,tiki",
    "items": [
      {
        "name": "iPhone 15 Pro Max",
        "value": 19500000,
        "quantity": 1,
        "weight": 221
      }
    ]
  }'
```

Response akan berisi list kurir + harga + estimasi waktu.

---

## 7. Testing API — Buat Order (Simulasi)

```bash
curl -X POST https://api.biteship.com/v1/orders \
  -H "Authorization: biteship_test.YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "origin_contact_name": "Toko NextElektronik",
    "origin_contact_phone": "081234567890",
    "origin_address": "Jl. Mangga Dua Raya No. 1, Jakarta Utara",
    "origin_coordinate": {"latitude": -6.1380, "longitude": 106.8294},
    "destination_contact_name": "Rina Kartika",
    "destination_contact_phone": "081298765432",
    "destination_address": "Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan",
    "destination_coordinate": {"latitude": -6.2441, "longitude": 106.7834},
    "courier_company": "jne",
    "courier_type": "reg",
    "delivery_type": "now",
    "items": [
      {
        "name": "iPhone 15 Pro Max",
        "value": 19500000,
        "quantity": 1,
        "weight": 221
      }
    ]
  }'
```

Di sandbox, response berisi `id`, `courier_tracking_id`, `courier_waybill_id` tapi kurir tidak benar-benar kirim.

---

## 8. Testing di App — Full Flow

### 8a. Cek Ongkir di Checkout

1. Login sebagai customer (misal `rina@gmail.com`)
2. Tambah produk ke cart
3. Buka halaman checkout
4. Pilih alamat → App memanggil `calculateShippingRates`
5. Bitship API mengembalikan list kurir + harga
6. Pilih kurir → lanjut ke pembayaran

### 8b. Admin Kirim Order

1. Login sebagai admin (`admin@store.com`)
2. Buka order yang berstatus **Packing**
3. Klik tombol **"Kirim Pesanan"**
4. App memanggil `sendOrderToBitship` → Bitship API `POST /v1/orders`
5. Order berubah ke status **Shipping**
6. Tracking ID dan Waybill ID tersimpan

### 8c. Tracking Update via Webhook

Di sandbox, webhook tracking mungkin tidak otomatis ter-trigger karena order disimulasi. Kamu bisa test webhook secara manual:

```bash
curl -X POST http://localhost:3000/api/webhooks/bitship \
  -H "Content-Type: application/json" \
  -d '{
    "event": "order.status",
    "courier_tracking_id": "BITSHIP-TRK-001",
    "courier_waybill_id": "JNE1234567890",
    "courier_company": "jne",
    "status": "delivered"
  }'
```

Ini akan trigger app untuk update order → delivered.

---

## 9. Verifikasi Integrasi — Checklist

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Checkout → pilih alamat → cek ongkir | List kurir muncul dengan harga |
| 2 | Pilih kurir → lanjut bayar | Shipping cost ter-apply di total |
| 3 | Admin klik "Kirim Pesanan" (packing) | Order → shipping, tracking ID tersimpan |
| 4 | Webhook `delivered` diterima | Order → delivered, timestamp di-set |
| 5 | Webhook `cancelled` diterima | Order → cancelled, stok dikembalikan |
| 6 | Tracking timeline tampil | History step-by-step muncul di order detail |
| 7 | Rate API gagal (server error) | Error message muncul, tidak crash |

---

## 10. Switch ke Production (Nanti)

Ketika siap go-live:

1. Di dashboard Bitship, switch dari **Testing** ke **Production** mode
2. Generate API Key baru (prefix `biteship_live.`)
3. **Aktifkan Order API** — di production, Order API harus di-request aktivasi terpisah ke Bitship
4. Set webhook URL production: `https://yourdomain.com/api/webhooks/bitship`
5. Update `.env` di server:
   ```bash
   BITSHIP_API_KEY=biteship_live.YOUR_PRODUCTION_KEY
   BITSHIP_API_URL=https://api.biteship.com
   ```

> URL tetap sama (`https://api.biteship.com`), yang berubah hanya key-nya.

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `401` / `Authorization failed` | Cek API key benar, pastikan prefix `biteship_test.` |
| Rates API return empty | Cek koordinat valid, cek courier code ada di list |
| Webhook tidak diterima | Cek ngrok running, cek URL di dashboard, cek event `order.status` di-subscribe |
| Order API gagal di production | Order API perlu aktivasi terpisah — hubungi Bitship |
| Kuota habis | Minta kuota gratis 5.000 request ke Bitship support |
| Ongkir mahal/aneh | Double-check berat produk (dalam gram), cek koordinat origin store benar |

---

## Referensi

- [Bitship Dashboard](https://dashboard.biteship.com)
- [Bitship API Docs](https://biteship.com/id/docs)
- [Bitship Sandbox Docs](https://biteship.com/en/docs/sandbox)
- [Bitship Rates API](https://biteship.com/en/docs/api/rates/retrieve)
- [Bitship Order API](https://biteship.com/id/docs/api/orders/create)
- [Bitship Tracking API](https://biteship.com/en/docs/api/trackings/retrieve_public)
- [Bitship Webhook Docs](https://biteship.com/en/docs/api/webhook/overview)
