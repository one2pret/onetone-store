# Atomic Voucher v0.9 — kandidat rilis staging

**Keputusan NO-GO untuk aktivasi staging dan promosi produksi.** Bukti lokal lulus. Head integrasi, digest runtime, salinan staging yang disanitasi, persetujuan transaksi dan hasil UAT staging masih harus diverifikasi.

## Integrasi dan identitas kandidat

- Baseline `b00b66672b8433426c3541c3513c14854de638da`, PR #94 ke `feature/atomic-voucher-checkout-v01`. Ketika diperiksa target masih di `d818b8d`. SQL `0020_runtime_schema_parity.sql` dan referensinya di jurnal ada pada head PR #94. CI PR #94 lulus untuk TypeScript, unit test, dan job MySQL/paritas. [PR #94](https://github.com/one2pret/onetone-store/pull/94) · [CI PR #94](https://github.com/one2pret/onetone-store/actions/runs/44968382973)
- Kandidat v0.9 mencakup baseline PR #94. Catat SHA lengkap kandidat, tree, base SHA, hash SQL 0020, PR dan run CI sebelum review. Untuk run yang memakai merge ref, catat juga tree yang diuji dan cocokkan dengan tree kandidat integrasi. Lulus pada v0.8 tidak menetapkan status CI v0.9.
- Simpan digest image aplikasi dan migrator setelah build yang disetujui. Workflow build memberi kedua image label `org.opencontainers.image.revision` dari SHA GitHub. Cocokkan label dan digest registry dengan artefak build. Tag mutable saja tidak cukup.

## Rehearsal database staging yang disanitasi

### Review sebelum menjalankan

- `0020` membuat tabel yang belum ada, menambah kolom beserta default, dan menambah foreign key pada asosiasi yang belum ada. Histori dan hash migrasi lama dipertahankan. DDL dapat mengambil metadata lock dan menunggu transaksi lama.
- Tabel atau kolom dengan nama yang sudah ada dipertahankan. Ketidaksesuaian tipe, default, nullability, unique index, aksi FK, atau CHECK constraint akan gagal pada schema gate. Data afiliasi yatim dapat menyebabkan penambahan FK gagal setelah sebagian DDL berjalan.
- Sebelum rehearsal, inventarisasi kolom afiliasi yang **sudah tersedia** pada clone. Hitung orphan pada relasi user–affiliate, affiliate–link/click, order–affiliate/link/click, payout, dan komisi. Periksa duplikasi pada kolom yang seharusnya unik. Gunakan agregat dan satu fixture yang disetujui saat mencatat bukti. Pertahankan definisi dan data yang menyimpang sampai ada rencana koreksi terulas.
- Dari checkout yang disetujui, jalankan CLI schema read-only dengan koneksi metadata-only ke clone atau staging yang memang sudah diotorisasi. Sebelum 0020, gap yang sesuai inventaris v0.8 dapat muncul. Drift tambahan perlu review terpisah.

```bash
./node_modules/.bin/tsx scripts/check-mysql-schema.ts
```

### Restore dan upgrade

1. Minta operator menyiapkan dump yang sudah disanitasi dengan jurnal migrasi dan relasi FK utuh. Catat checksum, timestamp, versi server dan batas data yang disetujui. Tinjau dump untuk memastikan target DB tidak dikodekan melalui `USE` atau `CREATE DATABASE` dan tidak ada user, grant, event, routine, atau data sensitif yang lolos sanitasi.
2. Buat dua database disposable yang terisolasi pada MySQL 8.0.46, satu sebagai acuan restore dan satu untuk upgrade. Pakai akun yang hanya dapat mengakses dua schema itu. Putus akses provider dan background job. Ambil kredensial dari kanal yang disetujui. Verifikasi host dan database target sebelum impor.
3. Restore dump yang sama ke kedua target. Catat checksum dan jurnal `0019` atau prefix sah yang tersedia, jumlah baris serta ringkasan agregat untuk order, invoice, attempt, stok, grant, poin dan tabel afiliasi yang ada. Simpan schema-only diff dan hitungan orphan. Jika ada checkpoint tertinggal atau hash jurnal tidak cocok, eskalasi sebelum menjalankan migrator.
4. Arahkan `DATABASE_URL` melalui kanal konfigurasi privat ke **clone upgrade**. Jalankan migrator dan gate. Catat hasil `0020`, hash jurnal, perbedaan skema, durasi, dan jumlah baris pre/post. Ulangi migrator dan pastikan `applied: 0`. Tinjau default pada kolom baru dan bandingkan nilai bisnis yang sudah ada. Bukti scope koneksi dan target tidak boleh memuat password.

