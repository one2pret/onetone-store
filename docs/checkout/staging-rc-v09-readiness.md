# Staging readiness — Atomic Voucher RC v0.9

**NO-GO untuk mengaktifkan UAT checkout saat ini.** Kandidat `4afb11b82b6b88a9a6c3d71999381411f224f1fa` tersedia di Git. Runtime staging belum dibuktikan menjalankan kandidat. Laporan operator menyebut lima baris jurnal, sedangkan RC memiliki 21 entri. Semua tindakan pada server di bawah ini disiapkan untuk operator yang berwenang.

| Pemeriksaan | Status | Bukti |
| --- | --- | --- |
| Ketersediaan halaman publik TEST | PASS terbatas | GET halaman sandbox return mengembalikan HTTP 200. |
| OCI artefak yang dilaporkan | PASS registry | Index digest `sha256:16543928b7568f80579cff96301b0ec72b99b3b790384a31ff25992f79ee751e` dapat dibaca. Manifest linux/amd64 adalah `sha256:92dc868da3b472a0563fb8c33ac3b99428d108898f28fb591ea915d91703c432`. |
| Commit yang menghasilkan image | UNVERIFIED | Config image pada digest tersebut tidak memiliki label revisi. Attestation SLSA yang cocok dengan manifest platform tidak memuat SHA repo. Run deploy `44902047084` sukses untuk `a0ad8b4`, tetapi belum ada tautan digest persis ke run itu. Gunakan build record atau bukti registry yang menghubungkan digest persis ke SHA. [Run deploy](https://github.com/one2pret/onetone-store/actions/runs/44902047084) |
| Runtime identity, `APP_ENV`, database, flags | UNVERIFIED | `VM-7-242-ubuntu`, container `onetone-app`/ `onetone-db`, `APP_ENV=staging`, MySQL 8.0.46 dan DB `onetone_db` berasal dari laporan operator. Jalankan blok preflight untuk bukti runtime. |
| Jurnal RC lengkap | FAIL berdasarkan jumlah yang dilaporkan | Lima baris berbeda dari 21 entri RC. Hash/timestamp aktual, checkpoint dan status 0020 tetap UNVERIFIED. Database yang pernah dibaseline manual perlu review khusus. |
| Kontrak skema staging | UNVERIFIED | 45 tabel dan kehadiran voucher/afiliasi belum membuktikan tipe, default, indeks, FK, serta CHECK yang diperlukan. |
| Xendit TEST, webhook, tarif TEST | UNVERIFIED | Periksa prefix/flag dan akun provider yang sesuai. Bukti delivery webhook membutuhkan fixture TEST yang disetujui. |
| RC GitHub | UNVERIFIED untuk CI RC | PR #94 memuat 0020 pada baseline `b00b666` dan run `44968382973` lulus. Branch target masih di `d818b8d` dan belum memuat 0020. Belum ditemukan PR pada head `4afb11b`. [PR #94](https://github.com/one2pret/onetone-store/pull/94) · [CI baseline](https://github.com/one2pret/onetone-store/actions/runs/44968382973) |

Workflow existing mendeploy staging pada push ke `main` atau dispatch staging yang dikonfirmasi dari `main`. Workflow menarik `latest` dan `latest-migrate` sebelum menjalankan migrator dan mengganti container. Push ke `production` memiliki jalur deployment tersendiri. Branch RC bukan pemicu deploy. Audit provenance RC memerlukan pencocokan digest aplikasi dan migrator dari build SHA yang sama. [Workflow di RC](https://github.com/one2pret/onetone-store/blob/4afb11b82b6b88a9a6c3d71999381411f224f1fa/.github/workflows/deploy.yml)

## Satu blok SSH read-only untuk operator

Ganti path checkout dengan lokasi branch readiness yang sudah tersedia dan diperiksa oleh operator. Gunakan alias SSH yang memang menunjuk staging. Tidak ada kredensial yang perlu ditulis pada command line. Digest argumen ini adalah digest **yang dilaporkan** oleh operator. PASS pada cek digest berarti cocok dengan laporan itu dan belum membuktikan SHA RC.

```bash
ssh VM-7-242-ubuntu <<'STAGING_READ_ONLY'
set -eu
test "$(hostname -s | tr '[:upper:]' '[:lower:]')" = 'vm-7-242-ubuntu'
cd /absolute/path/to/reviewed-readiness-checkout
git rev-parse HEAD
test -r /opt/onetone-store/docker-compose.yml
./node_modules/.bin/tsx scripts/staging-readonly-preflight.ts \
  onetone-app 4afb11b82b6b88a9a6c3d71999381411f224f1fa \
  sha256:16543928b7568f80579cff96301b0ec72b99b3b790384a31ff25992f79ee751e
STAGING_READ_ONLY
```

Exit 1 berarti ada FAIL, 3 berarti ada bukti UNVERIFIED, dan 2 berarti argumen tidak valid. Script menolak host lain dan menjalankan Docker dengan socket lokal. Sebelum menyambung ke MySQL, script mencocokkan label Compose kedua container, jaringan bersama, `APP_ENV=staging`, URL `mysql://…@onetone-db:3306/onetone_db` tanpa query options, dan hasil DNS dengan alamat container database. Koneksi dipatok ke IP yang sudah diperiksa. Query berada dalam transaksi `READ ONLY`. Ketidakcocokan guard harus diperlakukan sebagai alasan berhenti. Jangan memakai database alternatif untuk meloloskan probe.

Flag voucher yang sebenarnya adalah **`CHECKOUT_SANDBOX_VOUCHER_ENABLED`**. Default `false`. Opt-in checkout juga memerlukan `APP_ENV=staging`, `CHECKOUT_SANDBOX_ORDER_ENABLED=true`, `CHECKOUT_SANDBOX_PAYMENT_LEDGER_ENABLED=true`, kunci Xendit berprefix `xnd_development_` dan konfigurasi tarif Biteship TEST. Preflight mencetak boolean dan klasifikasi, serta menandai voucher atau booking yang sudah ON sebagai FAIL untuk fase persiapan ini.

**Verifikasi Xendit TEST:** Cocokkan klasifikasi prefix dari preflight dengan sumber kredensial TEST yang sudah disetujui, melalui dashboard atau secret store operator. Jangan menyalin nilai kunci atau token ke laporan. Periksa URL callback dan ketersediaan token di runtime. Prefix TEST hanya membuktikan format. Autentikasi akun dan delivery callback dibuktikan terpisah lewat bukti dashboard atau UAT TEST yang diotorisasi. Pemeriksaan format tidak memerlukan panggilan provider.

## Bukti migrasi 0020

Untuk RC, jurnal `__drizzle_migrations` harus berisi satu baris yang cocok pada **kedua** nilai berikut:

- `created_at = 1795305600000`
- SHA-256 `513227c7445189cb01c2ee905df1e65c83558b66a45d4914ae291d287f020fbf`

Preflight membandingkan pasangan lengkap hash/timestamp dari 0000 sampai 0020, memeriksa checkpoint interupsi dan kecocokan 0020 secara terpisah, lalu memeriksa struktur fisik dengan kontrak RC. Baris 0020 sendirian tidak membuktikan jurnal prefix lengkap atau skema yang cocok. Hash hilang, duplikasi, konflik, atau histori non-prefix memerlukan review operator. Jangan mengisi jurnal manual, menjalankan schema push, atau menjalankan migrator langsung pada staging dengan kondisi lima baris yang belum dipetakan.

Inventaris SHA-256 file dari jurnal RC:

| File | Timestamp | SHA-256 |
|---|---:|---|
| `0000_thin_doctor_doom.sql` | 1784002757594 | `0fa018ca704d57cdf194495209f7e80ac0dc4c6919f193c043062ebf7b0be3d8` |
| `0001_product_scheduled_pricing.sql` | 1790154000000 | `c6c005248dd760a0ce94e9256a1aa6f5954fe6804364228548dda7c411bf8a6d` |
| `0002_new_user_vouchers.sql` | 1790157600000 | `1b3a19e6c22896c503a814e4249928c32be898068d0bd13fb2091a8d42fd841e` |
| `0003_voucher_admin_fields.sql` | 1790161200000 | `20ad922c552ca0f732b54786112196671cc6b4704b138a630eb1b1ca42e13f65` |
| `0004_inventory_locations.sql` | 1790172000000 | `9679fa2bc89c125ade30b2b7fc0e2f29babd7113256a1192fd5a3894d4b2aacd` |
| `0005_inventory_transfers.sql` | 1790258400000 | `13d812b7093c652f9fe91f6269bfa6ca2822a288d1a75f44503b53e931c7e308` |
| `0006_pos_catalog.sql` | 1790262000000 | `3df39d95887ef2e467fe590aceb306ee3e8c8150fb77420576de563c4bdebdea` |
| `0007_pos_returns.sql` | 1790319600000 | `f0f117be36f589f428a738a56a4e2742647f543b24a5ea56571def0023ea8a0f` |
| `0008_pos_assigned_cashier.sql` | 1790323200000 | `40d0d2492be67a1b9430c396238c51a48df8c564a91cef688ffc8672a4b5d8b7` |
| `0009_banner_images.sql` | 1790352000000 | `e3a3afd0f2509810efa197fbcd234e5e2b3d79bc6a4fcdadf70e4885cfe73e81` |
| `0010_pos_customer_leads.sql` | 1790520946000 | `89da0ccaf81983a99aed17c86677a7e2e84ef11812eea838a4e81658a33a2aa7` |
| `0011_pos_membership_points.sql` | 1790607600000 | `14ade6ed38a4e5bb66bddb6ac01f7ee24ab795b8e48adabdf4fd11d1a0bf5ed8` |
| `0012_product_image_variants.sql` | 1790614800000 | `9b9f764555e79496a896aa3a50735735e658df3a90a8559508a8b8de9e69b548` |
| `0013_pos_promotional_pricing.sql` | 1790622000000 | `1b1e29d65ddb136e0129f64dc2824e9f89da591bef149e3c7ffacc5f5a69de75` |
| `0014_inventory_receipt_scanning.sql` | 1790701200000 | `716d00b5be6c8748639502d0d656676df9c8c3f81fac43da2cc3f8dfb49c253b` |
| `0015_inventory_staff_access.sql` | 1790704800000 | `1a92e0471ac2741fe9bfe7497ff863ec1760ee254d4189d431bc7483e4b590de` |
| `0016_inventory_receipt_sources.sql` | 1790816400000 | `648068167b39d7deae50b7d253956e7864a54f90245cef108fdd0c04b991a5ab` |
| `0017_sales_events.sql` | 1791766800000 | `55e97cf3d64826815b06b208d71bfab5ae495cad6cecbc35e46c15254ffce6e4` |
| `0018_sandbox_bookings.sql` | 1794528000000 | `8d7c6f64835ee380a32ee06a67c46a609f9f98936f95cefe62a77f6af37b17f4` |
| `0019_checkout_payment_attempts.sql` | 1795071600000 | `a11e6fef202424c5fbf7448dd5e5770c12500feb404567680118609050742c95` |
| `0020_runtime_schema_parity.sql` | 1795305600000 | `513227c7445189cb01c2ee905df1e65c83558b66a45d4914ae291d287f020fbf` |

## Backup, rehearsal, deployment, rollback, UAT

1. **Backup.** Setelah identitas host dan DB lolos guard, operator meminta backup konsisten melalui prosedur staging yang diotorisasi. Catat waktu, checksum, schema, migrasi dan digest terakhir yang diketahui baik. Simpan akses privat dan siapkan dump yang disanitasi dengan relasi dan jurnal utuh. Hentikan rencana jika backup atau target belum terverifikasi.
2. **Restore rehearsal.** Gunakan MySQL disposable yang terisolasi dengan akun terbatas dan provider mock. Verifikasi target loopback/clone, nama schema disposable, dan ketiadaan akses ke provider sebelum impor atau migrasi. Pertahankan salinan acuan. Bandingkan bukti jurnal asli, tipe/default/constraint, histogram status order/invoice/grant/ledger, dan orphan pada FK baru. Cari tahu asal lima entri jurnal terlebih dahulu. Jalankan migrator dan uji ulang hanya pada clone yang baseline-nya sudah direkonsiliasi. [Rehearsal lengkap](./atomic-voucher-release-candidate-v09.md#rehearsal-database-staging-yang-disanitasi)
3. **Deployment terencana.** Setelah review CI, provenance, dan hasil rehearsal, operator hanya dapat menyusun window staging terpisah dengan digest aplikasi/migrator yang disetujui. Verifikasi backup dan checkpoint, bandingkan target Compose, serta pertahankan voucher dan booking OFF sampai UAT disetujui. Rencana berhenti sebelum command yang mengubah server. Hindari merge atau dispatch `main` sebagai cara mengecek readiness karena workflow itu dapat mendeploy staging.
4. **Rollback.** Hentikan migrator bila checkpoint atau gate gagal. Pertahankan checkpoint, jurnal, dan bukti. Jika DDL sudah berjalan, pemulihan schema membutuhkan backup terverifikasi dan rehearsal terisolasi. Uji digest aplikasi lama terhadap schema migrated sebelum penggantian image. Pertahankan callback TEST untuk order pending dan data audit sampai rekonsiliasi selesai.
5. **Controlled UAT.** Persetujuan operator harus mencantumkan SHA/digest, window, akun dan fixture TEST serta batas transaksi. Setelah itu, ikuti matriks checkout, PAID/EXPIRED, cancellation, replay, konkurensi, refund poin, stok/invoice, recovery dan rekonsiliasi pending. [Matriks UAT dan rollback](./atomic-voucher-release-candidate-v09.md#checklist-uat-staging)

Status saat ini: **NO-GO untuk deployment dan aktivasi UAT** hingga provenance, jurnal dan schema staging, restore rehearsal aktual, serta CI kandidat dapat dibuktikan. Produksi tidak termasuk gate ini.
