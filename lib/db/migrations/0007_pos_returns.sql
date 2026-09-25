CREATE TABLE `pos_returns` (
  `id` int AUTO_INCREMENT NOT NULL,
  `return_number` varchar(50) NOT NULL,
  `order_id` int NOT NULL,
  `location_id` int NOT NULL,
  `pos_session_id` int,
  `actor_user_id` int NOT NULL,
  `refund_method` enum('cash','qris','transfer') NOT NULL,
  `refund_amount` decimal(12,2) NOT NULL,
  `reason` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `pos_returns_id` PRIMARY KEY(`id`),
  CONSTRAINT `pos_returns_return_number_unique` UNIQUE(`return_number`),
  CONSTRAINT `pos_returns_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`),
  CONSTRAINT `pos_returns_location_id_inventory_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `inventory_locations`(`id`),
  CONSTRAINT `pos_returns_pos_session_id_pos_sessions_id_fk` FOREIGN KEY (`pos_session_id`) REFERENCES `pos_sessions`(`id`),
  CONSTRAINT `pos_returns_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`),
  INDEX `pos_returns_order_created_idx` (`order_id`, `created_at`),
  INDEX `pos_returns_location_created_idx` (`location_id`, `created_at`)
);

CREATE TABLE `pos_return_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `return_id` int NOT NULL,
  `order_item_id` int NOT NULL,
  `product_id` int NOT NULL,
  `variant_id` int,
  `quantity` int NOT NULL,
  `refund_amount` decimal(12,2) NOT NULL,
  `restocked` boolean NOT NULL DEFAULT true,
  CONSTRAINT `pos_return_items_id` PRIMARY KEY(`id`),
  CONSTRAINT `pos_return_items_return_id_pos_returns_id_fk` FOREIGN KEY (`return_id`) REFERENCES `pos_returns`(`id`) ON DELETE CASCADE,
  CONSTRAINT `pos_return_items_order_item_id_order_items_id_fk` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`),
  CONSTRAINT `pos_return_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  CONSTRAINT `pos_return_items_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`),
  INDEX `pos_return_items_return_idx` (`return_id`),
  INDEX `pos_return_items_order_item_idx` (`order_item_id`)
);
