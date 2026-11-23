-- Additive parity repair. Existing compatible objects are preserved.
--> statement-breakpoint
-- Existing incompatible definitions require read-only parity review before promotion.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `affiliates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`code` varchar(32) NOT NULL,
	`display_name` varchar(255),
	`affiliate_status` enum('pending','active','suspended','rejected') NOT NULL DEFAULT 'pending',
	`affiliate_tier` enum('starter','pro','elite') NOT NULL DEFAULT 'starter',
	`social_media` text,
	`audience_size` int,
	`motivation` text,
	`bank_code` varchar(20),
	`bank_account_number` varchar(50),
	`bank_account_name` varchar(255),
	`npwp` varchar(25),
	`parent_affiliate_id` int,
	`approved_at` timestamp,
	`approved_by` int,
	`suspended_at` timestamp,
	`suspend_reason` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliates_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliates_user_id_unique` UNIQUE(`user_id`),
	CONSTRAINT `affiliates_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `affiliate_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`slug` varchar(16) NOT NULL,
	`target_type` enum('home','product','category','custom') NOT NULL DEFAULT 'home',
	`target_id` int,
	`target_path` varchar(500),
	`label` varchar(255),
	`utm_source` varchar(100),
	`utm_medium` varchar(100),
	`utm_campaign` varchar(100),
	`click_count` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `affiliate_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliate_links_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `affiliate_clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`link_id` int,
	`visitor_id` varchar(36) NOT NULL,
	`ip_hash` varchar(64),
	`user_agent` varchar(500),
	`referer` varchar(500),
	`landing_path` varchar(500),
	`converted_order_id` int,
	`converted_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `affiliate_clicks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `commission_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rule_scope` enum('global','tier','category','product') NOT NULL,
	`scope_tier` enum('starter','pro','elite'),
	`category_id` int,
	`product_id` int,
	`rate_percent` decimal(5,2) NOT NULL,
	`max_commission` decimal(12,2),
	`priority` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`starts_at` timestamp,
	`ends_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commission_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `affiliate_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`is_enabled` boolean NOT NULL DEFAULT false,
	`auto_approve_registration` boolean NOT NULL DEFAULT false,
	`cookie_window_days` int NOT NULL DEFAULT 30,
	`hold_period_days` int NOT NULL DEFAULT 7,
	`default_rate_percent` decimal(5,2) NOT NULL DEFAULT '5.00',
	`min_payout_amount` decimal(12,2) NOT NULL DEFAULT '50000.00',
	`payout_admin_fee` decimal(12,2) NOT NULL DEFAULT '0',
	`allow_self_referral` boolean NOT NULL DEFAULT false,
	`terms_content` text,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `affiliate_payouts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`payout_number` varchar(50) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`admin_fee` decimal(12,2) DEFAULT '0',
	`net_amount` decimal(12,2) NOT NULL,
	`bank_code` varchar(20) NOT NULL,
	`bank_account_number` varchar(50) NOT NULL,
	`bank_account_name` varchar(255) NOT NULL,
	`payout_status` enum('requested','approved','processing','completed','failed','rejected') NOT NULL DEFAULT 'requested',
	`xendit_disbursement_id` varchar(255),
	`failure_reason` text,
	`notes` text,
	`approved_by` int,
	`approved_at` timestamp,
	`completed_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_payouts_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliate_payouts_payout_number_unique` UNIQUE(`payout_number`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `affiliate_commissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`order_id` int NOT NULL,
	`order_item_id` int,
	`entry_type` enum('earning','reversal','adjustment') NOT NULL DEFAULT 'earning',
	`base_amount` decimal(12,2) NOT NULL,
	`rate_percent` decimal(5,2) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`rule_id` int,
	`commission_status` enum('pending','holding','approved','paid','rejected') NOT NULL DEFAULT 'pending',
	`payout_id` int,
	`hold_until` timestamp,
	`approved_at` timestamp,
	`rejected_at` timestamp,
	`reject_reason` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_commissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'birthdate'), 'DO 0', 'ALTER TABLE `users` ADD COLUMN `birthdate` varchar(10)');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'channel'), 'DO 0', 'ALTER TABLE `products` ADD COLUMN `channel` enum(''all'',''store_only'',''marketplace_only'') NOT NULL DEFAULT ''all''');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'sort_order'), 'DO 0', 'ALTER TABLE `categories` ADD COLUMN `sort_order` int NOT NULL DEFAULT 99');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'is_visible'), 'DO 0', 'ALTER TABLE `categories` ADD COLUMN `is_visible` boolean NOT NULL DEFAULT true');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'affiliate_id'), 'DO 0', 'ALTER TABLE `orders` ADD COLUMN `affiliate_id` int');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'affiliate_code'), 'DO 0', 'ALTER TABLE `orders` ADD COLUMN `affiliate_code` varchar(32)');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'affiliate_link_id'), 'DO 0', 'ALTER TABLE `orders` ADD COLUMN `affiliate_link_id` int');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'affiliate_click_id'), 'DO 0', 'ALTER TABLE `orders` ADD COLUMN `affiliate_click_id` int');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliate_clicks' AND COLUMN_NAME = 'affiliate_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `affiliate_clicks` ADD CONSTRAINT `affiliate_clicks_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliate_clicks' AND COLUMN_NAME = 'link_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `affiliate_clicks` ADD CONSTRAINT `affiliate_clicks_link_id_affiliate_links_id_fk` FOREIGN KEY (`link_id`) REFERENCES `affiliate_links`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliate_commissions' AND COLUMN_NAME = 'affiliate_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliate_commissions' AND COLUMN_NAME = 'order_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliate_commissions' AND COLUMN_NAME = 'order_item_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_order_item_id_order_items_id_fk` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliate_commissions' AND COLUMN_NAME = 'rule_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `affiliate_commissions` ADD CONSTRAINT `affiliate_commissions_rule_id_commission_rules_id_fk` FOREIGN KEY (`rule_id`) REFERENCES `commission_rules`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliate_links' AND COLUMN_NAME = 'affiliate_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `affiliate_links` ADD CONSTRAINT `affiliate_links_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliate_payouts' AND COLUMN_NAME = 'affiliate_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `affiliate_payouts` ADD CONSTRAINT `affiliate_payouts_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliate_payouts' AND COLUMN_NAME = 'approved_by' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `affiliate_payouts` ADD CONSTRAINT `affiliate_payouts_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliates' AND COLUMN_NAME = 'user_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `affiliates` ADD CONSTRAINT `affiliates_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'affiliates' AND COLUMN_NAME = 'approved_by' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `affiliates` ADD CONSTRAINT `affiliates_approved_by_users_id_fk` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commission_rules' AND COLUMN_NAME = 'category_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `commission_rules` ADD CONSTRAINT `commission_rules_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commission_rules' AND COLUMN_NAME = 'product_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `commission_rules` ADD CONSTRAINT `commission_rules_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'affiliate_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `orders` ADD CONSTRAINT `orders_affiliate_id_affiliates_id_fk` FOREIGN KEY (`affiliate_id`) REFERENCES `affiliates`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'affiliate_link_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `orders` ADD CONSTRAINT `orders_affiliate_link_id_affiliate_links_id_fk` FOREIGN KEY (`affiliate_link_id`) REFERENCES `affiliate_links`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = IF(EXISTS (SELECT 1 FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'affiliate_click_id' AND REFERENCED_TABLE_NAME IS NOT NULL), 'DO 0', 'ALTER TABLE `orders` ADD CONSTRAINT `orders_affiliate_click_id_affiliate_clicks_id_fk` FOREIGN KEY (`affiliate_click_id`) REFERENCES `affiliate_clicks`(`id`) ON DELETE no action ON UPDATE no action');
PREPARE onetone_parity FROM @onetone_parity_ddl;
EXECUTE onetone_parity;
DEALLOCATE PREPARE onetone_parity;
--> statement-breakpoint
SET @onetone_parity_ddl = NULL;
