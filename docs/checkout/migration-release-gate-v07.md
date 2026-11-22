# Release Gate v0.7

**NO-GO produksi.** Runner baru menyelesaikan histori migrasi pada MySQL lokal. Skema hasil migrasi masih memiliki drift terhadap model aplikasi dan preflight staging belum dijalankan pada runtime yang diotorisasi.

## Reproduksi dan akar masalah

Baseline fitur `8c8e3aae9e7d219e8acbc525d095cfb21c4dcfbd`. MySQL lokal `8.0.46`. Urutan jurnal adalah `0000_thin_doctor_doom`, lalu `0001_product_scheduled_pricing`. Migrator lama gagal dengan `ER_PARSE_ERROR`, errno `1064`, SQLSTATE `42000`.

```text
You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'ALTER TABLE `product_variants`
  ADD COLUMN `sale_price_override` decimal(12,2) ' at line 6
```

Statement yang dikirim oleh migrator lama:

```sql
ALTER TABLE `products`
  ADD COLUMN `sale_price` decimal(12,2) NULL AFTER `price`,
  ADD COLUMN `sale_starts_at` timestamp NULL AFTER `sale_price`,
  ADD COLUMN `sale_ends_at` timestamp NULL AFTER `sale_starts_at`;

ALTER TABLE `product_variants`
  ADD COLUMN `sale_price_override` decimal(12,2) NULL AFTER `price_modifier`;

ALTER TABLE `order_items`
  ADD COLUMN `regular_price` decimal(12,2) NULL AFTER `price`,
  ADD COLUMN `product_discount_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `regular_price`;
```

`0000` menyediakan tabel dan kolom yang dirujuk ketiga ALTER. Migrator Drizzle memecah file berdasarkan marker `--> statement-breakpoint`. File `0001` tidak memiliki marker sehingga ketiga ALTER dikirim bersama pada koneksi yang hanya menerima satu statement. Runner baru berhasil menjalankan file SQL yang sama pada server dan akun lokal yang sama. Bukti tersebut mengisolasi masalah pada eksekusi batch oleh runner.

## Kompatibilitas dan pemulihan

- `scripts/mysql-migrations.ts` tetap memakai bentuk jurnal dan hash Drizzle dari byte file asli. SQL historis dan timestamp tidak diubah. Batch hanya diizinkan pada koneksi terpisah yang menjalankan SQL statis repository.
- Database lama harus memiliki jurnal yang merupakan prefix hash dan timestamp yang cocok. Database populated tanpa jurnal, jurnal yang berbeda, dan checkpoint interupsi ditolak. Rehearsal staging diperlukan bila instalasi lama pernah memakai baselining atau schema push.
- Lock MySQL mencegah dua runner baru berjalan bersama dalam database yang sama. Jalankan satu versi migrator melalui window deploy yang terkoordinasi, karena runner lama tidak menggunakan lock ini.
- Checkpoint dicatat sebelum SQL. MySQL dapat meng-commit DDL sebelum kegagalan, sehingga retry otomatis ditolak jika checkpoint masih ada. Simpan bukti, restore backup pre-migration di target disposable, verifikasi prefix dan data, lalu ulangi migrasi di target itu. Penghapusan checkpoint adalah tindakan rekonsiliasi manual yang memerlukan review DDL dan jurnal.
- Setelah SQL berhasil, pencatatan jurnal dan penghapusan checkpoint dilakukan dalam satu transaksi InnoDB. `Dockerfile` memakai CLI baru pada target migrator. Kode settlement voucher tidak diubah.

## Bukti lokal

| Pemeriksaan | Hasil |
| --- | --- |
| Fresh dan rerun | PASS. 20 migrasi diterapkan dari database kosong, dan 0 pada rerun. Hash serta timestamp jurnal cocok. |
| Upgrade populated | PASS. Journal prefix dalam format lama diterima dan fixture produk, harga, serta stok dipertahankan. |
| Interupsi | PASS untuk fail-closed. DDL simulasi diterapkan sebelum kegagalan, checkpoint dipertahankan, dan rerun diblokir. Prefix bersih dapat diteruskan. |
| Schema checkout terpilih | PASS. Kolom harga promo, snapshot berat, status attempt dan unique index voucher/poin/payment yang diperiksa tersedia. |
| Paritas kolom seluruh aplikasi | FAIL. Pemeriksaan `information_schema` menemukan tabel `affiliates`, `affiliate_links`, `affiliate_clicks`, `affiliate_commissions`, `affiliate_payouts`, `affiliate_settings`, serta `commission_rules` belum dibentuk oleh versi historis. Kolom `categories.sort_order`, `categories.is_visible`, `users.birthdate`, `products.channel`, serta empat kolom afiliasi order juga belum tersedia. |
| Backup, restore, kemudian migrate | PASS lokal. Dump database populated berisi jurnal `0000` dipulihkan ke database disposable kedua. 19 migrasi berikutnya diterapkan dan data fixture tetap `fixture / 15000.00 / 4`. SHA-256 dump uji `1fddff5302e1249fffaf6a0d4ca6486f62f976f41ccfb5eed80a20a9964732ad`. |

## Preflight staging read-only

Operator menjalankan perintah dari checkout yang ditinjau dengan akses Docker staging yang sudah diotorisasi. Gunakan digest registry dan SHA dari artefak build yang disetujui. ID order TEST opsional hanya untuk fixture yang sudah disetujui.

```bash
./node_modules/.bin/tsx scripts/staging-readonly-preflight.ts \
  CONTAINER APPROVED_GIT_SHA APPROVED_IMAGE_DIGEST [APPROVED_TEST_ORDER_ID]
