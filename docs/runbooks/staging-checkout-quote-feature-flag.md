# Runbook: Checkout Quote Validation — staging Kanuraga

**Status dokumen:** 2026-11-05 · **Lingkungan:** staging/testing saja · **Jenis:** konfigurasi runtime, tanpa perubahan database.

## Tujuan dan batas keamanan

Mengaktifkan endpoint read-only `POST /api/checkout/validate-quote` untuk UAT ongkir Biteship. Endpoint memeriksa alamat milik customer, keranjang saat ini, dan pilihan kurir terhadap quote terbaru. Tidak membuat order, tidak mengurangi stok, dan tidak memanggil Xendit.

**JANGAN** menganggap keberhasilan validasi quote sebagai persetujuan untuk mengaktifkan checkout/pembayaran. Endpoint `POST /api/orders` masih perlu pengamanan transaksi, stok, idempotensi, dan invoice.

## Arsitektur yang terverifikasi

- Staging: `main` → GitHub Actions `.github/workflows/deploy.yml` → image `ghcr.io/one2pret/onetone-store:latest` → Docker Compose pada `/opt/onetone-store` → aplikasi `onetone-app`.
- Konfigurasi Docker Compose: `/opt/onetone-store/docker-compose.yml`; service: `onetone-app`, `onetone-db`.
- Compose pada repository memakai `env_file: .env.app` untuk service `onetone-app`. File `.env` digunakan Compose untuk variabel MySQL.
- **Penting:** setiap deployment `main`, workflow menyalin ulang `docker-compose.yml`, lalu **menulis ulang `.env` dan `.env.app`**. Sumber `.env.app` adalah GitHub Actions secret `ENV_TEST`.
- Production: branch `production`, konfigurasi dan secret berbeda (`ENV_PROD`). Jangan mengaktifkan flag ini di production.
- Merge ke `main` dapat memicu deployment otomatis; push ke `production` memicu deployment production. Perlindungan merge harus ditetapkan pada aturan branch/review GitHub secara terpisah.

## 1. Pemeriksaan read-only

SSH ke server staging dengan akses sah. Jangan menaruh password atau token dalam perintah atau screenshot.

```bash
cd /opt/onetone-store
docker compose config --services
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker inspect onetone-app --format 'Project: {{index .Config.Labels "com.docker.compose.project"}} / Directory: {{index .Config.Labels "com.docker.compose.project.working_dir"}}'
docker exec onetone-app sh -c 'if [ "$CHECKOUT_QUOTE_VALIDATION_ENABLED" = "true" ]; then echo ENABLED; else echo DISABLED; fi'
```

Output `DISABLED` dapat berarti flag tidak diset, berisi nilai selain `true`, atau container belum dibuat ulang.

**Jangan jalankan** `docker compose config` tanpa filter atau `printenv` lengkap lalu membagikan output: keduanya berpotensi menampilkan environment rahasia.

## 2. Cara sementara (untuk UAT segera; **tidak persisten**)

Jika konfigurasi `.env.app` di host diset oleh deployment, ubah **hanya di staging**:

1. Buka `/opt/onetone-store/.env.app` menggunakan editor dengan hak akses yang diperlukan. Jangan menampilkan atau mengirim isi file tersebut ke chat/PR.
2. Tambahkan satu baris `CHECKOUT_QUOTE_VALIDATION_ENABLED=true`; hindari duplikasi nama variabel.
3. Pastikan Compose tetap memiliki `env_file: .env.app` untuk service `onetone-app`.
4. Validasi YAML dan buat ulang **hanya container aplikasi** ketika siap menerima restart singkat:

```bash
cd /opt/onetone-store
docker compose config -q
docker compose up -d --no-deps --force-recreate onetone-app
docker exec onetone-app sh -c 'if [ "$CHECKOUT_QUOTE_VALIDATION_ENABLED" = "true" ]; then echo ENABLED; else echo DISABLED; fi'
```

Ini tidak membuat ulang database, tetapi ada risiko gangguan singkat pada staging. Jangan memakai `docker compose down -v` atau menghapus volume. `docker compose config -q` hanya memvalidasi YAML; variabel baru tidak berlaku sebelum container dibuat ulang.

**Peringatan persistensi:** perubahan manual pada `docker-compose.yml` atau `.env.app` di server **akan ditimpa** oleh deploy `main` berikutnya. Prosedur sementara ini bukan solusi konfigurasi permanen.

## 3. Cara permanen: sumber konfigurasi GitHub Actions

**Saat ini workflow menerima konfigurasi aplikasi staging melalui repository secret `ENV_TEST`.**

