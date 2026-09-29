CREATE TABLE `pos_customer_leads` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone_normalized` varchar(20) NOT NULL,
  `email` varchar(255),
  `status` enum('pending','activated','cancelled','expired') NOT NULL DEFAULT 'pending',
  `consent_at` timestamp NOT NULL,
  `marketing_consent_at` timestamp,
  `source` varchar(30) NOT NULL DEFAULT 'pos',
  `created_by_user_id` int NOT NULL,
  `location_id` int NOT NULL,
  `activation_token_hash` varchar(64),
  `activation_expires_at` timestamp,
  `claimed_user_id` int,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `pos_customer_leads_id` PRIMARY KEY(`id`),
  CONSTRAINT `pos_customer_leads_phone_unique` UNIQUE(`phone_normalized`),
  CONSTRAINT `pos_customer_leads_activation_token_unique` UNIQUE(`activation_token_hash`),
  CONSTRAINT `pos_customer_leads_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
  CONSTRAINT `pos_customer_leads_location_id_inventory_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `inventory_locations`(`id`),
  CONSTRAINT `pos_customer_leads_claimed_user_id_users_id_fk` FOREIGN KEY (`claimed_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `pos_customer_leads_status_created_idx` (`status`, `created_at`),
  INDEX `pos_customer_leads_location_created_idx` (`location_id`, `created_at`)
);

ALTER TABLE `orders`
  ADD COLUMN `pos_customer_lead_id` int NULL AFTER `user_id`,
  ADD CONSTRAINT `orders_pos_customer_lead_id_pos_customer_leads_id_fk`
    FOREIGN KEY (`pos_customer_lead_id`) REFERENCES `pos_customer_leads`(`id`) ON DELETE SET NULL;

CREATE INDEX `orders_pos_customer_lead_id_idx` ON `orders` (`pos_customer_lead_id`);
