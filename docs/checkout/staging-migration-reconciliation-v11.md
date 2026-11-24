# Rekonsiliasi histori migrasi staging v1.1 — OneTone Store

**NO-GO untuk deployment staging.** Analisis ini mempertahankan RC v0.9 dan validasi runner. Sumber bukti staging adalah laporan operator dan kegagalan langkah migrator PR #95. Backup staging, isi jurnal lengkap, dan output metadata runtime belum tersedia untuk diperiksa di workspace ini.

## Akar masalah dan perbandingan jurnal

Migrator di merge `6057b3424c1814e97f3840b1542c09b58d8420c7` membaca hash SHA-256 dari bytes file SQL serta timestamp `when` dari `_journal.json`. Ia mengurutkan jurnal database dengan `ORDER BY created_at, id` dan membandingkan hash **dan** timestamp di setiap posisi mulai dari `0000`. Lima baris hanya valid sebagai prefix bila persis sama dengan `0000–0004`. [Runner](../../scripts/mysql-migrations.ts) · [Jurnal repo](../../lib/db/migrations/meta/_journal.json) · [Job staging](https://github.com/one2pret/onetone-store/actions/runs/44985359491/job/137095024427)

Mismatch pertama adalah **hash pada indeks 0**. Hash yang dilaporkan diawali `baseline-man`, sedangkan hash `0000` adalah `0fa018ca704d57cdf194495209f7e80ac0dc4c6919f193c043062ebf7b0be3d8` pada timestamp `1784002757594`. Runbook historis yang diperkenalkan di `d458e46` secara eksplisit mencatat `baseline-manual-through-0015` pada `1790704800000` untuk database yang sebelumnya dikelola dengan `drizzle-kit push`. Jika operator mengonfirmasi pasangan literal itu, baris 1 adalah marker baseline manual dengan **hash, timestamp, dan posisi** yang berbeda dari `0000`. Prefix yang dilaporkan sudah cukup untuk memastikan mismatch hash, namun nilai lengkap dan timestamp baris 1 belum terlihat. [Runbook historis](../deployment/SAFE-VERSIONED-MIGRATIONS.md)

| Posisi jurnal staging | Entri yang diwajibkan di posisi itu | Bukti aktual yang tersedia | Hipotesis yang perlu dicocokkan |
| --- | --- | --- | --- |
| 1 | `0000` · `1784002757594` | Hash berawalan `baseline-man`; timestamp belum diberikan | Marker `baseline-manual-through-0015` · `1790704800000` |
| 2 | `0001` · `1790154000000` | Timestamp dan hash belum tersedia | `0016` · `1790816400000` |
| 3 | `0002` · `1790157600000` | Timestamp dan hash belum tersedia | `0017` · `1791766800000` |
| 4 | `0003` · `1790161200000` | Timestamp dan hash belum tersedia | `0018` · `1794528000000` |
| 5 | `0004` · `1790172000000` | Latest timestamp `1795071600000`; hash belum tersedia | Timestamp cocok dengan `0019`, hash diharapkan `a11e6fef202424c5fbf7448dd5e5770c12500feb404567680118609050742c95` |

Template hipotesis lima baris berasal dari marker historis diikuti migrasi `0016–0019`. Gunakan `comparison` dari preflight untuk membandingkan seluruh hash aktual terhadap katalog repo dengan aman. `tagAtObservedTimestamp` dan `tagForExactHash` harus menunjuk migrasi yang sama agar suatu baris dapat dikaitkan dengan file tertentu. `documentedLegacyBaseline` hanya bernilai benar jika kedua nilai marker lama cocok persis. Hash dari DB yang tidak dikenal tidak dicetak. [Katalog timestamp dan hash lengkap](./staging-rc-v09-readiness.md#bukti-migrasi-0020)

Entry point Dockerfile historis memakai `drizzle-kit migrate`. Migrator MySQL Drizzle mengambil timestamp terakhir dan menjalankan file yang lebih baru. Itu menjelaskan bagaimana satu marker dapat diikuti empat migrasi biasa. Runner sekarang memverifikasi urutannya dari awal dan tidak dapat menerima representasi ringkas tersebut.

Timestamp maksimum yang dilaporkan berada sebelum 0020 (`1795305600000`; SHA-256 `513227c7445189cb01c2ee905df1e65c83558b66a45d4914ae291d287f020fbf`). Dengan snapshot yang dilaporkan, 0020 belum tercatat melalui pasangan resmi. Keberadaan perubahan fisiknya masih harus diperiksa. Error runner terjadi sebelum loop SQL migrasi versi. Runner dapat membuat tabel checkpoint sebelum menolak prefix, jadi operator tetap harus memeriksa metadata terkini. Container aplikasi lama dilaporkan tetap aktif.

## Paritas fisik

| Area | Status staging | Pemeriksaan pada clone sumber dan target pemulihan |
| --- | --- | --- |
| Voucher, customer, order, invoice, inventory, poin | UNVERIFIED | Bandingkan kolom, default, CHECK, PK/unique/FK dan relasi baris. Voucher `WELCOME5000`, backfill voucher pada 0003, serta saldo/pergerakan stok pada 0004 memerlukan pemeriksaan data karena paritas metadata saja tidak memverifikasinya. |
| Efek 0016–0018 | UNVERIFIED | Cocokkan metadata dari SQL aktual untuk receipt sources, sales events, dan sandbox bookings dengan clone. Jangan menyimpulkan seluruh riwayat dari satu tabel. |
| Efek 0019 | UNVERIFIED | Cocokkan `checkout_payment_attempts`, CHECK jumlah/attempt, unique `(order_id, attempt_no)`, external ID dan Xendit ID, serta FK ke order. |
| Efek 0020 | UNVERIFIED | Tabel afiliasi dilaporkan ada. Bandingkan tujuh tabel afiliasi dan komisi, kolom kategori/user/product/order, serta signature indeks dan FK. |
| Managed dan legacy-only | UNVERIFIED | Inventaris objek di luar kontrak termasuk trigger, view, routine, event, engine, collation, dan objek khusus operator sebelum merancang transfer. Pertahankan atau tinjau eksplisit setiap objek tersebut. |

Preflight guarded yang sama sekarang mengeluarkan `missingRequiredSignatures` dari kontrak repository, tanpa isi tabel. Jalankan blok SSH [release gate v1.0](./staging-release-gate-v10.md#satu-perintah-preflight-staging) dari checkout v1.1 yang sudah direview. Identitas deployment tetap diperiksa meski container lama masih aktif. Bagikan bagian `database_migrations`, `migration_0020_journal`, `database_schema`, dan checkpoint dari JSON teredaksi. Jalur SQL hanya membaca metadata dan jurnal dalam transaksi `READ ONLY`.

## Runbook operator untuk review dan persetujuan

1. **Amankan bukti dan verifikasi backup.** Pemilik staging konfirmasi host, container, identitas DB dan waktu UTC. Gunakan backup konsisten, lengkap, terenkripsi, dan diotorisasi dengan data, skema, `__drizzle_migrations`, dan checkpoint utuh. Catat asal, versi MySQL, fingerprint schema/jurnal, checksum SHA-256, cakupan tabel, dan titik pemulihan. Dump logis membutuhkan snapshot konsisten dan verifikasi engine atau window yang mencegah perubahan DDL. Simpan hasil di penyimpanan terbatas. Jangan kirim dump pelanggan atau kredensial melalui PR/chat.
2. **Restore sumber ke MySQL 8.0.46 disposable.** Verifikasi checksum dari manifest sebelum restore. Gunakan host/namespace terisolasi, volume baru, database dan akun unik, tanpa koneksi provider atau akses ke jaringan staging/production. Verifikasi server, nama schema, port dan isolation guard sebelum impor. Periksa file dump untuk `USE`, nama database fully qualified, trigger, event, routine, definer dan instruksi GTID. Jalankan import hanya di lingkungan disposable yang telah dikonfirmasi dan simpan salinan backup asli. Cek keberhasilan restore, tabel dan jumlah baris, jurnal dan checkpoint; simpan metadata dan digest tersanitasi.
3. **Analisis sumber.** Simpan perbandingan kelima baris terhadap semua 21 pasangan hash/timestamp dan cocokkan baseline dengan log perubahan historis. Jalankan pembanding kontrak pada clone read-only melalui `scripts/check-mysql-schema.ts` dengan URL clone yang sudah diperiksa. Petakan DDL dan backfill yang diperlukan dari masing-masing file, review missing signatures dan objek tambahan. Jika backup terlalu lama untuk dibandingkan dengan runtime, peroleh backup konsisten baru sebelum melanjutkan.
4. **Pilih jalur recovery di clone.** Jika tersedia backup lebih lama dengan prefix kanonik yang dapat dibuktikan **serta** jalur replay data sampai snapshot terbaru, uji pemulihan dan replay tanpa kehilangan perubahan terbaru. Jika asal histori tetap tidak dapat dibuktikan, pertahankan database sumber dan gunakan target disposable terpisah yang dibuat oleh runner versi standar dari nol. Transfer data melalui mapping kolom eksplisit, dengan urutan FK, ID/timestamp/status asli, kebijakan konflik seed yang direview serta inventaris objek legacy/managed. Jangan impor jurnal, checkpoint, atau DDL sumber ke target kanonik. Periksa collision PK/unique, orphan, perubahan collation, generated columns dan replay payment. Jangan gunakan `INSERT IGNORE` atau mengendurkan constraint agar impor lolos.
5. **Validasi dan persetujuan.** Target harus memiliki 21 pasangan kanonik, checkpoint kosong, paritas schema PASS, dan rerun runner menghasilkan `previous: 21, applied: 0`. Verifikasi per-tabel count dan digest atas kolom terpetakan, PK/FK, total/order, invoice dan attempt, reservasi/pemakaian voucher, membership dan saldo stok, komisi serta payout. Rekonsiliasi pending invoice menggunakan bukti TEST yang diotorisasi sebelum cutover terpisah. Pemilik database dan pemilik aplikasi meninjau checksum, output validasi, bukti restore, RPO/RTO, waktu cutover, serta rencana rollback. Persetujuan mereka masih **UNVERIFIED**.
6. **Stop dan rollback.** Hentikan saat target atau checksum tidak pasti, histori belum terbukti untuk jalur replay, checkpoint terisi, mapping kehilangan kolom/objek, data tidak cocok, orphan/collision, atau ada status pembayaran ambigu. Simpan log teredaksi dan clone sumber untuk investigasi; buang hanya target disposable yang sudah dipastikan dan ulangi dari backup. Jika cutover kelak diizinkan, syarat rollback adalah sumber awal masih utuh, digest aplikasi lama kompatibel, dan selisih transaksi sejak snapshot dapat diinventarisasi serta direkonsiliasi. Selama investigasi ini tidak ada cutover atau perubahan staging.

Panduan lama tentang baseline manual adalah bukti sejarah. Untuk staging ini, jangan menjalankan ulang SQL baseline, menulis ulang jurnal, `drizzle push`, atau mengabaikan verifikasi prefix.

## Bukti rehearsal dan keputusan

- Rehearsal otomatis menggunakan MySQL 8.0.46 dengan **fixture sintetis**, bukan backup staging. Fixture memuat schema yang sudah memenuhi kontrak tetapi memiliki marker lama dan empat entri berikutnya. Runner menolak source, lima baris jurnal dan data uji tetap sama. Di target terpisah, runner membangun histori kanonik dan impor fixture mempertahankan relasi user/order/voucher/grant/payment attempt/invoice/afiliasi. Tes memeriksa paritas target dan rerun tanpa migrasi tambahan.
- Rehearsal dump logis sintetis terpisah lulus verifikasi SHA-256, restore ke schema disposable kedua, perbandingan jurnal dan baris user uji, serta paritas schema. Runner tetap menolak jurnal lima baris setelah restore, sebagaimana diharapkan.
- TypeScript, ESLint terfokus, dan 24 tes terfokus lulus, termasuk suite migrasi MySQL 8.0.46.
- Ini memverifikasi desain pemulihan secara terbatas. Cakupan seluruh tabel, asal histori DDL/data staging, backup staging, mapping data nyata, dan approval operator tetap **UNVERIFIED**.

| Gate | Status |
| --- | --- |
| Gagalnya deployment karena jurnal non-prefix dan mismatch hash pertama | FAIL pada staging · akar penyebab pada level runner teridentifikasi |
| Bukti pasangan marker lengkap dan kelima baris | UNVERIFIED |
| Paritas dan checkpoint aktual staging | UNVERIFIED |
| Rehearsal sintetis MySQL 8.0.46 | PASS |
| Backup staging terverifikasi, restore clone staging, integritas data dan persetujuan operator | UNVERIFIED |
| Deployment staging | **NO-GO** |
