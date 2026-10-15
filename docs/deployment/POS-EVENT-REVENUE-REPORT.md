# Laporan omzet Sales Event / Bazaar

Route admin: `/dashboard/reports/events/sales`. Buka **Laporan > Sales Event / Bazaar > Lihat laporan omzet event**.

## Cakupan

- Ringkasan dan hasil per event: bruto tercatat, diskon promo dan manual/voucher, penjualan sebelum refund, refund, omzet bersih, transaksi, unit jual/retur, rata-rata transaksi sebelum refund, sesi penjualan.
- Ringkasan metode penjualan dan refund: cash, QRIS, transfer; metode yang berbeda tetap dipisahkan.
- Filter tanggal WIB (maksimum 366 hari), event, ID pemilik sesi dan lokasi stok sesi.
- Saat satu event dipilih: metadata acara, hasil harian WIB dan 25 kasir pertama. Tautan laporan kasir mempertahankan event/tanggal/lokasi/kasir dan menyediakan pagination lanjut.
- Event Draft, Aktif, Selesai, Dibatalkan tetap dapat dipilih. Hasil hanya memuat event yang memiliki penjualan sesuai filter; event tanpa penjualan menghasilkan ringkasan kosong, bukan baris omzet yang dibuat-buat.

Target revenue, grafik, top produk/varian, export dan attributed cashier berbeda dari pemilik akun belum ditambahkan pada tahap ini.

## Kontrak angka

Event berasal dari `pos_sessions.sales_event_id` pada sesi **order penjualan asal**. Tidak ada event ID baru pada orders. Sesi reguler dan sesi lama dengan event NULL tidak masuk laporan dan tidak dibackfill otomatis.

Order yang dihitung: `order_channel = pos`, status `delivered`, `paid_at` dalam rentang tanggal WIB. Batas awal inklusif; batas akhir eksklusif dan dibatasi waktu laporan dibuka. Periode acara hanya konteks metadata, tidak digunakan untuk membuang penjualan sesi yang berlanjut setelah acara berakhir.

Refund mengikuti `pos_returns.order_id`, sampai waktu laporan dibuka, termasuk refund setelah periode penjualan. Petugas refund dan sesi pembayaran refund tidak mengubah atribusi event/kasir. Hasil harian mengurangi hari pembayaran order asal, bukan menampilkan arus kas berdasarkan tanggal refund.

Bruto tercatat = subtotal + diskon promo snapshot item. Semua diskon = promo snapshot + `orders.discount_amount`. Omzet bersih = `SUM(orders.total) - refund`; tidak mengurangi diskon dua kali. Rata-rata = penjualan sebelum refund / transaksi. Unit retur dihitung meskipun barang tidak direstock.

Harga reguler legacy NULL memakai harga jual sebagai fallback dan diberi penanda kelengkapan. Order dengan item hilang juga diberi penanda. Order event tanpa tanggal pembayaran atau berstatus selain delivered ditandai sebagai dikecualikan, bukan dimasukkan diam-diam.

## Query dan keamanan

Ledger item, nominal refund dan unit retur diaggregasikan pada grain order sebelum join, sehingga beberapa item/refund tidak menggandakan penjualan. Ledger SQL dipakai bersama laporan kasir. Grouping event, grouping hari, jumlah event, ringkasan seluruh hasil dan pagination dikerjakan MySQL, bukan mengambil semua orders ke JavaScript.

Data dibaca dalam transaksi read-only repeatable-read. Action dan layout memerlukan admin aktif; ID filter divalidasi sebelum aggregation. Nilai filter dibind sebagai parameter SQL. Nama dimensi event/day hanya pilihan internal yang tetap.

Default laporan 30 hari. Metadata pilihan event/kasir/lokasi masih dibaca sebagai daftar kecil, bukan transaksi. Untuk pertumbuhan volume besar, ukur EXPLAIN pada testing terlebih dahulu; index composite tambahan hanya dibuat lewat migration versioned jika terbukti perlu.

## Migrasi/deployment

**Tidak ada migrasi tambahan untuk laporan omzet.** Namun schema `0017_sales_events` dari tahap sebelumnya wajib tersedia sebelum aplikasi ini dijalankan. Lokal sudah dimigrasikan; testing dan production harus dipastikan terpisah sesuai prosedur deployment.

Jangan jalankan `db:push`. Jangan mengulang SQL manual `0017` yang sudah tercatat. Laporan tidak mengubah checkout, approval event, alokasi stok, voucher, poin, retur ataupun perhitungan close/Z-report.

## Verifikasi

- Tes action: akses admin, tanggal/ID, snapshot read-only, hasil harian/kasir hanya untuk event terpilih.
- Tes komponen: form GET, filter dan link drill-down, pagination, empty/error serta kelengkapan data.
- Tes SQL MySQL: refund lintas event, multi-item/multi-refund, diskon snapshot, batas as-of, hari WIB, sesi reguler, filter kasir/lokasi, pagination semua-halaman.
- Regresi laporan kasir wajib lulus karena ledger dipakai bersama.

```sh
pnpm test:run tests/actions/pos-event-reports.test.ts tests/components/event-revenue.test.tsx tests/unit/pos-reporting-queries.test.ts
```

Tes integrasi memakai database MySQL sementara localhost dengan namespace `pos_report_test`. Suite membuat/menghapus hanya database unik miliknya. Jangan memakai DATABASE_URL aplikasi sebagai URL test.

## Pemeriksaan UI dan batas bukti

Skill antislop digunakan selama pengembangan. Dials: ENERGY 1 / RHYTHM 2 / MOTION 1. Struktur mengikuti pertanyaan operasional: omzet keseluruhan, event mana, kontribusi kasir, dan hari penjualan. Warna/font diwarisi dari tokens tema aplikasi saat ini; fokus foreground berkontras tinggi. Kartu event menjadi ringkasan yang bisa dibaca mobile, bukan dekorasi. Tidak ada grafik, angka contoh, visual asset atau animasi baru pada aplikasi.

Tes komponen sudah menjalankan alur form, link, empty/error dan pagination pada DOM. Build production berhasil. Upaya Chromium lokal untuk pemeriksaan responsif/tema gagal saat launch (`spawn Unknown system error -88`), sehingga **QA visual browser belum selesai** dan tidak diberi PASS. Harness tersebut hanya memakai fixture uji; tidak menyentuh akun/transaksi database aplikasi.

Sebelum promosi ke server, periksa secara manual:

1. Lebar 375px, tablet, desktop; tema light/dark, nama event panjang dan nominal besar tidak overflow.
2. Tab/Shift+Tab: semua field/link/button terjangkau; fokus terlihat; Enter mengirim filter.
3. Tampilkan semua event lalu pilih satu event; tanggal/kasir/lokasi dipertahankan saat drill-down, pagination dan buka seluruh kasir.
4. Periode tanpa penjualan, event kosong, ID invalid dan error koneksi menunjukkan empty/error yang jelas, bukan nol akibat error.
5. Cocokkan order event dan refund oleh admin/sesi lain; nilai event, kasir dan hari asal konsisten.
6. Pastikan tidak ada error console dan non-admin tetap ditolak.
