ALTER TABLE `vouchers`
  ADD COLUMN `voucher_audience` enum('public','membership','new_user') NOT NULL DEFAULT 'public' AFTER `used_count`,
  ADD COLUMN `valid_days_after_grant` int NULL AFTER `voucher_audience`,
  ADD COLUMN `max_uses_per_user` int NOT NULL DEFAULT 1 AFTER `valid_days_after_grant`,
  ADD COLUMN `first_order_only` boolean NOT NULL DEFAULT false AFTER `max_uses_per_user`,
  ADD COLUMN `allow_points` boolean NOT NULL DEFAULT true AFTER `first_order_only`;

CREATE TABLE `user_vouchers` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `voucher_id` int NOT NULL,
  `user_voucher_status` enum('available','reserved','redeemed','expired') NOT NULL DEFAULT 'available',
  `granted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL,
  `reserved_order_id` int NULL,
  `reserved_at` timestamp NULL,
  `redeemed_order_id` int NULL,
  `redeemed_at` timestamp NULL,
  CONSTRAINT `user_vouchers_id` PRIMARY KEY (`id`),
  CONSTRAINT `user_vouchers_user_voucher_unique` UNIQUE (`user_id`, `voucher_id`),
  INDEX `user_vouchers_status_expiry_idx` (`user_voucher_status`, `expires_at`),
  CONSTRAINT `user_vouchers_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `user_vouchers_voucher_id_vouchers_id_fk` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`),
  CONSTRAINT `user_vouchers_reserved_order_id_orders_id_fk` FOREIGN KEY (`reserved_order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `user_vouchers_redeemed_order_id_orders_id_fk` FOREIGN KEY (`redeemed_order_id`) REFERENCES `orders` (`id`)
);

INSERT INTO `vouchers` (
  `code`, `voucher_type`, `value`, `min_spend`, `store_id`, `tier_id`, `quota`, `used_count`,
  `voucher_audience`, `valid_days_after_grant`, `max_uses_per_user`, `first_order_only`, `allow_points`, `is_active`
)
SELECT 'WELCOME5000', 'fixed', 5000, 50000, NULL, NULL, NULL, 0,
       'new_user', 14, 1, true, false, true
WHERE NOT EXISTS (SELECT 1 FROM `vouchers` WHERE `code` = 'WELCOME5000');
