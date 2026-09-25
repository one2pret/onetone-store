# Runbook Rilis POS, Inventory, Voucher, dan Harga Promo

Dokumen ini adalah gerbang operasional untuk perubahan schema `0001` sampai
`0008`. Jalankan ke **testing terlebih dahulu**. Jangan langsung mendorong branch
`production` sebelum seluruh pemeriksaan testing dinyatakan lulus.

## Fakta mekanisme deploy saat ini

- Push ke `main` memicu deploy testing; push ke `production` memicu deploy production.
- Image migrator menjalankan `drizzle-kit push --force`, bukan SQL versioned lewat
  `drizzle migrate`.
- `push` menyelaraskan struktur schema, tetapi tidak menjalankan perintah data dalam
  migration SQL. Karena itu pembuatan `WELCOME5000`, lokasi default, salinan stok
  lama, dan opening balance wajib diverifikasi secara terpisah.
- Workflow sekarang mengaktifkan image aplikasi baru hanya setelah migrator sukses.
  Jika migrator gagal, `set -e` menghentikan deploy dan aplikasi lama tetap aktif.

## Perubahan schema yang diharapkan

| Migration | Perubahan utama | Pemeriksaan data |
| --- | --- | --- |
| `0001` | Harga promo terjadwal dan snapshot diskon item | Kolom harga tersedia |
| `0002` | Voucher pengguna baru dan `user_vouchers` | Campaign `WELCOME5000` tersedia bila memang diaktifkan bisnis |
| `0003` | Nama, deskripsi, dan arsip voucher | Voucher lama mempunyai nama yang masuk akal |
| `0004` | Lokasi, saldo, mutasi inventory, serta lokasi sesi POS | `ONLINE-UTAMA`, `POS-UTAMA`, dan saldo awal tersedia tepat sekali |
| `0005` | Ledger transfer inventory | Tabel dan foreign key tersedia |
| `0006` | Nama POS, label varian, barcode | Barcode unik secara global |
| `0007` | Retur/refund POS dan item retur | Tabel serta foreign key tersedia |
| `0008` | Nama kasir yang ditampilkan pada sesi POS | Kolom tersedia |

## Gerbang sebelum push ke `main`

1. Pastikan working tree hanya berisi perubahan rilis yang memang akan dikirim.
2. Pastikan `pnpm test:run`, `pnpm exec tsc --noEmit`, dan `pnpm build` lulus.
3. Buat backup database testing yang dapat direstore. Catat lokasi, waktu, ukuran,
   dan checksum backup tanpa menaruh kredensial atau isi data pelanggan di log.
4. Jalankan pemeriksaan read-only berikut pada database testing:

```sql
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'user_vouchers', 'inventory_locations', 'inventory_balances',
    'inventory_movements', 'inventory_transfers', 'product_barcodes',
    'pos_returns', 'pos_return_items'
  )
ORDER BY TABLE_NAME;

SELECT TABLE_NAME, COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'products' AND COLUMN_NAME IN ('sale_price','sale_starts_at','sale_ends_at','pos_name'))
    OR (TABLE_NAME = 'product_variants' AND COLUMN_NAME IN ('sale_price_override','pos_label'))
    OR (TABLE_NAME = 'order_items' AND COLUMN_NAME IN ('regular_price','product_discount_amount'))
    OR (TABLE_NAME = 'pos_sessions' AND COLUMN_NAME IN ('location_id','assigned_cashier_name'))
  )
ORDER BY TABLE_NAME, COLUMN_NAME;

SELECT code, type, is_online_default, is_active
FROM inventory_locations
ORDER BY id;

SELECT code, is_active, voucher_audience, valid_days_after_grant,
       max_uses_per_user, first_order_only
FROM vouchers
WHERE code IN ('WELCOME10', 'WELCOME5000');
```

Jika tabel belum ada, query data terhadap tabel tersebut tentu akan gagal; itu
berarti database masih berada pada baseline lama dan harus melalui migrator dahulu.

## Urutan deploy testing

1. Push branch fitur ini ke `main` melalui merge/review yang terkontrol.
2. Pantau job build image aplikasi dan migrator sampai sukses.
3. Pastikan step migrator sukses **sebelum** container aplikasi baru diperbarui.
4. Ulangi query `information_schema` di atas.
5. Karena pipeline memakai schema push, verifikasi secara eksplisit bahwa data yang
   seharusnya berasal dari migration `0002` dan `0004` benar-benar ada.