```bash
./node_modules/.bin/tsx scripts/migrate-mysql.ts
./node_modules/.bin/tsx scripts/check-mysql-schema.ts
```

5. Jalankan kandidat dan image rollback yang SHA dan digest-nya sudah ditetapkan terhadap salinan skema migrated. Tes baca katalog dan pesanan. Uji alur tulis yang relevan hanya pada fixture disposable dengan provider mock. Pastikan background job dan callback eksternal terisolasi. Rekam health, hasil tes, serta kompatibilitas schema kedua image.

**Bukti lokal v0.9:** MySQL 8.0.46. Restore dump sintetis berisi 20 jurnal, jalankan 0020 lalu rerun. Hasil `applied: 1`, kemudian `applied: 0`, 21 jurnal, gate tanpa signature hilang, serta harga dan stok fixture `15000.00 / 4` tetap cocok. SHA-256 dump disposable `943cdcc0e124edbbc9a1f97c9d5c998fea5d7569b797a9f88d6c991c66b59852`. Kode lama `a0ad8b4bd5a1a8295b8e2c003a0190d9a3508c43` dijalankan via Next.js dev. GET `/api/products?category=rc09-fixture` dan `/api/categories` mengembalikan data fixture yang benar. Image rollback staging dan kompatibilitas tulis aktual tetap UNVERIFIED.

## Preflight runtime staging

Jalankan dari checkout kandidat yang disetujui dengan akses Docker staging yang sudah diotorisasi. Isikan SHA dan digest dari manifest, bukan tag. ID opsional harus masuk daftar fixture TEST yang disetujui.

```bash
./node_modules/.bin/tsx scripts/staging-readonly-preflight.ts \
  CONTAINER APPROVED_GIT_SHA APPROVED_IMAGE_DIGEST [APPROVED_TEST_ORDER_ID]
```

| Cek operator | Status staging saat laporan dibuat | Bukti yang dibutuhkan |
| --- | --- | --- |
| SHA dan digest | UNVERIFIED | Label pada image aktif cocok dengan SHA kandidat dan digest registry yang disetujui. |
| APP_ENV, TEST mode, flag voucher | UNVERIFIED | Runtime staging, prefix TEST, dan voucher OFF sebelum persetujuan. Operator cocokkan akun TEST secara terpisah. |
| Koneksi, jurnal, dan parity | UNVERIFIED | Prefix lengkap 21 migrasi, tanpa checkpoint tertahan. Kolom, indeks, FK, dan CHECK cocok dengan kontrak runtime. |
| Webhook | UNVERIFIED | Token tersedia, URL dashboard TEST benar, autentikasi callback diuji pada fixture yang disetujui. Keberadaan token saja tetap UNVERIFIED untuk pengiriman. |
| Log dan rekonsiliasi | UNVERIFIED | Hitungan event, status attempt TEST, dan review redaksi dari sink staging. Kehadiran event hanya membuktikan observasi log. |

Smoke test lokal memakai adapter Docker sintetis dan database MySQL disposable yang sebenarnya. Jurnal dan schema gate lulus pada fixture lengkap. Setelah unique index poin dihapus dari fixture, schema gate melaporkan FAIL dan exit 1. Token dan baris log sintetis yang sensitif tidak muncul pada output.

