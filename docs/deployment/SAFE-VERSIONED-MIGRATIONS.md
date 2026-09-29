# Deployment database yang aman

## Aturan utama

- Server testing dan production menggunakan SQL versioned di `lib/db/migrations`.
- Migrator menjalankan `drizzle-kit migrate`, bukan `drizzle-kit push --force`.
- Backup database wajib dibuat dan diverifikasi sebelum migration production.
- Container aplikasi baru hanya diaktifkan setelah migrator selesai dengan exit code 0.
- Jangan mengulang migration SQL manual yang sudah berhasil.

## Baseline database lama sampai migration 0015

Database lama awalnya dikelola dengan `drizzle-kit push`, sehingga belum mempunyai
histori `__drizzle_migrations`. Setelah memastikan perubahan `0000` sampai `0015`
sudah benar-benar tersedia, catat baseline berikut satu kali:

```sql
CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (
  `id` serial PRIMARY KEY,
  `hash` text NOT NULL,
  `created_at` bigint
);

INSERT INTO `__drizzle_migrations` (`hash`, `created_at`)
SELECT 'baseline-manual-through-0015', 1790704800000
WHERE NOT EXISTS (
  SELECT 1
  FROM `__drizzle_migrations`
  WHERE `created_at` >= 1790704800000
);
```

Jangan membuat baseline sebelum memverifikasi semua struktur sampai `0015`. Baseline
hanya mencatat keadaan database; perintah tersebut tidak membuat kolom atau tabel.

## Checklist sebelum merge production

1. Pastikan testing sehat dan migration `0012` sampai `0015` sudah terpasang.
2. Catat baseline `0015` pada testing.
3. Buat dan verifikasi backup production.
4. Periksa apakah struktur `0012` sampai `0015` sudah tersedia di production.
5. Jika belum, terapkan SQL `0012`, `0013`, `0014`, lalu `0015` secara berurutan.
6. Verifikasi struktur dan catat baseline `0015` pada production.
7. Merge ke branch `production`.
8. Pantau job migrator. Jangan melanjutkan secara manual jika migrator gagal.
9. Uji homepage, katalog, login, dashboard, POS, dan inventori.

## Pemulihan error schema setelah deploy

Jika aplikasi baru menampilkan `Unknown column`:

1. Periksa log aplikasi untuk nama kolom atau tabel yang hilang.
2. Jangan jalankan `drizzle-kit push --force`.
3. Pastikan backup terakhir valid.
4. Cocokkan schema dengan migration versioned.
5. Terapkan hanya migration yang belum terpasang.
6. Verifikasi schema, restart aplikasi, lalu periksa endpoint penting.

Restore backup adalah langkah terakhir dan harus dilakukan hanya setelah penyebab serta
dampaknya dipahami, karena restore dapat menimpa transaksi yang masuk setelah backup.
