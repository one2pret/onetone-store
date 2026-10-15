CREATE TABLE `sales_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `starts_at` timestamp NOT NULL,
  `ends_at` timestamp NOT NULL,
  `status` enum('draft','active','closed','cancelled') NOT NULL DEFAULT 'draft',
  `venue_name` varchar(150) NULL,
  `inventory_location_id` int NULL,
  `notes` varchar(500) NULL,
  `created_by_user_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `sales_events_id` PRIMARY KEY (`id`),
  CONSTRAINT `sales_events_code_unique` UNIQUE (`code`),
  CONSTRAINT `sales_events_inventory_location_id_inventory_locations_id_fk`
    FOREIGN KEY (`inventory_location_id`) REFERENCES `inventory_locations` (`id`),
  CONSTRAINT `sales_events_created_by_user_id_users_id_fk`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`),
  INDEX `sales_events_status_starts_idx` (`status`, `starts_at`)
);
--> statement-breakpoint

ALTER TABLE `pos_sessions`
  ADD COLUMN `sales_event_id` int NULL,
  ADD INDEX `pos_sessions_sales_event_idx` (`sales_event_id`),
  ADD CONSTRAINT `pos_sessions_sales_event_id_sales_events_id_fk`
    FOREIGN KEY (`sales_event_id`) REFERENCES `sales_events` (`id`);
