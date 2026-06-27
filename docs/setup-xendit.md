# Setup Xendit (Payment Gateway) — Staging/Sandbox

> Step-by-step untuk integrasi Xendit ke Next Olshop di environment sandbox (test mode).
> Tidak ada uang sungguhan yang dipotong di test mode.

---

## 1. Buat Akun Xendit

1. Buka [https://dashboard.xendit.co/register](https://dashboard.xendit.co/register)
2. Isi form registrasi:
   - **Email** — gunakan email bisnis atau pribadi
   - **Password** — minimal 8 karakter
   - **Nama bisnis** — misal: "NextElektronik" atau nama toko kamu
   - **Tipe bisnis** — pilih yang sesuai (individual/CV/PT)
3. Klik **Register**
4. Cek inbox email → klik link verifikasi
5. Login ke dashboard

> Setelah register, kamu **langsung dapat akses Test Mode** tanpa perlu verifikasi dokumen. Verifikasi KYB hanya diperlukan untuk Live Mode (transaksi sungguhan).

---

## 2. Masuk ke Test Mode

1. Login ke [https://dashboard.xendit.co](https://dashboard.xendit.co)
2. Lihat **pojok kiri bawah** — ada nama bisnis kamu
3. Klik nama bisnis → toggle ke **"Test Mode"**
4. Akan muncul label/indikator bahwa kamu di **Test Mode**

> Di Test Mode, kamu mendapat saldo virtual **Rp 1.000.000.000** untuk testing.

---

## 3. Dapatkan Secret API Key

1. Pastikan kamu di **Test Mode**
2. Buka **Settings → Developers → API Keys**
   - Direct URL: [https://dashboard.xendit.co/settings/developers](https://dashboard.xendit.co/settings/developers)
3. Klik **"Generate Secret Key"**
4. Pilih permission: **Money-in** (untuk invoice/payment) — atau **All Access** untuk testing
5. Masukkan password untuk konfirmasi
6. **COPY KEY SEKARANG** — key hanya ditampilkan sekali!

Key test mode punya prefix: `xnd_development_`

Contoh: `xnd_development_OC1234abcdef567890ghijk`

### Simpan ke `.env`:

```bash
XENDIT_SECRET_KEY=xnd_development_XXXXXXXXXXXXXXXXXXXXXXX
```

---

## 4. Setup Webhook URL & Dapatkan Verification Token

### 4a. Dapatkan x-callback-token

1. Masih di **Settings → Developers**
2. Scroll ke bagian **Callbacks / Webhooks**
3. Cari field **"Verification Token"** atau **"Callback Verification Token"**
4. Copy token ini

### Simpan ke `.env`:

```bash
XENDIT_WEBHOOK_TOKEN=xendit_callback_token_yang_kamu_copy
```

### 4b. Set Webhook URL

Webhook URL adalah endpoint di app kamu yang akan menerima notifikasi dari Xendit saat ada pembayaran.

**Untuk local development (pakai ngrok):**

1. Install ngrok: `brew install ngrok` (Mac) atau download dari [ngrok.com](https://ngrok.com)
2. Jalankan Next.js app: `pnpm dev`
3. Jalankan ngrok:
   ```bash
   ngrok http 3000
   ```
4. Copy URL ngrok, misal: `https://abc123.ngrok-free.app`
5. Di Xendit dashboard, set webhook URL:
   ```
   https://abc123.ngrok-free.app/api/webhooks/xendit
   ```

**Di Xendit Dashboard:**

1. Buka **Settings → Developers → Callbacks**
2. Cari section **"Invoice"** atau **"Invoices paid"**
3. Masukkan URL webhook:
   ```
   https://YOUR_DOMAIN/api/webhooks/xendit
   ```
4. Klik **"Test and Save"** — Xendit akan kirim test request, endpoint harus return status `2XX`

> **PENTING**: Untuk setiap channel payment (Invoice, VA, eWallet), pastikan webhook URL sudah di-set.

**Untuk production nanti:**
```
https://yourdomain.com/api/webhooks/xendit
```

---

## 5. Konfigurasi `.env` Lengkap

```bash
# Xendit (Test/Sandbox)
XENDIT_SECRET_KEY=xnd_development_XXXXXXXXXXXXXXXXXXXXXXX
XENDIT_WEBHOOK_TOKEN=xendit_verification_token_kamu

# Base URL (untuk redirect setelah bayar)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
# Jika pakai ngrok:
# NEXT_PUBLIC_BASE_URL=https://abc123.ngrok-free.app
```

---

## 6. Testing Pembayaran di Sandbox

### 6a. Flow Test Pembayaran (Invoice)

1. Login sebagai customer di app
2. Tambah produk ke cart → Checkout → Pilih alamat → Pilih kurir
3. Klik **"Bayar Sekarang"** → Redirect ke halaman Xendit
4. Di halaman Xendit (test mode), pilih metode pembayaran
5. Bayar (simulated) → Xendit kirim webhook `PAID` ke app
6. Order otomatis berubah ke status **Packing**

### 6b. Simulasi Virtual Account (VA)

Jika ingin simulasi VA payment via API (tanpa UI):

```bash
curl -X POST https://api.xendit.co/callback_virtual_accounts/external_id={ORDER_NUMBER}/simulate_payment \
  -u xnd_development_YOUR_KEY: \
  -H "Content-Type: application/json" \
  -d '{"amount": 100000}'
```

Ganti `{ORDER_NUMBER}` dengan order number dari app (contoh: `ORD260427A1B2`).

### 6c. Simulasi eWallet / QRIS

Di test mode, ketika redirect ke halaman pembayaran Xendit:
- Ada **tombol simulasi merah** untuk trigger pembayaran sukses/gagal
- Tidak perlu app OVO/DANA/ShopeePay sungguhan

### 6d. Simulasi Invoice Expired

Biarkan invoice tanpa dibayar selama 24 jam (atau sesuai `invoiceDuration`).
Atau jalankan cron safety net:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/check-expired-orders
```

### 6e. Test Card Numbers (jika pakai card payment)

| Card Number | Brand | Hasil |
|-------------|-------|-------|
| `4000000000001000` | VISA | Sukses (3DS frictionless) |
| `5200000000001005` | Mastercard | Sukses (3DS frictionless) |
| `4000000000002503` | VISA | Challenge OTP (bisa sukses/gagal) |

Expiry: gunakan tanggal apapun di masa depan. CVV: 3 digit random.

---

## 7. Verifikasi Integrasi — Checklist

Setelah semua setup selesai, test flow berikut:

| # | Test Case | Expected |
|---|-----------|----------|
| 1 | Customer checkout → redirect ke Xendit | Halaman payment Xendit tampil |
| 2 | Bayar via VA (simulasi) | Webhook `PAID` diterima, order → packing |
| 3 | Bayar via QRIS (simulasi) | Sama, order → packing |
| 4 | Biarkan invoice expired | Webhook `EXPIRED` diterima, order → expired, stok kembali |
| 5 | Customer cancel order | Invoice di-expire, stok dikembalikan |
| 6 | Customer bayar ulang (expired order) | Invoice baru dibuat, redirect ke Xendit lagi |
| 7 | Cron check-expired-orders | Order expired yang terlewat webhook → expired + stok kembali |

---

## 8. Switch ke Production (Nanti)

Ketika siap go-live:

1. Di Xendit dashboard, submit dokumen KYB (verifikasi ~1-3 hari kerja)
2. Setelah approved, switch ke **Live Mode** di dashboard
3. Generate **Secret Key** baru (prefix `xnd_production_`)
4. Copy **Verification Token** untuk Live Mode
5. Set webhook URL production: `https://yourdomain.com/api/webhooks/xendit`
6. Update `.env` di server:
   ```bash
   XENDIT_SECRET_KEY=xnd_production_XXXXXXXXXXXXXXXXXXXXXXX
   XENDIT_WEBHOOK_TOKEN=production_verification_token
   NEXT_PUBLIC_BASE_URL=https://yourdomain.com
   ```

> **PENTING**: Jangan pernah commit `xnd_production_*` key ke git!

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Webhook tidak diterima | Cek ngrok running, cek URL di dashboard benar, cek endpoint return 2XX |
| `401 Unauthorized` di webhook | Cek `XENDIT_WEBHOOK_TOKEN` di `.env` match dengan token di dashboard |
| Invoice tidak dibuat | Cek `XENDIT_SECRET_KEY` benar, pastikan prefix `xnd_development_` |
| Redirect setelah bayar salah | Cek `NEXT_PUBLIC_BASE_URL` di `.env` |
| Webhook retry terus | Endpoint harus return `200`. Xendit retry sampai 6x jika gagal |

---

## Referensi

- [Xendit Dashboard](https://dashboard.xendit.co)
- [Xendit API Docs](https://docs.xendit.co)
- [Xendit Test Mode Help](https://help.xendit.co/hc/en-us/sections/37458222480153-Test-Mode-in-Dashboard)
- [Xendit Demo Store](https://demo-store.xendit.co) — lihat contoh flow pembayaran
