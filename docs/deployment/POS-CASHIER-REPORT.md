# Laporan kasir POS, tahap pertama

Route: `/dashboard/reports/cashiers`, khusus admin yang masih aktif. Laporan menggunakan tabel existing dan tidak membutuhkan migration. Event/bazaar dan assigned cashier ID belum tersedia pada tahap ini.

## Kontrak angka

- Identitas: `pos_sessions.cashier_id`, yaitu pemilik akun/sesi. `assigned_cashier_name` tidak dipakai sebagai kunci identitas. Login admin bersama tetap dilaporkan atas nama akun admin.
- Penjualan: order `channel = pos`, `status = delivered`, dengan `paid_at` dalam rentang tanggal WIB. Rentang SQL memakai batas awal inklusif dan batas akhir eksklusif. Sesi tidak difilter berdasarkan tanggal dibuka.
- Refund: semua `pos_returns` atas order penjualan yang terpilih, sampai waktu laporan dibuka. Refund diproses sesudah periode tetap mengurangi hasil penjual asal. `actor_user_id` dan sesi pembayaran refund bukan kunci atribusi performa.
- Bruto tercatat: subtotal order ditambah promo otomatis yang dapat dihitung dari snapshot item `regular_price - price`, dikalikan quantity. Harga reguler legacy yang NULL memakai harga jual sebagai fallback; laporan memberi penanda bahwa promo historis belum lengkap. Tidak membaca harga produk saat ini.
- Seluruh diskon: promo snapshot ditambah `orders.discount_amount`, yang sudah mencakup diskon manual item/transaksi dan voucher. Diskon tidak dikurangi ulang dari `orders.total`.
- Net sales: `SUM(orders.total) - refund`. Rata-rata transaksi: penjualan sebelum refund dibagi transaksi, bukan rata-rata dari rata-rata kasir.
- Items sold: quantity item, bukan jumlah baris. Retur quantity tetap mengurangi net items meskipun barang tidak direstock.
- Sesi penjualan: sesi unik yang mempunyai order terpilih. Sesi ditutup: sesi closed dengan `closed_at` dalam rentang. Selisih kas: snapshot `cash_difference` sesi tersebut, sekali per sesi. Sesi aktif dan sesi tanpa snapshot tidak dianggap selisih nol.
- Payment breakdown: metode penjualan dan metode refund masing-masing. Refund transfer atas penjualan tunai tidak dipindahkan ke baris tunai. Rincian mengikuti seluruh filter, tidak hanya halaman tabel.

Jumlah order/item/refund dihitung pada grain masing-masing sebelum digabung agar join tidak menggandakan nominal. Summary dan pagination SQL ada dalam query yang sama. Query laporan, kelengkapan data, dan pilihan filter dibaca dalam transaksi read-only repeatable-read. Versi Drizzle terpasang tidak menggabungkan `withConsistentSnapshot` dan `accessMode` dengan separator SQL yang benar; opsi tersebut tidak dikombinasikan. Snapshot repeatable-read terbentuk pada SELECT konsisten pertama.

## Kelengkapan dan batasan

Laporan menampilkan jumlah order dengan sesi hilang, tanggal pembayaran hilang, status pembayaran tidak lazim, lokasi sesi kosong, detail item kosong, atau harga reguler legacy. Diagnosis mengikuti filter dan memakai tanggal dibuat hanya untuk menandai order yang tidak mempunyai tanggal pembayaran. Order tersebut tidak disisipkan diam-diam ke angka penjualan.

Default rentang 30 hari; maksimum 366 hari. Tabel dipaginasi 25 kasir dan diurutkan net sales lalu ID. ID akun yang nonaktif tetap dapat difilter. Index baru belum ditambahkan. Sebelum deployment, uji pada testing dan periksa EXPLAIN menggunakan volume representatif; composite index yang diperlukan dibuat melalui migration versioned terpisah.

Penjualan dicatat menurut status saat laporan dibuka. Guard status POS pada action order umum dan race checkout/refund/close yang telah ditemukan dalam analisis adalah pekerjaan penguatan terpisah; laporan ini tidak mengubah lifecycle transaksi atau rekonsiliasi Z-report.

## Verifikasi

Unit/action/component tests:

```sh
pnpm test:run tests/unit/pos-reporting.test.ts tests/actions/pos-reports.test.ts tests/components/cashier-report.test.tsx
```

SQL integration tests memakai MySQL lokal khusus testing. Isi `POS_REPORT_TEST_DATABASE_URL` dengan URL localhost ke database bernama `pos_report_test...`; jangan menggunakan URL database aplikasi. Account test memerlukan izin membuat/menghapus database. Setiap run membuat database unik `pos_report_test_<uuid>` dan menghapus hanya database tersebut saat selesai. Test tidak menjalankan migration aplikasi dan tidak menyentuh tabel database aplikasi. Tanpa variable tersebut, integration tests dilewati.

```sh
pnpm test:run tests/integration/pos-reporting.test.ts
```

Smoke test setelah deploy testing:

1. Admin membuka menu Laporan dan Penjualan Kasir.
2. Atur tanggal, kasir, dan lokasi; pastikan filter tercatat dalam URL.
3. Bandingkan satu order dengan struk, promo, voucher, dan retur parsial.
4. Refund oleh admin/dari sesi lain tetap mengurangi penjual asal; periksa Z-report sesi pembayaran refund secara terpisah.
5. Bandingkan dua sesi dengan selisih kas sama untuk memastikan keduanya dihitung.
6. Uji mobile, keyboard, halaman kedua, filter tanpa hasil, dan akses non-admin.

Tahap berikutnya: Sales Event dengan nullable `pos_sessions.sales_event_id`, lalu ID kasir bertugas bila proxy cashier memang dibutuhkan. Keduanya harus memakai migration versioned additive.
