# Bukti rilis Atomic Voucher v0.5

**Rekomendasi produksi — NO-GO. UAT staging belum dijalankan.**

## Integrasi GitHub

| Bukti | Hasil |
| --- | --- |
| Baseline | `cd9cda22ecfce10c4fce87acf22bdddf27474aeb` pada branch `feature/atomic-voucher-lifecycle-v03`. |
| PR baseline | PR #92 menargetkan `feature/atomic-voucher-checkout-v01` dan sudah merged. Head PR cocok dengan baseline. Status Draft historis belum terverifikasi. |
| CI pada SHA baseline | Halaman Checks PR #92 menyatakan “There are no checks for this commit.” Workflow sebelumnya hanya mencakup PR ke `main` dan `production`. v0.5 menambahkan branch integrasi ke filter workflow yang sama. |
| CI pada merge commit | Workflow PR #91 lulus pada `f4f6098e61f45952924da478c807367dd82cf622`. Git tree `68f0ec8f5689ab17cc7e97069928be071daa61b6` identik dengan baseline. Ini merupakan bukti CI untuk tree yang sama pada SHA merge. |
| Produksi | Ref `main` yang diperiksa berada di `a0ad8b4` dan `production` di `ed7a19f`. Merge PR #92 terjadi pada branch integrasi. |