Script mencetak klasifikasi kredensial, jumlah signature yang hilang, dan status yang dibatasi. Output log mentah, token, payload, URL pembayaran, dan baris pelanggan tetap privat. Exit 1 berarti ada kegagalan, exit 3 berarti bukti belum lengkap. Simpan hasil JSON yang disamarkan bersama manifest.

TypeScript dan ESLint terarah lulus. Regresi Vitest penuh lulus 892 tes pada 100 file. Suite migrasi dan settlement terarah lulus 75 tes pada lima file.

## Checklist UAT staging

Persetujuan eksplisit wajib mencantumkan window, SHA/digest, owner, akun dan fixture TEST, order yang boleh berubah, batas transaksi serta penanggung jawab rollback. Sampai persetujuan tersedia, semua skenario staging berikut berstatus **UNVERIFIED**.

1. Checkout voucher eligible memakai UUID baru. Verifikasi satu order, satu reservasi grant dan invoice TEST. Retry dengan UUID sama menghasilkan order yang sama. Mutasi voucher atau poin dengan UUID yang sama menghasilkan 409.
2. Bayar satu invoice TEST melalui alur yang disetujui. Cocokkan invoice, order dan ledger PAID serta voucher redeemed. Kirim ulang callback sah dan pastikan tidak ada efek ganda.
3. Biarkan invoice TEST terpisah kedaluwarsa. Verifikasi EXPIRED memulihkan stok dan poin tepat sekali, serta grant tersedia atau expired sesuai kebijakan. Pengulangan callback mempertahankan hasil.
4. Uji pembatalan tepercaya pada fixture terpisah dengan bukti expiry provider yang segar. Pastikan hasil lokal CANCELLED, atau hasil terminal existing dipertahankan bila webhook lebih dulu. Invoice aktif, bukti tidak cocok, atau lookup gagal harus menghasilkan penolakan tanpa mutasi.
5. Uji replay dan settlement paralel hanya melalui mekanisme UAT yang disetujui. Rekam satu hasil terminal, satu transisi stok yang sesuai, serta ledger debit dan kredit poin yang konsisten. Callback bertentangan membutuhkan rekonsiliasi.
6. Uji recovery invoice yatim PENDING yang cocok dan sudah direview. Ikuti [prosedur operator v0.6](./atomic-voucher-release-gate-v06.md#pemulihan-invoice-yatim). Rekam satu penautan dan audit, tanpa penerbitan invoice tambahan. Tahan kasus terminal atau ambigu untuk keputusan operator.
7. Jalankan diagnostik per order TEST. Rekonsiliasi order `requesting` atau `needs_reconciliation`, cocokkan provider TEST dan catat status akhir. Pastikan stok, invoice, order, grant dan ledger poin tetap konsisten. Simpan bukti sebelum/sesudah yang telah disamarkan.

## Rollback dan rekonsiliasi

- Tutup penerimaan voucher baru jika guard gagal atau UAT dihentikan. Pertahankan callback TEST selama settlement order yang pending dan jangan menerbitkan invoice baru untuk attempt ambigu.
- Catat checkpoint dan jurnal bila migrasi gagal. Pulihkan backup pre-migration ke target disposable dan verifikasi integritas sebelum retry. DDL aditif yang sudah diterapkan tidak dibatalkan oleh penggantian image.
- Untuk rollback aplikasi, gunakan **digest** terakhir yang disetujui setelah lulus rehearsal pada skema migrated. Cocokkan pasangan order, invoice, attempt, grant, stok serta saldo dan audit poin. Rekonsiliasi provider TEST sebelum resume. Pertahankan ledger dan data audit.
- Persetujuan berikutnya memerlukan CI kandidat, preflight runtime, rehearsal clone staging, kompatibilitas image rollback, dan hasil UAT yang ditandatangani. Promosi produksi memerlukan keputusan terpisah.
