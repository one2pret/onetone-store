ALTER TABLE `products` ADD COLUMN `pos_name` varchar(60) NULL AFTER `name`;
ALTER TABLE `product_variants` ADD COLUMN `pos_label` varchar(60) NULL AFTER `sku`;

CREATE TABLE `product_barcodes` (
  `id` int AUTO_INCREMENT NOT NULL,
  `code` varchar(100) NOT NULL,
  `product_id` int NOT NULL,
  `variant_id` int,
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `product_barcodes_id` PRIMARY KEY(`id`),
  CONSTRAINT `product_barcodes_code_unique` UNIQUE(`code`),
  CONSTRAINT `product_barcodes_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  CONSTRAINT `product_barcodes_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE,
  INDEX `product_barcodes_product_idx` (`product_id`),
  INDEX `product_barcodes_variant_idx` (`variant_id`)
);
