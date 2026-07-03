# Sprint 30 Hari — onetone-store
> Target: Backend complete + Flutter MVP siap handover ke klien

## Status Legend
- ⬜ Belum mulai
- 🔄 Sedang dikerjakan
- ✅ Selesai
- ❌ Blocked

---

## Minggu 1: Storage System (Hari 1–7)

| Hari | Task | Status | Notes |
|------|------|--------|-------|
| 1 | Setup Cloudflare R2 akun + bucket | ⬜ | |
| 1 | Install deps: @aws-sdk/client-s3 + sharp | ⬜ | |
| 2 | Buat lib/storage.ts (abstraction layer) | ⬜ | |
| 2 | Test upload script sederhana | ⬜ | |
| 3 | Buat lib/image-processor.ts | ⬜ | |
| 3 | Test: upload → resize → WebP → R2 | ⬜ | |
| 4 | Tambah tabel product_images di schema | ⬜ | |
| 4 | pnpm db:push, update seed | ⬜ | |
| 5 | Update admin form produk: image upload | ⬜ | |
| 5 | Tampilkan gambar di product list | ⬜ | |
| 6 | Setup Google Cloud Console (Drive API) | ⬜ | |
| 6 | Buat lib/drive-import.ts | ⬜ | |
| 7 | Tambah "Import dari Drive" di form produk | ⬜ | |
| 7 | Test full flow Drive → R2 → DB | ⬜ | |

---

## Minggu 2: API Polish + Testing (Hari 8–14)

| Hari | Task | Status | Notes |
|------|------|--------|-------|
| 8 | Audit semua API routes dengan Postman | ⬜ | |
| 8 | Fix response format yang tidak konsisten | ⬜ | |
| 9 | Tambah proper error handling di semua routes | ⬜ | |
| 9 | Dokumentasikan API di README | ⬜ | |
| 10 | Setup ngrok untuk webhook test | ⬜ | |
| 10 | Test Xendit webhook PAID + EXPIRED | ⬜ | |
| 11 | Test Bitship webhook | ⬜ | |
| 11 | Buat webhook_logs tabel untuk debugging | ⬜ | |
| 12 | Setup GitHub Actions cron (gratis) | ⬜ | |
| 12 | Test check-expired-orders endpoint | ⬜ | |
| 13 | pnpm test:run — fix semua failing tests | ⬜ | |
| 13 | Tambah tests untuk storage.ts | ⬜ | |
| 14 | Tambah tests untuk image-processor.ts | ⬜ | |
| 14 | pnpm build — harus 0 error | ⬜ | |

---

## Minggu 3: Flutter App (Hari 15–21)

| Hari | Task | Status | Notes |
|------|------|--------|-------|
| 15 | flutter create onetone_app | ⬜ | |
| 15 | Setup deps: dio, riverpod, go_router, cached_network_image | ⬜ | |
| 15 | Buat lib/api/api_client.dart | ⬜ | |
| 16 | Buat auth_api.dart (login, register, me) | ⬜ | |
| 16 | SplashScreen + route guard | ⬜ | |
| 17 | LoginScreen UI + logic | ⬜ | |
| 17 | RegisterScreen | ⬜ | |
| 18 | Test auth: login → simpan token → me endpoint | ⬜ | |
| 18 | HomeScreen skeleton (banner + featured) | ⬜ | |
| 19 | ProductListScreen (grid 2 kolom + search) | ⬜ | |
| 19 | ProductDetailScreen | ⬜ | |
| 20 | CartScreen (list + update qty + hapus) | ⬜ | |
| 20 | Cart badge di AppBar | ⬜ | |
| 21 | AddressListScreen + AddAddressScreen | ⬜ | |
| 21 | Test di device fisik | ⬜ | |

---

## Minggu 4: Checkout + Deploy (Hari 22–30)

| Hari | Task | Status | Notes |
|------|------|--------|-------|
| 22 | ShippingRateScreen (pilih kurir) | ⬜ | |
| 22 | ReviewOrderScreen (summary sebelum bayar) | ⬜ | |
| 23 | Integrasi POST /api/orders dari Flutter | ⬜ | |
| 23 | Buka Xendit invoice URL (url_launcher) | ⬜ | |
| 24 | OrderListScreen (list + status chips) | ⬜ | |
| 24 | OrderDetailScreen (timeline + items) | ⬜ | |
| 25 | Repay flow (expired order) | ⬜ | |
| 25 | Test full checkout flow di device | ⬜ | |
| 26 | Setup VPS Ubuntu (Niagahoster/DO) | ⬜ | |
| 26 | Install Node, MySQL, Nginx, PM2 | ⬜ | |
| 27 | Deploy backend ke VPS | ⬜ | |
| 27 | Setup SSL, domain, webhook production URL | ⬜ | |
| 28 | Update Flutter base URL ke production | ⬜ | |
| 28 | Test full flow production | ⬜ | |
| 29 | Fix bugs dari testing hari 28 | ⬜ | |
| 29 | Build APK: flutter build apk | ⬜ | |
| 30 | Dokumentasi handover klien | ⬜ | |
| 30 | Serah terima + backup DB | ⬜ | |

---

## Blockers & Catatan

> Catat di sini setiap ada blocker atau keputusan teknis penting

| Tanggal | Blocker/Keputusan | Status |
|---------|------------------|--------|
| | | |

---

## Akses & Credentials (JANGAN COMMIT FILE INI)

> Simpan di .env.local dan password manager

- Cloudflare: https://dash.cloudflare.com
- Xendit Sandbox: https://dashboard.xendit.co
- Bitship Dashboard: https://biteship.com/dashboard
- Google Cloud Console: https://console.cloud.google.com
- VPS SSH: lihat di password manager

