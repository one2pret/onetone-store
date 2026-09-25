ALTER TABLE `vouchers`
  ADD COLUMN `name` varchar(120) NULL AFTER `code`,
  ADD COLUMN `description` text NULL AFTER `name`,
  ADD COLUMN `archived_at` timestamp NULL AFTER `is_active`;

UPDATE `vouchers`
SET `name` = CASE `code`
  WHEN 'WELCOME10' THEN 'Voucher Selamat Datang 10%'
  WHEN 'WELCOME5000' THEN 'Voucher Pengguna Baru Rp5.000'
  WHEN 'GOLDONGKIR' THEN 'Gratis Ongkir Member Gold'
  WHEN 'PLAT20' THEN 'Diskon Member Platinum 20%'
  ELSE `code`
END
WHERE `name` IS NULL;
