https://onetone.kanuraga.web.id/ ssh ubuntu@43.133.139.76 saya ini menjadi mati This page couldn’t load apa yang harus diperhatikan di perbaiki

Penyebabnya sudah teridentifikasi: bukan DNS, SSL, atau Nginx. Domain dan aplikasi masih hidup, tetapi halaman yang membaca database menghasilkan HTTP 500.

Saat deployment terakhir, proses drizzle-kit push --force mencoba menjalankan TRUNCATE users, lalu gagal karena tabel addresses memiliki foreign key ke users. Meskipun migrasi gagal, container aplikasi baru tetap dijalankan. Akibatnya, kode baru menggunakan schema database lama atau hanya terpasang sebagian.

Jangan ulangi drizzle-kit push --force, karena berisiko mengosongkan data pengguna.

Saya belum bisa masuk langsung karena SSH dari lingkungan saya ditolak (Permission denied). Jalankan pemeriksaan berikut di server:

ssh ubuntu@43.133.139.76
cd /opt/onetone-store

docker logs --tail 200 onetone-app 2>&1 | grep -E \
'Unknown column|doesn.t exist|ER_BAD_FIELD_ERROR|ER_NO_SUCH_TABLE|Error'

Kemudian cek status migration 0012–0015:

docker exec onetone-db sh -c 'mysql \
-u"$MYSQL_USER" \
-p"$MYSQL_PASSWORD" \
"$MYSQL_DATABASE" \
-N -e "
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = '\''product_images'\''
     AND column_name = '\''variant_id'\'') AS product_images_variant_id,

  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = '\''products'\''
     AND column_name = '\''sale_channel'\'') AS products_sale_channel,

  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = '\''order_items'\''
     AND column_name = '\''manual_discount_amount'\'') AS manual_discount_amount,

  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = '\''inventory_receipts'\'') AS inventory_receipts,

  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = '\''user_inventory_locations'\'') AS user_inventory_locations;

SELECT column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = '\''users'\''
  AND column_name = '\''role'\'';

SELECT column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = '\''inventory_movements'\''
  AND column_name = '\''movement_type'\'';
"'

Arti lima angka pada baris pertama:

1 1 1 1 1: struktur utama sudah ada; perlu melihat error log lain.
Ada nilai 0: migration belum lengkap.
Campuran 0 dan 1: deployment meninggalkan schema parsial; migration harus diterapkan selektif.

Sebelum memperbaiki schema, buat backup:

mkdir -p backups
backup_file="backups/before-schema-repair-$(date +%Y%m%d-%H%M%S).sql"

docker exec onetone-db sh -c \
'exec mysqldump --no-tablespaces --single-transaction --quick \
-u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
> "$backup_file"

test -s "$backup_file" &&
grep -q "Dump completed" "$backup_file" &&
chmod 600 "$backup_file" &&
ls -lh "$backup_file"

Peringatan password pada command line dari mysqldump normal. Hasil akhirnya harus memperlihatkan file tidak kosong dan tidak ada pesan error.

Kirimkan output dari docker logs dan pemeriksaan migration di atas. Setelah diketahui kolom/tabel mana yang belum ada, saya akan memberikan perintah migration selektif yang aman tanpa menyentuh data users. Pipeline deployment juga perlu diperbaiki agar migration gagal otomatis menghentikan deployment dan tidak lagi memakai push --force.


ubuntu@VM-7-242-ubuntu:~$ docker logs --tail 200 onetone-app 2>&1 | grep -E \
'Unknown column|doesn.t exist|ER_BAD_FIELD_ERROR|ER_NO_SUCH_TABLE|Error'
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
⨯ Error: Unknown column 'products.sale_channel' in 'field list'
  code: 'ER_BAD_FIELD_ERROR',
  sqlMessage: "Unknown column 'products.sale_channel' in 'field list'",
ubuntu@VM-7-242-ubuntu:~$ docker exec onetone-db sh -c 'mysql \
-u"$MYSQL_USER" \
-p"$MYSQL_PASSWORD" \
"$MYSQL_DATABASE" \
-N -e "
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = '\''product_images'\''
     AND column_name = '\''variant_id'\'') AS product_images_variant_id,

  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = '\''products'\''
     AND column_name = '\''sale_channel'\'') AS products_sale_channel,

  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = '\''order_items'\''
     AND column_name = '\''manual_discount_amount'\'') AS manual_discount_amount,

  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = '\''inventory_receipts'\'') AS inventory_receipts,

  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = '\''user_inventory_locations'\'') AS user_inventory_locations;

SELECT column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = '\''users'\''
  AND column_name = '\''role'\'';

SELECT column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = '\''inventory_movements'\''
  AND column_name = '\''movement_type'\'';
"'
mysql: [Warning] Using a password on the command line interface can be insecure.
0	0	0	0	0
enum('customer','admin','cashier')
ubuntu@VM-7-242-ubuntu:~$ mkdir -p backups
backup_file="backups/before-schema-repair-$(date +%Y%m%d-%H%M%S).sql"
ubuntu@VM-7-242-ubuntu:~$ docker exec onetone-db sh -c \
'exec mysqldump --no-tablespaces --single-transaction --quick \
-u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
> "$backup_file"

