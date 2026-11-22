# Atomic Voucher v0.6 — bukti dan keputusan rilis

**NO-GO produksi. UAT staging belum dijalankan.** Persetujuan transaksi dan akses runtime staging belum tersedia pada sesi ini.

## Integrasi dan CI

- Baseline `8bed9504513d69fbdc71b80bba12ab9754b48d82` sudah masuk ke branch `feature/atomic-voucher-checkout-v01` melalui PR #93. Head PR #93 persis sama dengan baseline. Merge `d818b8dd3241a7d2ebcc82760a6dd7738af40fe7` memiliki tree yang identik, `f502ec2c5c9ce5f762d6ba2046c7b0e2625a931b`. [PR #93](https://github.com/one2pret/onetone-store/pull/93)
- CI lulus pada run untuk PR #93, termasuk TypeScript, Vitest dan MySQL. CI juga lulus pada head PR #91 yang memuat merge tersebut. [CI PR #93](https://github.com/one2pret/onetone-store/actions/runs/44964927696) · [CI PR #91](https://github.com/one2pret/onetone-store/actions/runs/44964941934)
- Bandingkan branch v0.6 dengan branch integrasi untuk perubahan pemulihan dan bukti rilis. [Perbandingan v0.6](https://github.com/one2pret/onetone-store/compare/feature/atomic-voucher-checkout-v01...feature/atomic-voucher-release-gate-v06?expand=1)

## Preflight read-only staging

| Pemeriksaan | Status | Bukti yang diperlukan |
| --- | --- | --- |
| Halaman kembali sandbox publik | PASS | GET mengembalikan HTTP 200. Bukti ini hanya mencakup ketersediaan halaman. |
| Commit runtime dan digest image | UNVERIFIED | Cocokkan revision label atau catatan build dengan sha, lalu cocokkan digest image aplikasi dan migrator dengan registry. |
| APP_ENV dan konfigurasi deploy | UNVERIFIED | Operator mencatat `APP_ENV=staging` dan nilai nonrahasia yang diperlukan dari container aktif. |
| Mode Xendit TEST | UNVERIFIED | Catat hasil pemeriksaan prefix TEST dan pencocokan akun TEST sebagai boolean. |
| Flag voucher, order sandbox, ledger, booking | UNVERIFIED | Catat nilai boolean dari runtime. Kode memiliki default OFF untuk opt-in voucher. Aktivasi menunggu persetujuan eksplisit. |
| Koneksi DB staging | UNVERIFIED | Operator dengan akses read-only menjalankan `SELECT 1` melalui jalur koneksi aplikasi staging yang telah diverifikasi. |
| Skema dan jurnal migrasi staging | UNVERIFIED | Cocokkan versi jurnal dan index order number, invoice/attempt, grant dan poin dengan baseline. Periksa duplikasi invoice dan attempt dalam order TEST yang disetujui. |
| Konfigurasi callback dan autentikasi | UNVERIFIED | Periksa URL dashboard TEST dan konfigurasi token. Jalankan tes callback yang diotorisasi setelah identitas runtime serta fixture disetujui. Suite lokal membuktikan token keliru ditolak. |
| Log settlement dan diagnostik | UNVERIFIED | Periksa sink log staging, redaksi, dan korelasi ID order TEST. Filter `sandbox_invoice_setup`, `sandbox_settlement`, `sandbox_cancellation` dan `sandbox_invoice_recovery`. |

Gunakan akses staging yang sudah diotorisasi. Untuk image yang sedang berjalan, baca ID image dari `docker inspect`, kemudian baca `RepoDigests` dan label revisi dari `docker image inspect` pada ID tersebut. Jangan memakai tag mutable sebagai bukti digest. Laporkan keberadaan token dan hasil validasi prefix tanpa mencetak env penuh, credential, payload atau data pelanggan. Setelah verifikasi DB, gunakan query order-level dari [bukti v0.5](./atomic-voucher-release-evidence-v05.md).

## Pemulihan invoice yatim

1. Isolasi order TEST `waiting_payment` dengan grant voucher yang masih direservasi dan tepat satu payment attempt `needs_reconciliation` tanpa provider ID. Checkout dengan kunci lama tetap menunjuk order yang sama.
2. Operator yang terautentikasi memeriksa akun Xendit TEST dan mencari nomor order sebagai external ID. Harus ada **tepat satu** invoice kandidat. Periksa ID, nominal, status, dan waktu kedaluwarsa. Jika pencarian tidak lengkap, menemukan beberapa invoice, atau status sudah terminal, hentikan dan eskalasi. Attempt `requesting` yang macet juga memerlukan prosedur terpisah karena proses pertama mungkin masih berjalan.
3. Catat persetujuan dan referensi audit nonrahasia. Setelah operator menyetujui tindakan tulis terhadap fixture tersebut, jalankan sebagai job operator staging dengan checkout pada SHA yang disetujui atau image migrator yang cocok, serta konfigurasi TEST dari secret store yang berwenang. Image aplikasi standalone tidak memuat sumber script dan dependency tsx. Gunakan ID admin, order, pemilik, attempt, dan invoice yang telah disetujui.

```bash
./node_modules/.bin/tsx scripts/recover-sandbox-voucher-invoice.ts \
  --apply-reviewed ACTOR_ID ORDER_ID OWNER_ID ATTEMPT_ID INVOICE_ID APPROVAL_REF
```

Perintah memakai GET invoice terautentikasi dengan kunci TEST dan bukti `PENDING` yang berlaku. Setelah lock, role admin, pemilik, order, attempt, grant, nominal dan bukti diperiksa kembali. URL pembayaran harus berada pada origin checkout TEST. Satu transaksi menyimpan invoice, mengubah attempt ke `ready`, dan menulis audit ID admin serta referensi persetujuan. Ulangan yang cocok menghasilkan `already_recovered`. Kode pemulihan tidak memiliki jalur pembuatan invoice. Status terminal yang sudah tercatat tetap berlaku. Untuk invoice provider yang sudah PAID atau EXPIRED sebelum dapat ditautkan, prosedur adjudikasi terminal masih perlu review.

4. Cocokkan ulang order, invoice, attempt dan audit. Ulangi checkout dengan UUID asal. Jika provider beralih ke terminal setelah penautan, gunakan webhook TEST yang sah untuk melanjutkan settlement. Konflik tetap ditangani operator, tanpa menerbitkan invoice baru atau melakukan koreksi status dengan SQL ad hoc.

## Runner dan checklist UAT

`bash scripts/run-atomic-voucher-uat-local.sh` menerima `SANDBOX_BOOKING_TEST_DATABASE_URL` untuk MySQL disposable loopback dengan path `/sbx_booking_test`. Runner menolak URL nonlokal dan menggunakan provider mock. Hasil v0.6 di lingkungan ini adalah 115 tes terarah dan 885 tes penuh lulus.

| Skenario | Bukti lokal | Staging |
| --- | --- | --- |
| Checkout, retry, mutasi voucher atau poin | PASS. Satu invoice dan 409 pada mutasi kunci yang sama. | UNVERIFIED |
| PAID, voucher redemption, callback duplikat dan terlambat | PASS. Token salah ditolak dan keputusan terminal tetap. | UNVERIFIED |
| EXPIRED, CANCELLED, PAID paralel | PASS. Settlement hanya sekali, stok dan poin konsisten. | UNVERIFIED |
| Provider salah, debit atau grant tidak cocok, rollback | PASS. Perubahan database dibatalkan saat bukti atau ledger bermasalah. | UNVERIFIED |
| Invoice yatim PENDING | PASS. Recovery paralel menautkan satu invoice dan satu audit. Kegagalan audit membatalkan attachment. | UNVERIFIED |
| Invoice yatim terminal atau ambigu | PASS untuk penolakan lokal. Rekonsiliasi operator diperlukan. | UNVERIFIED |

Pada staging, minta persetujuan yang mencantumkan waktu, akun dan grant TEST, stok/order yang boleh diubah, bukti backup, serta pemilik keputusan rollback. Setelah preflight lulus dan persetujuan tercatat, ikuti [checklist aktivasi dan UAT](./atomic-voucher-audit.md). Catat SHA/digest runtime, kode respons dan bukti before/after per fixture. Simpan ringkasan yang sudah disamarkan.

## Backup, restore dan latihan migrasi

| Pemeriksaan | Status | Bukti |
| --- | --- | --- |
| Dump dan restore MySQL lokal | PASS | MySQL 8.0.46. Dump konsisten dari skema Drizzle 44 tabel dengan fixture sintetis dipulihkan ke database disposable lain. Order `waiting_payment`, attempt `needs_reconciliation` dan grant `reserved` beserta relasinya cocok sebelum dan sesudah restore. SHA-256 dump lokal `a348ca146549c0afbb19a79ce6969db454dcb6ca9d924011b1f970cb19fc9f16`. Kedua DB fixture dan dump lokal sudah dibersihkan. |
| Migrasi dari database kosong | FAIL | `drizzle-kit migrate` pada MySQL 8.0.46 gagal di `0001_product_scheduled_pricing.sql`. File mengelompokkan beberapa ALTER dalam satu statement yang ditolak MySQL dengan SQLSTATE `42000`. Percobaan memakai DB disposable, yang sudah dibersihkan. |
| Backup/restore staging dan rehearsal upgrade dari baseline | UNVERIFIED | Belum ada backup staging yang diotorisasi. Jangan menyamakan restore skema Drizzle lokal dengan verifikasi jurnal atau upgrade staging. |

### Prosedur operator

1. Verifikasi waktu, cakupan, checksum dan retensi backup staging melalui kanal yang disetujui. Simpan snapshot konsisten dan catat jurnal migrasi, digest aplikasi/migrator serta posisi restore.
2. Restore hanya ke target disposable terverifikasi. Isolasi akses jaringan dan akun provider. Cocokkan jumlah baris serta ringkasan order TEST, invoice, attempt, stok, grant dan ledger poin. Bandingkan status sebelum dan sesudah.
3. Setelah blocker migrasi historis ditangani dalam perubahan terpisah, ulangi dry run dari DB kosong dan upgrade dari salinan baseline yang disetujui. Catat hasil per langkah dan efek DDL yang parsial bila terjadi kegagalan. Jangan mendorong jurnal secara manual.
4. Bila rollback diperlukan, nonaktifkan penerimaan voucher baru, pertahankan callback TEST selama rekonsiliasi pending, dan simpan bukti konflik. Gunakan digest aplikasi sebelumnya setelah uji kompatibilitas dengan skema yang dipulihkan. Hindari down migration ad hoc.
5. Setelah rollback, periksa startup aplikasi, pasangan order/invoice/attempt, audit dan debit/kredit poin, stok dan grant. Ulangi callback pada fixture yang disetujui dan verifikasi tepat satu hasil terminal. Gunakan restore backup yang sudah diuji jika pemulihan skema diperlukan.

**Gate produksi NO-GO:** Perbaiki dan ulangi migrasi, verifikasi runtime staging dan backup, selesaikan UAT dengan persetujuan, serta dapatkan CI pada head v0.6 dan review prosedur untuk invoice yatim terminal.