- [PR #92 dan Checks](https://github.com/one2pret/onetone-store/pull/92/checks)
- [PR #91](https://github.com/one2pret/onetone-store/pull/91)
- [Run CI merge commit](https://github.com/one2pret/onetone-store/actions/runs/44964162750)

## Preflight staging

| Pemeriksaan | Status | Bukti dan pekerjaan tersisa |
| --- | --- | --- |
| Akses publik halaman kembali TEST | PASS terbatas | GET halaman kembali menampilkan halaman “Kembali ke OneTone Mobile — Pembayaran TEST”. Respons ini menguji ketersediaan halaman. |
| Commit runtime, `APP_ENV`, kredensial TEST, flag OFF | NOT VERIFIED | Konfirmasi SHA atau digest terpasang dan periksa keberadaan serta prefix kredensial dari runtime staging tanpa mencetak nilainya. Default flag voucher pada kode adalah `false`. |
| Database dan migrasi staging | NOT VERIFIED | v0.4 dan v0.5 tidak menambah migrasi. Bandingkan jurnal runtime dengan file repository dan periksa index unik dalam tabel order, payment attempt, grant, serta ledger poin sebelum UAT. |
| Autentikasi webhook dan transaksi | PASS lokal | Kedua jalur webhook memakai `x-callback-token` dengan perbandingan constant-time. Request invalid diuji tanpa perubahan database. Invoice, order, nominal, grant, stok dan ledger diverifikasi oleh kernel transaksi. Bukti runtime staging masih diperlukan. |
| Redaksi log | PASS untuk event voucher yang diuji lokal | Event settlement dan kegagalan invoice menyimpan status serta ID internal. Tes menyuntikkan error provider dan SQL sintetis untuk memeriksa redaksi. Sink log staging dan handler legacy lain belum diaudit melalui runtime. |
| UAT staging | BLOCKED | Runtime, akun dan grant TEST terisolasi, serta persetujuan aktivasi flag belum terverifikasi. GET publik adalah satu-satunya pemeriksaan staging pada putaran ini. |

Migrasi `0018` dan `0019` ada pada selisih terhadap branch produksi yang diperiksa. Tes lokal menjalankan migrasi terkait pada fixture disposable serta membangun skema checkout dari Drizzle. Sebelum promosi, rehearsal pada salinan disposable yang disetujui harus memeriksa jurnal, durasi DDL, kecocokan skema, backup, dan pemulihan. Verifikasi constraint unik order number, `(order_id, attempt_no)`, `external_id`, `xendit_id` pada payment attempt, grant `(user_id, voucher_id)`, dan ledger `(membership_id, order_id, reason)`. Invoice lokal sendiri belum memiliki unique index untuk ID provider. Observasi lebih dari satu invoice atau attempt untuk order UAT memerlukan rekonsiliasi.

## Matriks UAT yang dapat diulang

Baseline `cd9cda2` lulus 104 tes terarah. v0.5 lulus 105 tes terarah dan 882 tes Vitest penuh dengan MySQL lokal.

Jalankan suite lokal pada MySQL 8 disposable. Berikan `SANDBOX_BOOKING_TEST_DATABASE_URL` yang menunjuk ke `127.0.0.1` atau `localhost` dengan path `/sbx_booking_test`. Suite membuat skema acak, memakai provider mock, lalu menghapus skema itu.

```bash
npm run test:run -- tests/integration/checkout-voucher.test.ts \
  tests/integration/sandbox-payment-ledger-runtime.test.ts \
  tests/integration/sandbox-webhook-ledger-sync.test.ts \
  tests/integration/checkout-payment-attempts.test.ts \
  tests/integration/sandbox-booking.test.ts \
  tests/api/order-actions.test.ts tests/api/webhooks-xendit.test.ts \
  lib/checkout/sandbox-xendit-webhook.test.ts \
  lib/checkout/sandbox-order-policy.test.ts
```

| Skenario | Bukti yang harus dicatat per order TEST |
| --- | --- |
| Voucher eligible dan retry | Total tersimpan, satu order, satu attempt, reservasi grant yang sama. |
| Ubah voucher atau poin | HTTP 409 dengan UUID yang sama, tanpa invoice kedua. |
| PAID terautentikasi | Token salah ditolak. Invoice paid, order packing, grant redeemed sekali, dan bukti saldo stok. |
| Expiry terverifikasi | GET provider berstatus EXPIRED. Invoice/order terminal, stok kembali, grant dilepas hanya jika eligible. |
| Duplikat, urutan terbalik, dan balapan | Satu hasil terminal dan satu log transisi. Callback bertentangan meminta rekonsiliasi. |
| Pemulihan poin dan rollback | Tepat satu kredit sebesar debit asli. Kegagalan ledger membatalkan settlement. |
| Bukti provider salah atau tidak tersedia | Tidak ada perubahan grant, stok, atau saldo. |
| Order pending | Checkout mengembalikan 202 dan retry mempertahankan order serta satu attempt. Invoice yang belum tercatat membuat webhook meminta retry. |

Gunakan instruksi aktivasi dan checklist di [audit voucher v0.4](./atomic-voucher-audit.md) untuk UAT staging yang disetujui. Pakai akun, alamat, grant, stok, dan invoice TEST yang ditetapkan sebelumnya. Simpan waktu, SHA runtime, status HTTP, dan ringkasan sebelum/sesudah. Samarkan identitas pelanggan dan ID provider dari laporan.

## Diagnostik rekonsiliasi

Cari `sandbox_invoice_setup` untuk setup yang ambigu, `sandbox_settlement` untuk hasil callback, dan `sandbox_cancellation` untuk hasil pembatalan. Log yang menyertakan `orderId` dapat dikorelasikan dengan data TEST yang telah disetujui. Untuk callback tanpa invoice yang bisa dicocokkan, gunakan waktu kejadian dari dashboard TEST dan cocokkan secara privat. Jangan memasukkan token, URL invoice, payload provider, atau identitas pelanggan ke laporan.

Query berikut bersifat read-only dan mensyaratkan order number persis dari daftar UAT yang disetujui. Gunakan akun DB read-only staging setelah identitas lingkungan terverifikasi. Nilai contoh sengaja tidak cocok dengan order.

```sql
SET @uat_order_number = 'SBX-REPLACE-WITH-APPROVED-UAT-ORDER';

SELECT o.id AS order_id, o.status AS order_status, o.points_redeemed,
       a.id AS attempt_id, a.status AS attempt_status, a.updated_at AS attempt_updated_at,
       a.xendit_id IS NOT NULL AS has_provider_id,
       i.id AS invoice_row_id, i.invoice_status,
       g.user_voucher_status AS grant_status, g.reserved_order_id, g.redeemed_order_id
FROM orders o
LEFT JOIN checkout_payment_attempts a ON a.order_id = o.id
LEFT JOIN invoices i ON i.order_id = o.id
LEFT JOIN user_vouchers g ON g.voucher_id = o.voucher_id AND g.user_id = o.user_id
WHERE o.order_number = @uat_order_number
  AND o.order_number LIKE 'SBX-%' AND o.voucher_id IS NOT NULL;

SELECT p.reason, COUNT(*) AS entries, SUM(p.delta) AS net_points
FROM points_ledger p JOIN orders o ON o.id = p.order_id
WHERE o.order_number = @uat_order_number
  AND o.order_number LIKE 'SBX-%' AND o.voucher_id IS NOT NULL
GROUP BY p.reason;

SELECT m.type, COUNT(*) AS entries, SUM(m.quantity_delta) AS net_units
FROM inventory_movements m JOIN orders o ON o.id = m.reference_id
WHERE m.reference_type = 'order' AND o.order_number = @uat_order_number
  AND o.order_number LIKE 'SBX-%' AND o.voucher_id IS NOT NULL
GROUP BY m.type;
```

1. Tinjau `needs_reconciliation` segera. Untuk `requesting`, bandingkan umur attempt dengan batas waktu operasi yang disetujui. Status ini menunjukkan hasil provider belum dapat diasumsikan.
2. Cari invoice di dashboard Xendit TEST berdasarkan nomor eksternal order. Cocokkan mode, nomor, nominal, ID invoice, dan status. Simpan hasil cocok/tidak cocok dalam catatan UAT.
3. Jika invoice dan attempt lokal cocok, gunakan alur retry webhook atau konfirmasi pembatalan yang sudah diotorisasi sesuai hasil TEST. Keputusan terminal yang bertentangan diteruskan ke operator.
4. Jika provider menunjukkan invoice yang belum tercatat, hentikan proses otomatis. Jalur pemulihan untuk menautkan invoice yatim belum tersedia. Eskalasi untuk prosedur terulas. Retry dengan kunci lama tetap 202. Pembuatan invoice baru dengan kunci lain berisiko menagih dua kali.

## Rollback dan keputusan

- Catat SHA/digest aplikasi dan migrator terakhir yang diketahui baik, hasil restore backup disposable, serta pemilik keputusan sebelum perubahan staging.
- Matikan penerimaan voucher baru bila UAT gagal. Pertahankan webhook TEST sampai order pending dan konflik sudah direkonsiliasi. Pertahankan data audit dan ledger.
- Setelah rekonsiliasi, revert kode fitur sesuai scope insiden. Untuk skema additive, pertahankan riwayat migrasi dan uji kompatibilitas aplikasi lama pada salinan disposable sebelum mengganti image.
- Produksi tetap **NO-GO** sampai exact-head CI, preflight runtime staging, UAT end-to-end, rehearsal migrasi/restore, dan prosedur pemulihan invoice yatim memiliki bukti serta persetujuan.