test -s "$backup_file" &&
grep -q "Dump completed" "$backup_file" &&
chmod 600 "$backup_file" &&
ls -lh "$backup_file"
mysqldump: [Warning] Using a password on the command line interface can be insecure.
-rw------- 1 ubuntu ubuntu 108K Sep 29 08:51 backups/before-schema-repair-20260929-084904.sql
 ini log nya


Backup berhasil dan lengkap. Hasil 0 0 0 0 0 menunjukkan migration 0012–0015 belum diterapkan sama sekali, sehingga relatif aman menjalankan empat migration versioned tersebut secara berurutan.

Error utama saat ini adalah migration 0013 yang belum menambahkan products.sale_channel.

### 1. Ambil file migration dari image terbaru

Jalankan di server:

mkdir -p /tmp/onetone-schema-repair

docker cp silly_babbage:/app/lib/db/migrations/0012_product_image_variants.sql \
/tmp/onetone-schema-repair/0012_product_image_variants.sql

docker cp silly_babbage:/app/lib/db/migrations/0013_pos_promotional_pricing.sql \
/tmp/onetone-schema-repair/0013_pos_promotional_pricing.sql

docker cp silly_babbage:/app/lib/db/migrations/0014_inventory_receipt_scanning.sql \
/tmp/onetone-schema-repair/0014_inventory_receipt_scanning.sql

docker cp silly_babbage:/app/lib/db/migrations/0015_inventory_staff_access.sql \
/tmp/onetone-schema-repair/0015_inventory_staff_access.sql

Pastikan semuanya tersedia:

ls -lh /tmp/onetone-schema-repair

Harus terlihat empat file SQL.

### 2. Terapkan migration secara berurutan

Jalankan satu per satu. Jangan lanjut ke migration berikutnya jika ada error.

docker exec -i onetone-db sh -c \
'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
< /tmp/onetone-schema-repair/0012_product_image_variants.sql

docker exec -i onetone-db sh -c \
'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
< /tmp/onetone-schema-repair/0013_pos_promotional_pricing.sql

Migration 0013 seharusnya langsung mengatasi error products.sale_channel.

Lanjutkan:

docker exec -i onetone-db sh -c \
'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
< /tmp/onetone-schema-repair/0014_inventory_receipt_scanning.sql

docker exec -i onetone-db sh -c \
'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
< /tmp/onetone-schema-repair/0015_inventory_staff_access.sql

Peringatan password dari MySQL boleh diabaikan. Yang tidak boleh muncul adalah ERROR.

### 3. Verifikasi hasil migration

docker exec onetone-db sh -c 'mysql \
-u"$MYSQL_USER" \
-p"$MYSQL_PASSWORD" \
"$MYSQL_DATABASE" \
-N -e "
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = '\''product_images'\''
     AND column_name = '\''variant_id'\''),

  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = '\''products'\''
     AND column_name = '\''sale_channel'\''),

  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = '\''order_items'\''
     AND column_name = '\''manual_discount_amount'\''),

  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = '\''inventory_receipts'\''),

  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = '\''user_inventory_locations'\'');

SELECT column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = '\''users'\''
  AND column_name = '\''role'\'';

SELECT column_type
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = '\''inventory_movements'\''
  AND column_name = '\''type'\'';
"'

Hasil yang diharapkan:

1  1  1  1  1
enum('customer','admin','cashier','inventory_staff')
enum('opening_balance','receipt','online_sale','pos_sale','return','transfer_in','transfer_out','adjustment')

### 4. Restart aplikasi

docker restart onetone-app

Tunggu beberapa detik, kemudian periksa:

docker logs --since 2m onetone-app 2>&1 | tail -100

Uji respons:

curl -I https://onetone.kanuraga.web.id/
curl -I https://onetone.kanuraga.web.id/products

Targetnya HTTP 200, bukan 500.

Jangan jalankan ulang workflow deployment dahulu. Pipeline masih memiliki masalah: kegagalan drizzle-kit push --force tidak menghentikan pergantian container aplikasi. Setelah situs pulih, pipeline perlu diperbaiki supaya memakai migration versioned dan deployment otomatis berhenti jika migration gagal.



ubuntu@VM-7-242-ubuntu:~$ mkdir -p /tmp/onetone-schema-repair
ubuntu@VM-7-242-ubuntu:~$ docker cp silly_babbage:/app/lib/db/migrations/0012_product_image_variants.sql \
/tmp/onetone-schema-repair/0012_product_image_variants.sql
Error response from daemon: No such container: silly_babbage
ubuntu@VM-7-242-ubuntu:~$ docker cp silly_babbage:/app/lib/db/migrations/0013_pos_promotional_pricing.sql \
/tmp/onetone-schema-repair/0013_pos_promotional_pricing.sql
Error response from daemon: No such container: silly_babbage
ubuntu@VM-7-242-ubuntu:~$ docker cp silly_babbage:/app/lib/db/migrations/0014_inventory_receipt_scanning.sql \
/tmp/onetone-schema-repair/0014_inventory_receipt_scanning.sql

