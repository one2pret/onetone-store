# ONETONE — Release Gate v0.8

**NO-GO untuk staging dan produksi sampai CI dan paritas runtime pada salinan staging terverifikasi.** Paritas skema lokal lulus pada MySQL 8.0.46 disposable. Lifecycle voucher tidak berubah.

Baseline `77fe60c710148bbe4ea4cb64e1b40127a514834d`. Branch `feature/schema-parity-release-gate-v08` menargetkan `feature/atomic-voucher-checkout-v01` dan mencakup commit v0.6 serta v0.7 yang belum masuk ke target saat pekerjaan dimulai.

## Inventory dan dampak runtime

| Pemeriksaan kontrak | Sebelum 0020 | Setelah 0020 |
| --- | ---: | ---: |
| Definisi kolom yang kurang | 111 | 0 |
| Signature indeks yang kurang | 26 | 0 |
| Signature foreign key yang kurang | 16 | 0 |
| CHECK constraint ledger yang kurang | 0 | 0 |

- **Required.** Tambah `users.birthdate`, `products.channel`, `categories.sort_order`, `categories.is_visible`, dan empat kolom afiliasi order. Query katalog, ekspor anggota, checkout, dan pembacaan order sudah memiliki dependensi pada objek tersebut.
- **Fitur opsional.** Afiliasi tetap opsional secara konfigurasi bisnis. Ketujuh tabel afiliasi wajib tersedia karena model dan query aplikasi sudah dikirim bersama runtime. Migrasi tidak mengaktifkan fitur, membuat akun afiliasi, atau mengisi pengaturan baru.
- **Legacy-only atau kompatibel.** `CHAR(64)` untuk hash attempt dan dua diskon item yang lebih ketat `NOT NULL` diterima secara eksplisit. Default timestamp `now()` dan `CURRENT_TIMESTAMP` setara pada versi MySQL yang dilatih. Tidak ada perubahan tipe atau rewrite data pada kolom ini. Dua CHECK ledger yang berasal dari histori SQL tetap diwajibkan.
- **Managed dan tidak diketahui.** Jurnal Drizzle dan checkpoint runner merupakan metadata internal. Objek staging yang tidak terlihat dalam disposable fixture belum diklasifikasikan. Gate mempertahankan objek ekstra dan memeriksa kontrak objek required, sehingga operator dapat meninjau drift eksternal tanpa penghapusan otomatis.

[Inventaris machine-readable sebelum migrasi](./mysql-schema-inventory-v08.json) · [Kontrak runtime](../../lib/db/mysql-runtime-schema.json)

## Migrasi dan gate

`0020_runtime_schema_parity.sql` adalah migrasi maju additive. File SQL historis tidak diubah dan journal menambah satu entri. Tabel yang belum ada dibuat. Kolom yang belum ada ditambah dengan default model. Foreign key ditambahkan jika asosiasi kolom belum ada. Indeks pendukung FK dibuat MySQL jika diperlukan. Jika objek sudah ada, periksa definisi dan datanya melalui gate. Gate membandingkan tipe, nullability, default, primary/unique index, urutan kolom indeks, target dan aksi FK, serta CHECK constraint ledger. Foreign key dan indeks dengan nama berbeda diterima bila signature setara.

Definisi yang berbeda, foreign key dengan aksi yang tidak cocok, atau data yatim memerlukan migrasi korektif yang ditinjau. Gate menolak promosi bila kontrak belum terpenuhi. Runner menyimpan checkpoint jika DDL gagal, termasuk bila penambahan FK gagal karena data yatim. Jika DDL selesai dan gate menemukan drift yang sudah ada, jurnal tetap menunjukkan 0020 applied dan deploy harus berhenti sampai penyebab gate FAIL diperbaiki.

CI membangun skema model Drizzle di fixture terpisah, memeriksa bahwa kontrak mencakup model, lalu menguji skema hasil migrasi terhadap kontrak. Fixture juga membuktikan gate mendeteksi indeks unik ledger poin yang sengaja dihapus. CLI migrator menjalankan pemeriksaan yang sama sebelum exit sukses.

Untuk pemeriksaan read-only, operator menyediakan `DATABASE_URL` dari kanal staging yang berwenang untuk target yang telah diverifikasi, kemudian menjalankan:

```bash
./node_modules/.bin/tsx scripts/check-mysql-schema.ts
```

Exit 0 berarti kontrak tersedia, 1 berarti drift, dan 2 berarti bukti tidak dapat diperoleh. Gate tidak menjamin data operasional maupun detail di luar kontrak seperti collation dan tuning server. Cocokkan jurnal, digest runtime dan UAT secara terpisah.

## Regresi dan pemulihan

- Fresh migration, upgrade populated dengan sebagian objek 0020 sudah ada, rerun, dan interupsi fail-closed lulus pada MySQL 8.0.46 disposable.
- Restore dump populated saat jurnal masih di 0019, lalu terapkan 0020. Gate lulus dengan 21 jurnal dan fixture tetap `fixture-item / 15000.00 / 4`. Default channel, sort order, dan visibility tersedia. SHA-256 dump disposable `d6f5642f4135b4728c77b9e89db199d6dae8864299009091b1c207161f064ebc`.
- Pengujian voucher dan checkout legacy memakai provider mock dan database lokal. Staging, database live, pembayaran LIVE, dan shipping live berada di luar eksekusi tes ini.

Jika 0020 terputus, hentikan migrator, simpan checkpoint dan bukti, lalu restore backup sebelum migrasi ke target terisolasi. Cocokkan ulang data dan jurnal sebelum menjalankan retry. Jika rollback aplikasi diperlukan setelah migrasi berhasil, uji image lama terhadap skema additive di salinan disposable. Pertahankan data afiliasi, voucher, stok, dan ledger. Revert kode saja tidak menghapus perubahan DDL.

Produksi tetap **NO-GO** hingga CI commit integrasi lulus, salinan staging populated lulus journal dan schema gate, preflight menunjukkan runtime yang cocok, dan UAT staging disetujui serta tercatat.
