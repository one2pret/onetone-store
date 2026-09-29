CREATE TABLE `inventory_receipts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `receipt_number` varchar(50) NOT NULL,
  `idempotency_key` varchar(64) NOT NULL,
  `location_id` int NOT NULL,
  `actor_user_id` int NOT NULL,
  `reference_number` varchar(100),
  `notes` varchar(500),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `inventory_receipts_id` PRIMARY KEY(`id`),
  CONSTRAINT `inventory_receipts_receipt_number_unique` UNIQUE(`receipt_number`),
  CONSTRAINT `inventory_receipts_idempotency_key_unique` UNIQUE(`idempotency_key`),
  CONSTRAINT `inventory_receipts_location_id_inventory_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `inventory_locations`(`id`),
  CONSTRAINT `inventory_receipts_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`),
  INDEX `inventory_receipts_location_created_idx` (`location_id`, `created_at`)
);

ALTER TABLE `inventory_movements`
  MODIFY COLUMN `type` enum('opening_balance','receipt','online_sale','pos_sale','return','transfer_in','transfer_out','adjustment') NOT NULL;
