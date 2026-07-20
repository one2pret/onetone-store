# Biteship — Alur Integrasi & Panduan Pengujian

## Konsep Penting

Data order **TIDAK otomatis** masuk ke Biteship saat customer checkout.
Alurnya dua tahap:

1. **Saat checkout** — sistem hanya *cek ongkir* (`/v1/rates/couriers`). Tidak ada data tersimpan di Biteship.
2. **Saat admin klik "Kirim"** — sistem *membuat shipment order* (`/v1/orders`). Di titik inilah data muncul di dashboard Biteship.

```
Customer checkout → bayar (Xendit) → status: packing
                                          ↓
Admin /dashboard/orders/[id] → klik "Kirim ke Kurir"
                                          ↓
POST Biteship /v1/orders → trackingId + waybill tersimpan
                                          ↓
Status order: shipping → Biteship webhook update → delivered
```

---

## Prasyarat (WAJIB semua terpenuhi)

| # | Prasyarat | Lokasi | Gejala jika kosong |
|---|-----------|--------|--------------------|
| 1 | `BITSHIP_API_KEY` (test: `biteship_test.xxx`) | `.env.local` lokal, `.env` VPS | Error "BITSHIP_API_KEY is not configured" |
| 2 | Koordinat toko (`store_latitude`, `store_longitude`) | `/dashboard/settings` → form lokasi | "Lokasi toko belum dikonfigurasi" |
| 3 | Alamat toko + nama + telepon | `/dashboard/settings` | Shipment gagal dibuat |
| 4 | Alamat customer punya lat/lng | Pin peta saat customer buat alamat | Rates kosong / ongkir tidak muncul |
| 5 | Produk punya `weight` (gram) > 0 | Form edit produk | Rates kosong |
| 6 | Kurir aktif di tabel `couriers` | Seeded default (JNE dll) | "Tidak ada kurir aktif" |

---

## Pengujian di LOKAL

### Langkah 1 — Cek ongkir muncul di checkout
1. Login sebagai customer, tambah produk (yang ada weight) ke cart
2. `/checkout` → pilih alamat (yang ada pin peta)
3. Ongkir per kurir harus muncul. Kalau kosong: cek prasyarat #2, #4, #5

### Langkah 2 — Bayar (Xendit test mode)
1. Pilih kurir → bayar
2. Selesaikan pembayaran di Xendit simulator
3. Order status berubah ke `packing` (badge "Dikemas")

### Langkah 3 — Kirim ke Biteship (INI YANG BIKIN DATA MASUK)
1. Login admin → `/dashboard/orders` → buka order berstatus Dikemas
2. Klik tombol **"Kirim"** (SendOrderButton)
3. Sukses = status jadi `shipping`, dan **order muncul di dashboard Biteship** (https://biteship.com → Orders, mode Test)

### Langkah 4 — Webhook tracking (lokal butuh tunnel)
Webhook Biteship tidak bisa capai `localhost`. Dua opsi:

**Opsi A — ngrok/cloudflared tunnel:**
```bash
ngrok http 3000
# atau
cloudflared tunnel --url http://localhost:3000
```
Daftarkan URL tunnel di Biteship dashboard → Webhooks:
`https://xxxx.ngrok.io/api/webhooks/bitship`

**Opsi B — simulasi manual via curl (lebih cepat untuk test):**
```bash
curl -X POST http://localhost:3000/api/webhooks/bitship \
  -H "Content-Type: application/json" \
  -d '{"order_id": "<trackingId-dari-DB>", "status": "delivered"}'
```
`trackingId` ambil dari tabel `shippings` kolom `tracking_id` setelah Langkah 3.

Cek hasil: order status berubah `delivered`, timeline "Selesai" aktif.

---

## Pengujian di LIVE (VPS)

Sama seperti lokal, tapi:

1. `.env` VPS pakai `BITSHIP_API_KEY` test dulu (`biteship_test.xxx`)
2. Webhook langsung bisa didaftarkan (tidak perlu tunnel):
   - Biteship dashboard → Webhooks → tambah:
   - `https://onetone.kanuraga.web.id/api/webhooks/bitship`
   - Event: order status updates
3. Jalankan Langkah 1–3 di URL live
4. Webhook delivered akan otomatis masuk saat kurir test update status

---

## Pindah ke LIVE MODE Biteship (production)

1. Upgrade akun Biteship + dapatkan **live API key** (`biteship_live.xxx`)
2. Ganti di VPS `.env`:
   ```
   BITSHIP_API_KEY=biteship_live.xxx
   ```
3. Restart container: `bash /opt/onetone-store/update.sh` (atau `docker compose restart onetone-app`)
4. Webhook URL tetap sama — tidak perlu ubah
5. **PENTING:** live mode = shipment beneran dibuat + kurir beneran datang pickup. Test dengan barang nyata dulu satu kali.

---

## Troubleshooting

| Gejala | Penyebab | Fix |
|--------|----------|-----|
| Ongkir tidak muncul di checkout | Koordinat toko/alamat kosong, weight 0 | Cek prasyarat #2, #4, #5 |
| "Gagal membuat pengiriman" saat klik Kirim | Lihat log server | `docker logs onetone-app --tail 50` |
| Error 40002035 "Delivery date has not been specified" | `delivery_type: 'later'` butuh delivery_date | **SUDAH DIFIX** — pakai `'now'` (commit 2797cc2) |
| tracking_id tetap null setelah klik Kirim | createShipment gagal diam-diam | Cek log, kemungkinan API key salah atau error Biteship |
| Order tidak muncul di Biteship dashboard | Belum klik "Kirim" di admin, atau lihat mode salah (Test vs Live) | Pastikan toggle Test mode aktif di Biteship |
| Status tidak berubah otomatis ke delivered | Webhook belum terdaftar / URL salah | Daftar ulang webhook, cek endpoint `/api/webhooks/bitship` |
| Tombol "Kirim" tidak muncul | Order belum berstatus `packing` (belum dibayar) | Selesaikan pembayaran dulu |

## Bug yang Sudah Diperbaiki

**2026-07-20 — delivery_type: 'later' → 'now' (commit 2797cc2)**

Root cause: `createShipment` di `lib/bitship.ts` dikirim dengan `delivery_type: 'later'`.
Biteship error 40002035: "Delivery date has not been specified" — tapi error ini ditangkap oleh catch block dan tidak muncul di UI, hanya di log server.
Akibatnya: order status berubah ke `shipping` tapi `tracking_id` tetap null, dan data tidak pernah masuk Biteship.
Fix: ganti ke `delivery_type: 'now'` = pickup segera, tidak perlu delivery_date.

---

## File Terkait

| File | Fungsi |
|------|--------|
| `lib/bitship.ts` | API client: rates, createShipment, tracking |
| `app/actions/shipping.ts` | `calculateShippingRates()` (checkout), `sendOrderToBitship()` (admin) |
| `app/api/webhooks/bitship/route.ts` | Terima update status dari Biteship |
| `app/(admin)/dashboard/orders/[id]/SendOrderButton.tsx` | Tombol "Kirim" admin |
| `components/shop/ShippingOptions.tsx` | UI pilihan kurir di checkout |
| `components/shop/TrackingTimeline.tsx` | Timeline tracking di order detail |