1. Di GitHub repo `one2pret/onetone-store`, buka **Settings → Secrets and variables → Actions**.
2. Cari secret `ENV_TEST` pada **Repository secrets** (sesuaikan apabila organisasi memindahkan pengelolaannya).
3. Pastikan Anda memiliki *salinan lengkap* konfigurasi existing yang aman (misalnya password manager/secret vault yang berwenang). **GitHub tidak menampilkan nilai lama secret.**
4. Jika salinan lengkap tersedia, siapkan isi yang sama lalu tambahkan satu baris `CHECKOUT_QUOTE_VALIDATION_ENABLED=true`. Menyimpan ulang secret **mengganti seluruh isinya**, sehingga semua variable existing harus tetap utuh.
5. Jangan mengunggah `.env.app`, isi `ENV_TEST`, kredensial MySQL, Biteship, Xendit, atau SSH ke GitHub/PR/chat.
6. Terapkan lewat deployment staging yang terkontrol; workflow akan membuat ulang `.env.app` dari `ENV_TEST`. Pastikan CI, migrasi, dan pemeriksaan kesehatan deployment berhasil.

**Jika salinan lengkap secret tidak tersedia, jangan overwrite `ENV_TEST`.** Alternatif yang lebih mudah dirawat adalah PR terpisah yang mengubah workflow agar membaca *GitHub Actions variable khusus staging* untuk flag ini. PR tersebut harus direview, diuji, dan menjaga default `false`. Runbook ini **tidak mengubah workflow**.

## 4. Verifikasi HTTP tanpa kredensial

```bash
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' \
  -X POST 'https://onetone.kanuraga.web.id/api/checkout/validate-quote' \
  -H 'Content-Type: application/json' -d '{}'
```

- **401**: route aktif dan menolak request anonim (indikator awal yang diharapkan).
- **404**: flag mungkin belum aktif, route belum ter-deploy, atau endpoint tidak ditemukan. Cek flag dan image lebih dahulu.
- **400**: payload tidak valid setelah autentikasi; bukan indikator uji anonim yang biasa.

Selanjutnya untuk UAT sebenarnya, gunakan akun staging yang memiliki alamat sendiri dan keranjang valid. Kirim `addressId`, `courierCompany` (kode kurir), `courierType` (kode layanan), `courierPrice` (integer Rupiah). Pilihan yang cocok dengan tarif Biteship terbaru menghasilkan **200**; harga/layanan berubah menghasilkan **409**. `422` dapat muncul untuk keranjang kosong atau berat/koordinat tidak valid; `503` jika layanan pengiriman tidak tersedia. Jangan membagikan token customer atau data pribadinya.

## 5. Rollback / matikan flag

- Sementara: ubah nilai menjadi `CHECKOUT_QUOTE_VALIDATION_ENABLED=false` pada sumber environment staging dan lakukan recreate **hanya** `onetone-app` seperti langkah 2.
- Permanen: perbarui sumber konfigurasi staging di GitHub Actions (misalnya `ENV_TEST`) secara lengkap dan aman, lalu jalankan deployment staging yang terkontrol.
- Verifikasi kembali: `DISABLED` di container dan respons anonim **404** dari endpoint.
- Jika setelah deployment flag kembali `DISABLED`, utamakan memeriksa **sumber `ENV_TEST` / konfigurasi workflow**, bukan mengedit host berulang-ulang.

## 6. Checklist operasional

- [ ] Environment yang disentuh adalah staging, bukan production.
- [ ] Branch `main` berisi route `app/api/checkout/validate-quote/route.ts`.
- [ ] Docker Compose valid; service `onetone-app` teridentifikasi dengan benar.
- [ ] Sumber konfigurasi permanen aman; tidak ada secret yang dipublikasikan.
- [ ] Recreate hanya `onetone-app`; tidak menyentuh volume/database/Odoo.
- [ ] Status container sehat; endpoint anonim memberi HTTP 401 saat aktif.
- [ ] UAT terautentikasi mencakup tarif cocok (200), tarif berubah (409), dan berat/koordinat tidak valid (422).
- [ ] Setelah deploy `main` berikutnya, verifikasi flag tidak berubah tanpa sengaja.
- [ ] Tidak ada promosi branch production atau aktivasi tombol pembayaran karena runbook ini.

## Referensi kode

- `.github/workflows/deploy.yml` — sumber kebenaran deployment dan penulisan ulang `.env.app`.
- `docker-compose.yml` — service `onetone-app` dan `env_file: .env.app`.
- `app/api/checkout/validate-quote/route.ts` — feature flag dan HTTP behavior.
- `lib/checkout/fresh-quote-service.ts` — validasi quote dari state server.
- `docs/checkout-security-rollout.md` — alasan checkout penuh belum boleh dibuka.