6. Bila lokasi default atau saldo awal belum ada, jangan membuatnya berulang kali.
   Bandingkan stok lama `products.stock`/`product_variants.stock` dengan
   `inventory_balances`, lalu jalankan backfill terkontrol satu kali setelah backup.
7. Jangan meneruskan ke production bila terdapat lebih dari satu lokasi online
   default, duplikasi saldo, atau total stok awal tidak cocok.

Query rekonsiliasi read-only:

```sql
SELECT COUNT(*) AS online_default_count
FROM inventory_locations
WHERE is_online_default = true AND is_active = true;

SELECT location_id, product_id, COALESCE(variant_id, 0) AS variant_key,
       COUNT(*) AS row_count
FROM inventory_balances
GROUP BY location_id, product_id, COALESCE(variant_id, 0)
HAVING COUNT(*) > 1;

SELECT p.id, p.stock AS legacy_stock, COALESCE(b.quantity, 0) AS online_stock
FROM products p
LEFT JOIN inventory_locations l ON l.is_online_default = true AND l.is_active = true
LEFT JOIN inventory_balances b
  ON b.location_id = l.id AND b.product_id = p.id AND b.variant_id IS NULL
WHERE p.stock <> COALESCE(b.quantity, 0);

SELECT v.id, v.stock AS legacy_stock, COALESCE(b.quantity, 0) AS online_stock
FROM product_variants v
LEFT JOIN inventory_locations l ON l.is_online_default = true AND l.is_active = true
LEFT JOIN inventory_balances b
  ON b.location_id = l.id AND b.variant_id = v.id
WHERE v.stock <> COALESCE(b.quantity, 0);
```

## Smoke test testing

- Login admin dan kasir dengan akun berbeda.
- Buka dua sesi kasir pada akun/lokasi yang sesuai dan pastikan transaksi tidak
  tercampur.
- Pastikan POS hanya menampilkan stok lokasi yang dipilih.
- Lakukan transfer satu SKU dalam jumlah kecil; cocokkan saldo sumber, tujuan, dan
  dua baris mutasi.
- Lakukan transaksi tunai kecil, lalu retur parsial; cocokkan refund, restock, dan
  Z-report.
- Pastikan diskon kasir ditolak ketika melewati batas.
- Pastikan harga promo konsisten di produk, cart, checkout, dan snapshot order.
- Daftarkan satu akun uji baru; pastikan voucher welcome diberikan sekali dan tidak
  bentrok dengan membership.
- Nonaktifkan voucher dari admin dan pastikan voucher tidak dapat dipakai pada order
  baru.
- Periksa log aplikasi tanpa menyalin secret atau data pelanggan.

## Gerbang production

Production hanya boleh dilanjutkan bila:

- backup testing dan prosedur restore telah diuji;
- seluruh smoke test testing lulus;
- hasil rekonsiliasi stok kosong atau sudah dijelaskan;
- tidak ada duplikasi lokasi default/saldo/barcode;
- backup production terbaru telah dibuat dan diverifikasi;
- periode deploy disetujui karena DDL MySQL dapat menahan lock;
- ada operator yang dapat memantau aplikasi, database, payment webhook, dan order
  selama deploy.

## Urutan production dan rollback

1. Catat image/commit production yang sedang aktif.
2. Buat dan verifikasi backup production.
3. Merge commit testing yang sudah lulus ke `production`; jangan membuat perubahan
   tambahan langsung di branch production.
4. Pantau migration lalu pergantian container aplikasi.
5. Jalankan query schema, rekonsiliasi stok, dan smoke test minimum kembali.
6. Jika aplikasi baru gagal tetapi schema additive sudah sukses, rollback image
   aplikasi ke tag/digest sebelumnya. Jangan menghapus kolom/tabel secara spontan.
7. Jika integritas data berubah, hentikan transaksi baru dan gunakan prosedur restore
   yang telah diuji. Jangan mencoba `DROP`, reverse migration, atau restore tanpa
   persetujuan eksplisit dan penilaian data yang masuk setelah backup.

## Risiko yang masih harus diselesaikan

- `drizzle-kit push --force` tidak memberi histori migration versioned dan dapat
  menerapkan drift yang tidak terlihat dalam SQL `0001`–`0008`.
- Baseline testing dan production belum diketahui dari repository saja.
- Migrasi ke `drizzle migrate` tidak boleh dilakukan langsung pada database yang
  sebelumnya dikelola dengan `push`; histori harus dibaseline lebih dulu agar
  migration `0000` tidak mencoba membuat ulang tabel yang sudah ada.
- Backfill data `0002` dan `0004` perlu dipastikan satu kali dan idempotent sebelum
  otomatisasi migration dianggap tuntas.
