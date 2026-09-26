ALTER TABLE `banners`
  ADD COLUMN `image_object_key` varchar(500) NULL AFTER `image`,
  ADD COLUMN `image_object_key_original` varchar(500) NULL AFTER `image_object_key`,
  ADD COLUMN `image_object_key_thumb` varchar(500) NULL AFTER `image_object_key_original`,
  ADD COLUMN `image_mime` varchar(100) NULL AFTER `image_object_key_thumb`,
  ADD COLUMN `image_width` int NULL AFTER `image_mime`,
  ADD COLUMN `image_height` int NULL AFTER `image_width`,
  ADD COLUMN `image_filesize` int NULL AFTER `image_height`,
  ADD COLUMN `image_checksum` varchar(64) NULL AFTER `image_filesize`;