docker cp silly_babbage:/app/lib/db/migrations/0015_inventory_staff_access.sql \
/tmp/onetone-schema-repair/0015_inventory_staff_access.sql
Error response from daemon: No such container: silly_babbage
Error response from daemon: No such container: silly_babbage
ubuntu@VM-7-242-ubuntu:~$ ls -lh /tmp/onetone-schema-repair
total 0
ubuntu@VM-7-242-ubuntu:~$

Container silly_babbage sudah tidak ada—kemungkinan container migration sementara sudah dihentikan/dihapus. Image migration masih tersedia, jadi buat container pasif khusus untuk mengambil file. Container ini tidak akan menjalankan migration.

Jalankan:

docker create \
  --name onetone-schema-source \
  ghcr.io/one2pret/onetone-store:latest-migrate

Lalu salin migration:

docker cp onetone-schema-source:/app/lib/db/migrations/0012_product_image_variants.sql \
/tmp/onetone-schema-repair/0012_product_image_variants.sql

docker cp onetone-schema-source:/app/lib/db/migrations/0013_pos_promotional_pricing.sql \
/tmp/onetone-schema-repair/0013_pos_promotional_pricing.sql

docker cp onetone-schema-source:/app/lib/db/migrations/0014_inventory_receipt_scanning.sql \
/tmp/onetone-schema-repair/0014_inventory_receipt_scanning.sql

docker cp onetone-schema-source:/app/lib/db/migrations/0015_inventory_staff_access.sql \
/tmp/onetone-schema-repair/0015_inventory_staff_access.sql

Verifikasi:

ls -lh /tmp/onetone-schema-repair

Jika empat file sudah terlihat, hapus container pasifnya:

docker rm onetone-schema-source

Setelah itu jalankan migration pertama:

docker exec -i onetone-db sh -c \
'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
< /tmp/onetone-schema-repair/0012_product_image_variants.sql

Jika tidak ada ERROR, lanjutkan:

docker exec -i onetone-db sh -c \
'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
< /tmp/onetone-schema-repair/0013_pos_promotional_pricing.sql

docker exec -i onetone-db sh -c \
'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
< /tmp/onetone-schema-repair/0014_inventory_receipt_scanning.sql

docker exec -i onetone-db sh -c \
'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
< /tmp/onetone-schema-repair/0015_inventory_staff_access.sql

Hentikan dan kirim output apabila salah satu perintah menampilkan ERROR; jangan mengulang migration yang sudah berhasil.
  07:55

ubuntu@VM-7-242-ubuntu:~$ docker rm onetone-schema-source
onetone-schema-source
ubuntu@VM-7-242-ubuntu:~$ docker exec -i onetone-db sh -c \
'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
< /tmp/onetone-schema-repair/0012_product_image_variants.sql
mysql: [Warning] Using a password on the command line interface can be insecure.
ubuntu@VM-7-242-ubuntu:~$ docker exec -i onetone-db sh -c \
'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
< /tmp/onetone-schema-repair/0013_pos_promotional_pricing.sql

docker exec -i onetone-db sh -c \
'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
< /tmp/onetone-schema-repair/0014_inventory_receipt_scanning.sql

docker exec -i onetone-db sh -c \
'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' \
< /tmp/onetone-schema-repair/0015_inventory_staff_access.sql
mysql: [Warning] Using a password on the command line interface can be insecure.
mysql: [Warning] Using a password on the command line interface can be insecure.
mysql: [Warning] Using a password on the command line interface can be insecure.
ubuntu@VM-7-242-ubuntu:~$

Semua migration berhasil diterapkan. Hanya ada warning penggunaan password, tanpa ERROR.

Sekarang verifikasi schema:

docker exec onetone-db sh -c 'mysql \
-u"$MYSQL_USER" \
-p"$MYSQL_PASSWORD" \
"$MYSQL_DATABASE" \
-N -e "
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = '\''product_images'\''
     AND column_name = '\''variant_id'\''),

  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = '\''products'\''
     AND column_name = '\''sale_channel'\''),

  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = '\''order_items'\''
     AND column_name = '\''manual_discount_amount'\''),

  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = '\''inventory_receipts'\''),

  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = '\''user_inventory_locations'\'');
"'

Hasilnya harus:

1	1	1	1	1

Kemudian restart aplikasi:

docker restart onetone-app

Tunggu sekitar 10–15 detik, lalu periksa:

docker logs --since 2m onetone-app 2>&1 | tail -100

Tes endpoint:

curl -sS -o /dev/null -w "Homepage: %{http_code}\n" \
https://onetone.kanuraga.web.id/

curl -sS -o /dev/null -w "Products: %{http_code}\n" \
https://onetone.kanuraga.web.id/products

curl -sS -o /dev/null -w "API products: %{http_code}\n" \
https://onetone.kanuraga.web.id/api/products

Homepage dan products seharusnya 200. Setelah server pulih, langkah berikutnya adalah memperbaiki workflow deployment agar kegagalan migration menghentikan deployment dan tidak lagi mencoba drizzle-kit push --force.

