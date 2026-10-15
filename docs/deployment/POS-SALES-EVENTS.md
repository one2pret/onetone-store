# POS Sales Events, tahap 1

Lanjutan laporan omzet event dijelaskan di [POS-EVENT-REVENUE-REPORT.md](./POS-EVENT-REVENUE-REPORT.md). Laporan menggunakan schema tahap 1 tanpa migration tambahan.

## Ruang lingkup

Admin mengelola event melalui **Laporan > Sales Event / Bazaar** (`/dashboard/reports/events`). Kasir memilih event opsional ketika membuka sesi POS. Relasinya `sales_events -> pos_sessions -> orders`; tidak ada kolom event di orders. Identitas kasir dan perhitungan checkout, stok, poin, voucher, retur, dan Z-report tidak diganti.

Tahap ini belum menyediakan laporan omzet per event, target penjualan, grafik, atau pemilihan kasir berbeda dari akun login. Laporan kasir sebelumnya tetap tersedia. Refund untuk laporan kinerja tetap harus mengikuti order dan sesi penjualan asal, bukan petugas pemroses refund.

## Aturan operasional

- Kode unik, nama, periode wajib. Input dan tampilan waktu event memakai WIB, tersimpan sebagai waktu UTC. Tahun dibatasi 2000–2037 sesuai batas MySQL TIMESTAMP.
- Event baru berstatus Draft atau Aktif. Draft dapat diaktifkan/dibatalkan; Aktif dapat diselesaikan/dibatalkan. Status terminal tidak dapat dibuka ulang.
- Hanya event Aktif dengan `starts_at <= sekarang < ends_at` dapat dipilih. Validasi diulang di server saat membuka sesi, bukan hanya dropdown.
- Periode membatasi sesi baru, bukan transaksi pada sesi yang sudah dibuka. Kasir tetap harus menutup sesi tersebut.
- Lokasi default event hanyalah pilihan awal. Sumber stok sesungguhnya tetap `pos_sessions.location_id`, sehingga kasir dapat memilih lokasi POS aktif lain.
- Detail event (termasuk periode, nama, venue, kode, lokasi default, catatan) terkunci setelah sesi pertama. Untuk konteks berbeda, buat event dan sesi baru. Tidak ada aksi pemindahan sesi atau penghapusan event.
- Semua sesi event harus ditutup sebelum event diselesaikan/dibatalkan. Pembukaan sesi dan perubahan event memakai lock row event yang sama; pembukaan satu akun juga diserialisasi melalui lock row user.
- Sesi lama tidak diasumsikan pernah mengikuti event. `sales_event_id` tetap NULL. Tidak ada backfill otomatis.

## Migrasi dan rollout

Migrasi versioned: `lib/db/migrations/0017_sales_events.sql`, tercatat di `_journal.json`.

Perubahannya additive: tabel baru `sales_events`, foreign key nullable `pos_sessions.sales_event_id`, index event pada sesi, dan index `(status, starts_at)` pada event. Tidak menghapus kolom maupun memperbarui data lama. Index foreign key mencegah penghapusan event yang sudah dipakai.

**Jalankan migrasi sebelum kode baru melayani request.** Select Drizzle atas sesi kini membaca kolom event; menjalankan aplikasi baru pada schema lama akan gagal. Jangan gunakan `db:push` terhadap testing/production.

1. Pastikan testing menggunakan baseline migrasi sampai 0016, dan tidak ada tabel/kolom event yang dibuat manual.
2. Siapkan backup database yang dapat dipulihkan dan jadwalkan rollout dengan memperhatikan sesi POS aktif. ALTER TABLE bisa menunggu metadata lock pada tabel sesi.
3. Gunakan mekanisme migrasi versioned proyek yang sudah dipakai oleh deployment. Dockerfile menjalankan `npx drizzle-kit migrate` sebelum container aplikasi baru dimulai. Jangan menjalankan dua migrator bersamaan.
4. Pastikan log migrasi berhasil, journal database menampilkan entry baru, dan hasil read-only berikut sesuai:

```sql
SHOW CREATE TABLE sales_events;
SHOW COLUMNS FROM pos_sessions LIKE 'sales_event_id';
SHOW INDEX FROM pos_sessions WHERE Key_name = 'pos_sessions_sales_event_idx';
SELECT COUNT(*) AS legacy_sessions FROM pos_sessions WHERE sales_event_id IS NULL;
```

5. Uji testing: buat draft, aktifkan dengan periode WIB saat ini, buka sesi event, transaksi/refund, tutup sesi, lalu selesaikan event. Pastikan kasir tidak bisa mengelola event, sesi reguler tetap berjalan, laporan kasir tetap sama, dan konteks event tampil pada detail sesi.
6. Setelah testing disetujui, ulangi backup, migrasi, dan smoke test di production melalui deployment yang sudah ada.

Migrasi yang sudah selesai dicatat oleh Drizzle dan dilewati saat runner dipanggil ulang. **DDL MySQL tidak sepenuhnya transaksional:** jika proses gagal setelah CREATE TABLE tetapi sebelum ALTER/journal, jangan retry buta, jangan hapus tabel, dan jangan memalsukan entry journal. Periksa schema, log, backup, serta histori migrasi terlebih dahulu untuk menyusun recovery yang tepat.

## Rollback

Rollback aplikasi ke image lama sambil **mempertahankan schema additive**. Writer lama yang tidak mengirim `sales_event_id` tetap menghasilkan NULL; data dan relasi event yang sudah terbentuk tetap tersimpan. Jangan drop tabel/kolom untuk rollback rutin. Aplikasi lama tidak menampilkan/mengelola event dan sesi baru dari aplikasi lama tidak teratribusi event; selesaikan sesi event yang aktif sebelum downgrade bila memungkinkan.

## Bukti pengujian

- `tests/unit/sales-events.test.ts`: validasi WIB, tanggal, status, batas periode.
- `tests/actions/sales-events.test.ts`: otorisasi, metadata terkunci, status, kepemilikan sesi, input dan error.
- `tests/components/sales-events.test.tsx`: sesi reguler, pemilihan/default lokasi, form admin, feedback, metadata terkunci dan pagination.
- `tests/integration/sales-events.test.ts`: menjalankan SQL migrasi nyata melalui Drizzle pada database sementara, retry setelah berhasil, preservasi data lama, writer lama, FK, action nyata, Z-report, dan race pembukaan/pembatalan.
- `tests/integration/pos-reporting.test.ts`: regresi SQL laporan kasir, termasuk refund pada kasir penjualan asal.

Tes integrasi hanya menerima server lokal dan namespace `pos_report_test`; setiap suite membuat database unik dan menghapus database yang dibuatnya sendiri. Contoh (ganti port dengan MySQL test sementara):

```sh
POS_REPORT_TEST_DATABASE_URL=mysql://root@127.0.0.1:PORT/pos_report_test pnpm test:run tests/integration/sales-events.test.ts tests/integration/pos-reporting.test.ts
```

Pengujian tersebut tidak menjalankan migrasi pada database aplikasi. Smoke test browser dan rollout testing/production harus diverifikasi terpisah; tes komponen bukan bukti QA visual browser.
