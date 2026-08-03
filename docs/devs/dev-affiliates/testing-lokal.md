# Testing Affiliate Module di Lokal

## 0. Sudah ada seed data (opsional, cara cepat)

`pnpm db:seed` sekarang otomatis bikin 2 affiliate demo:
- **Andi Saputra** (`ANDI88`) — status `active`, tier `pro` (naik ke `elite` otomatis kalau cron tier dijalanin, karena GMV order seed-nya besar), punya 2 link + 2 komisi contoh (1 `approved`, 1 `holding`).
- **Siti Nur** (`SITINUR12`) — status `pending`, buat testing tombol Approve/Reject di admin.
- **Rina** (`rina@gmail.com`) sengaja **tidak** dijadikan affiliate — pakai akun ini buat testing alur "daftar dari nol" (langkah 4-5 di bawah).

Program affiliate juga udah otomatis `isEnabled: true` dari seed — **langkah 3 (aktifin manual) bisa di-skip** kalau baru `pnpm db:seed`.

## 1. Jalanin dev server

```bash
pnpm dev
```

Buka `http://localhost:3000`.

## 2. Login

Pakai akun yang sudah ada di DB lokal (bukan `john@example.com` dari CLAUDE.md — itu gak ada di seed asli):

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@store.com` | `password123` |
| Customer | `rina@gmail.com` | `password123` |
| Customer | `andi.saputra@gmail.com` | `password123` |

Login: `http://localhost:3000/login`

## 3. Aktifkan program affiliate (wajib, sekali saja)

Program affiliate default **mati** (`affiliate_settings.isEnabled = false`, dan kalau row-nya belum ada sama sekali, semua nilai fallback ke default di kode). Login sebagai **admin**, buka:

```
http://localhost:3000/dashboard/affiliate/settings
```

Centang **"Program affiliate aktif"**, klik Simpan. Sekalian bisa atur:
- Auto-approve pendaftaran (biar gak perlu approve manual tiap testing)
- Cookie window, hold period, default rate — biarin default dulu

## 4. Daftar jadi affiliate (sebagai customer)

Logout dari admin, login sebagai `rina@gmail.com`. Buka:

```
http://localhost:3000/affiliate
```

Klik **"Daftar Jadi Affiliate"**, isi form, submit. Kalau auto-approve OFF, statusnya `pending` — perlu di-approve manual (langkah 5). Kalau auto-approve ON, langsung `active`, langsung ke dashboard.

## 5. Approve affiliate (kalau belum auto-approve)

Login sebagai admin, buka:

```
http://localhost:3000/dashboard/affiliate/members
```

Klik **Approve** di baris Rina. Status berubah jadi `active`.

## 6. Buat link referral

Login lagi sebagai Rina, buka:

```
http://localhost:3000/affiliate/dashboard/links
```

Buat link (pilih "Halaman utama toko" paling gampang buat testing). Klik **Salin** buat dapetin URL lengkap `/r/{slug}`.

## 7. Test tracking klik

Buka link `/r/{slug}` di **browser lain / incognito** (biar gak kebawa cookie login Rina — attribution harusnya tetep jalan walau gak login, karena baca cookie `_otref`/`_otv`, bukan session). Harusnya langsung redirect ke halaman utama toko.

Balik ke dashboard Rina (`/affiliate/dashboard/links`), refresh — `click_count` harusnya naik 1.

## 8. Test konversi (attribution ke order) — bagian paling penting

Di **browser/incognito yang sama** (yang baru klik link tadi, cookie `_otref` masih nempel), login sebagai customer **LAIN** dari Rina (misal `andi.saputra@gmail.com` — attribution ditolak kalau affiliate beli produk sendiri / self-referral). Belanja produk, checkout sampai bayar (kalau Xendit sandbox gak nyambung lokal, minimal sampai order `waiting_payment` kebuat, cek DB manual buat langkah selanjutnya).

**Cek attribution masuk ke order:**
```bash
mysql -h 127.0.0.1 -uroot -padminpwd onetone_store_db -e "
SELECT id, order_number, status, affiliate_id, affiliate_code FROM orders ORDER BY id DESC LIMIT 3;
"
```
`affiliate_id` harus keisi kalau attribution jalan.

**Simulasikan order paid** (skip Xendit webhook beneran, langsung update manual — commission creation logic ada di webhook handler, jadi kalau mau test commission table keisi, invoke lewat cara ini atau beneran bayar via Xendit sandbox):
```bash
# Opsi cepat: langsung test commission-lifecycle lewat script (lihat §9 di bawah)
```

## 9. Cek commission masuk (setelah order "paid")

```bash
mysql -h 127.0.0.1 -uroot -padminpwd onetone_store_db -e "
SELECT id, affiliate_id, order_id, amount, status FROM affiliate_commissions;
"
```

Cek juga dashboard Rina: `/affiliate/dashboard/commissions` — harusnya muncul baris baru status `pending`.

## 10. Cek dashboard admin

```
http://localhost:3000/dashboard/affiliate
```

Overview total affiliate, GMV, komisi terutang. Dari sini bisa ke:
- `/dashboard/affiliate/members` — approve/reject/suspend
- `/dashboard/affiliate/commissions` — semua komisi + adjustment manual
- `/dashboard/affiliate/payouts` — antrian withdraw (approve → tandai selesai setelah transfer manual)
- `/dashboard/affiliate/rules` — aturan komisi custom per produk/kategori/tier

## Troubleshooting

**"Program affiliate sedang tidak dibuka"** saat daftar → belum aktifin di langkah 3.

**Login gagal "Email tidak terdaftar"** → jangan pakai `john@example.com`, itu gak ada di DB lokal. Pakai tabel di langkah 2.

**Attribution gak masuk ke order (`affiliate_id` NULL)** → cek:
- Cookie `_otref` ada gak (DevTools → Application → Cookies)? Kalau gak ada, klik `/r/{slug}` dulu.
- Affiliate yang login beda sama yang checkout (self-referral otomatis ditolak kecuali `allowSelfReferral` diaktifkan di Pengaturan).
- Cookie udah expired (default 30 hari, harusnya gak masalah pas testing).

**Mau reset data testing (cara paling gampang — pakai seed):**
```bash
pnpm db:seed
```
(reset semua tabel, bukan cuma affiliate — kalau cuma mau bersihin affiliate doang, hapus manual per tabel di atas.)

## 11. Test cron manual

Dua cron job: `affiliate-approve` (harusnya jalan tiap jam — holding yang `hold_until` udah lewat jadi `approved`) dan `affiliate-tier` (harusnya jalan harian — hitung ulang tier dari GMV 30 hari).

```bash
# Ambil CRON_SECRET dari .env.local
curl -H "Authorization: Bearer your_cron_secret" http://localhost:3000/api/cron/affiliate-approve
curl -H "Authorization: Bearer your_cron_secret" http://localhost:3000/api/cron/affiliate-tier
```

Tanpa header/token salah → 401. Response sukses: `{"success":true,"approved":N}` dan `{"success":true,"checked":N,"changed":N}`.

**Setup crontab di VPS** (nanti pas deploy, samain sama pola `check-expired-orders` yang udah ada):
```cron
0 * * * *  curl -s -H "Authorization: Bearer $CRON_SECRET" https://onetone-store.id/api/cron/affiliate-approve
0 2 * * *  curl -s -H "Authorization: Bearer $CRON_SECRET" https://onetone-store.id/api/cron/affiliate-tier
```