```

Output berupa JSON per pemeriksaan dengan status `PASS`, `FAIL`, atau `UNVERIFIED`. Exit `1` menandakan ada kegagalan, `3` menandakan bukti belum lengkap, dan `2` menandakan argumen tidak valid. Script membaca label revisi, registry digest, klasifikasi runtime, mode kunci berdasarkan prefix, flag, jurnal, checkpoint, keberadaan kolom ORM, dan rincian attempt TEST jika diminta. Probe log hanya mencetak jumlah event dari daftar yang ditentukan. Kehadiran log atau token konfigurasi masih membutuhkan bukti redaksi dan pengiriman callback dari operator.

**Status staging saat laporan dibuat adalah UNVERIFIED** untuk SHA, digest, lingkungan, mode pembayaran, flag, koneksi DB, jurnal/skema, webhook, dan observabilitas. Smoke test menggunakan container yang tidak ada menghasilkan UNVERIFIED dan exit 3. CI khusus migrasi ditambahkan pada workflow PR yang ada. Hasil CI pada head baru memerlukan PR dan run yang terverifikasi.

## Gate dan rollback

Tutup drift dengan migrasi maju yang ditinjau untuk instalasi kosong maupun database yang sudah memiliki sebagian objek. Verifikasi tipe, constraint, index, dan perilaku aplikasi setelah perbaikan. Lanjutkan rehearsal restore dan upgrade dari salinan staging yang disetujui, lalu kumpulkan preflight dan UAT yang diotorisasi. Produksi tetap **NO-GO** hingga seluruh bukti itu tersedia.

Untuk rollback, hentikan migrator dan pertahankan checkpoint serta bukti SQL. Pulihkan backup sebelum migrasi ke target terisolasi dan cocokkan jurnal, data, dan digest aplikasi terakhir yang diketahui baik. Jika tidak ada perubahan database, rollback kode dengan revert commit fitur. Bila DDL sudah berjalan, penggantian image saja tidak mengembalikan skema. Pertahankan data invoice, grant, stok, dan ledger untuk rekonsiliasi sebelum promosi ulang.
