ALTER TABLE `users`
  MODIFY COLUMN `role` enum('customer','admin','cashier','inventory_staff') DEFAULT 'customer';

CREATE TABLE `user_inventory_locations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `location_id` int NOT NULL,
  `created_by_user_id` int,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `user_inventory_locations_id` PRIMARY KEY(`id`),
  CONSTRAINT `user_inventory_locations_user_location_unique` UNIQUE(`user_id`,`location_id`),
  CONSTRAINT `user_inventory_locations_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `user_inventory_locations_location_id_inventory_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `inventory_locations`(`id`) ON DELETE CASCADE,
  CONSTRAINT `user_inventory_locations_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
  INDEX `user_inventory_locations_location_idx` (`location_id`)
);
