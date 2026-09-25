CREATE TABLE `inventory_locations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `store_id` int,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `type` enum('online','pos','warehouse') NOT NULL,
  `is_online_default` boolean NOT NULL DEFAULT false,
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` timestamp DEFAULT (now()),
  `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `inventory_locations_id` PRIMARY KEY(`id`),
  CONSTRAINT `inventory_locations_code_unique` UNIQUE(`code`),
  CONSTRAINT `inventory_locations_store_id_stores_id_fk` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`)
);

CREATE TABLE `inventory_balances` (
  `id` int AUTO_INCREMENT NOT NULL,
  `location_id` int NOT NULL,
  `product_id` int NOT NULL,
  `variant_id` int,
  `quantity` int NOT NULL DEFAULT 0,
  `reserved` int NOT NULL DEFAULT 0,
  `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `inventory_balances_id` PRIMARY KEY(`id`),
  CONSTRAINT `inventory_balance_location_product_variant_unique` UNIQUE(`location_id`,`product_id`,`variant_id`),
  CONSTRAINT `inventory_balances_location_id_inventory_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `inventory_locations`(`id`),
  CONSTRAINT `inventory_balances_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_balances_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE,
  INDEX `inventory_balance_product_location_idx` (`product_id`,`location_id`)
);

CREATE TABLE `inventory_movements` (
  `id` int AUTO_INCREMENT NOT NULL,
  `location_id` int NOT NULL,
  `product_id` int NOT NULL,
  `variant_id` int,
  `quantity_delta` int NOT NULL,
  `balance_after` int NOT NULL,
  `type` enum('opening_balance','online_sale','pos_sale','return','transfer_in','transfer_out','adjustment') NOT NULL,
  `reference_type` varchar(50),
  `reference_id` int,
  `actor_user_id` int,
  `notes` varchar(500),
  `created_at` timestamp DEFAULT (now()),
  CONSTRAINT `inventory_movements_id` PRIMARY KEY(`id`),
  CONSTRAINT `inventory_movements_location_id_inventory_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `inventory_locations`(`id`),
  CONSTRAINT `inventory_movements_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  CONSTRAINT `inventory_movements_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`),
  CONSTRAINT `inventory_movements_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`),
  INDEX `inventory_movement_location_created_idx` (`location_id`,`created_at`),
  INDEX `inventory_movement_product_created_idx` (`product_id`,`created_at`)
);

INSERT INTO `inventory_locations` (`store_id`,`code`,`name`,`type`,`is_online_default`,`is_active`)
VALUES ((SELECT `id` FROM `stores` WHERE `is_official` = true LIMIT 1), 'ONLINE-UTAMA', 'Gudang Online', 'online', true, true);

INSERT INTO `inventory_locations` (`store_id`,`code`,`name`,`type`,`is_online_default`,`is_active`)
VALUES ((SELECT `id` FROM `stores` WHERE `is_official` = true LIMIT 1), 'POS-UTAMA', 'POS Utama', 'pos', false, true);

INSERT INTO `inventory_balances` (`location_id`,`product_id`,`variant_id`,`quantity`,`reserved`)
SELECT l.id, p.id, NULL, COALESCE(p.stock, 0), 0
FROM products p JOIN inventory_locations l ON l.is_online_default = true;

INSERT INTO `inventory_balances` (`location_id`,`product_id`,`variant_id`,`quantity`,`reserved`)
SELECT l.id, v.product_id, v.id, COALESCE(v.stock, 0), 0
FROM product_variants v JOIN inventory_locations l ON l.is_online_default = true;

INSERT INTO `inventory_movements` (`location_id`,`product_id`,`variant_id`,`quantity_delta`,`balance_after`,`type`,`notes`)
SELECT location_id, product_id, variant_id, quantity, quantity, 'opening_balance', 'Migrasi stok lama ke Gudang Online'
FROM inventory_balances WHERE quantity <> 0;

ALTER TABLE `pos_sessions` ADD COLUMN `location_id` int NULL AFTER `cashier_id`;
UPDATE `pos_sessions` SET `location_id` = (SELECT `id` FROM `inventory_locations` WHERE `code` = 'POS-UTAMA' LIMIT 1) WHERE `location_id` IS NULL;
ALTER TABLE `pos_sessions` ADD CONSTRAINT `pos_sessions_location_id_inventory_locations_id_fk`
  FOREIGN KEY (`location_id`) REFERENCES `inventory_locations`(`id`);
