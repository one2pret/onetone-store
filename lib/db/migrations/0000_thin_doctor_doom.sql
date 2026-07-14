CREATE TABLE `addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`label` varchar(100),
	`recipient_name` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`address` text NOT NULL,
	`detail` text,
	`province` varchar(255) NOT NULL,
	`province_id` varchar(10),
	`city` varchar(255) NOT NULL,
	`city_id` varchar(10),
	`district` varchar(255) NOT NULL,
	`district_id` varchar(10),
	`postal_code` varchar(10) NOT NULL,
	`latitude` varchar(50),
	`longitude` varchar(50),
	`is_default` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `banners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(500),
	`image` varchar(500) NOT NULL,
	`link` varchar(500),
	`is_active` boolean DEFAULT true,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `banners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`product_id` int NOT NULL,
	`variant_id` int,
	`quantity` int DEFAULT 1,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`image` varchar(500),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `couriers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(50) NOT NULL,
	`is_active` boolean DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `couriers_id` PRIMARY KEY(`id`),
	CONSTRAINT `couriers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`xendit_id` varchar(255),
	`invoice_url` text,
	`payment_method` varchar(100),
	`payment_channel` varchar(100),
	`amount` decimal(12,2) NOT NULL,
	`invoice_status` enum('pending','paid','expired','cancelled') DEFAULT 'pending',
	`expired_at` timestamp,
	`paid_at` timestamp,
	`cancelled_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `member_tiers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`min_spend` int DEFAULT 0,
	`discount_pct` int DEFAULT 0,
	`free_shipping_threshold` int,
	`point_multiplier` int DEFAULT 1,
	`sort_order` int DEFAULT 0,
	CONSTRAINT `member_tiers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`tier_id` int NOT NULL,
	`points` int DEFAULT 0,
	`total_spend` int DEFAULT 0,
	`joined_at` timestamp DEFAULT (now()),
	CONSTRAINT `memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `memberships_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`product_id` int,
	`variant_id` int,
	`product_name` varchar(255) NOT NULL,
	`product_image` varchar(500),
	`variant_label` varchar(100),
	`price` decimal(12,2) NOT NULL,
	`quantity` int NOT NULL,
	`subtotal` decimal(12,2) NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_status_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`from_status` varchar(50) NOT NULL,
	`to_status` varchar(50) NOT NULL,
	`changed_by` varchar(100) NOT NULL,
	`note` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `order_status_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`store_id` int,
	`voucher_id` int,
	`order_number` varchar(50) NOT NULL,
	`order_channel` enum('online','pos') DEFAULT 'online',
	`status` enum('waiting_payment','packing','shipping','delivered','expired','cancelled') DEFAULT 'waiting_payment',
	`subtotal` decimal(12,2) NOT NULL,
	`discount_amount` decimal(12,2) DEFAULT '0',
	`shipping_cost` decimal(12,2) DEFAULT '0',
	`total` decimal(12,2) NOT NULL,
	`points_earned` int DEFAULT 0,
	`points_redeemed` int DEFAULT 0,
	`shipping_address` text,
	`shipping_phone` varchar(20),
	`shipping_name` varchar(255),
	`notes` text,
	`pos_session_id` int,
	`pos_payment_method` enum('cash','qris','transfer'),
	`cash_received` decimal(12,2),
	`cash_change` decimal(12,2),
	`will_expired_at` timestamp,
	`paid_at` timestamp,
	`shipping_at` timestamp,
	`delivered_at` timestamp,
	`expired_at` timestamp,
	`cancelled_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_order_number_unique` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE `points_ledger` (
	`id` int AUTO_INCREMENT NOT NULL,
	`membership_id` int NOT NULL,
	`order_id` int,
	`delta` int NOT NULL,
	`reason` varchar(100),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `points_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pos_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cashier_id` int NOT NULL,
	`opened_at` timestamp DEFAULT (now()),
	`closed_at` timestamp,
	`opening_cash` decimal(12,2) NOT NULL,
	`closing_cash` decimal(12,2),
	`expected_cash` decimal(12,2),
	`cash_difference` decimal(12,2),
	`pos_session_status` enum('open','closed') DEFAULT 'open',
	`notes` text,
	CONSTRAINT `pos_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`object_key` varchar(500) NOT NULL,
	`object_key_original` varchar(500),
	`object_key_thumb` varchar(500),
	`filename_original` varchar(255),
	`mime` varchar(100) DEFAULT 'image/webp',
	`width` int,
	`height` int,
	`filesize` int,
	`checksum` varchar(64),
	`sort_order` int DEFAULT 0,
	`is_primary` boolean DEFAULT false,
	`variant_color` varchar(100),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `product_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`size` varchar(20) NOT NULL,
	`color` varchar(100) NOT NULL,
	`color_hex` varchar(7),
	`stock` int NOT NULL DEFAULT 0,
	`price_modifier` decimal(10,2) DEFAULT '0',
	`sku` varchar(100),
	`is_active` boolean DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`store_id` int,
	`category_id` int,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`price` decimal(12,2) NOT NULL,
	`stock` int DEFAULT 0,
	`weight` int DEFAULT 0,
	`image` varchar(500),
	`images` text,
	`is_active` boolean DEFAULT true,
	`is_featured` boolean DEFAULT false,
	`is_best_seller` boolean DEFAULT false,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `shipping_histories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shipping_id` int NOT NULL,
	`status` varchar(100) NOT NULL,
	`note` text,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipping_histories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shippings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`recipient_name` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`address` text NOT NULL,
	`address_detail` text,
	`latitude` varchar(50),
	`longitude` varchar(50),
	`tracking_id` varchar(255),
	`waybill_id` varchar(255),
	`courier_name` varchar(255),
	`courier_company` varchar(100),
	`courier_type` varchar(100),
	`price` decimal(12,2),
	`estimate_days` varchar(50),
	`shipping_status` varchar(50),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shippings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `store_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `store_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(100) NOT NULL,
	`name` varchar(150) NOT NULL,
	`logo_url` varchar(500),
	`is_official` boolean DEFAULT false,
	`is_active` boolean DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `stores_id` PRIMARY KEY(`id`),
	CONSTRAINT `stores_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`phone` varchar(20),
	`address` text,
	`role` enum('customer','admin') DEFAULT 'customer',
	`deleted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `vouchers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`voucher_type` enum('fixed','percent','free_shipping') NOT NULL,
	`value` int DEFAULT 0,
	`min_spend` int DEFAULT 0,
	`store_id` int,
	`tier_id` int,
	`quota` int,
	`used_count` int DEFAULT 0,
	`starts_at` timestamp,
	`ends_at` timestamp,
	`is_active` boolean DEFAULT true,
	CONSTRAINT `vouchers_id` PRIMARY KEY(`id`),
	CONSTRAINT `vouchers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_tier_id_member_tiers_id_fk` FOREIGN KEY (`tier_id`) REFERENCES `member_tiers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variant_id_product_variants_id_fk` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_status_logs` ADD CONSTRAINT `order_status_logs_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_store_id_stores_id_fk` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_voucher_id_vouchers_id_fk` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_pos_session_id_pos_sessions_id_fk` FOREIGN KEY (`pos_session_id`) REFERENCES `pos_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `points_ledger` ADD CONSTRAINT `points_ledger_membership_id_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `points_ledger` ADD CONSTRAINT `points_ledger_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pos_sessions` ADD CONSTRAINT `pos_sessions_cashier_id_users_id_fk` FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_store_id_stores_id_fk` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shipping_histories` ADD CONSTRAINT `shipping_histories_shipping_id_shippings_id_fk` FOREIGN KEY (`shipping_id`) REFERENCES `shippings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shippings` ADD CONSTRAINT `shippings_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vouchers` ADD CONSTRAINT `vouchers_store_id_stores_id_fk` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vouchers` ADD CONSTRAINT `vouchers_tier_id_member_tiers_id_fk` FOREIGN KEY (`tier_id`) REFERENCES `member_tiers`(`id`) ON DELETE no action ON UPDATE no action;