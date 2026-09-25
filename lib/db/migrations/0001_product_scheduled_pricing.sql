ALTER TABLE `products`
  ADD COLUMN `sale_price` decimal(12,2) NULL AFTER `price`,
  ADD COLUMN `sale_starts_at` timestamp NULL AFTER `sale_price`,
  ADD COLUMN `sale_ends_at` timestamp NULL AFTER `sale_starts_at`;

ALTER TABLE `product_variants`
  ADD COLUMN `sale_price_override` decimal(12,2) NULL AFTER `price_modifier`;

ALTER TABLE `order_items`
  ADD COLUMN `regular_price` decimal(12,2) NULL AFTER `price`,
  ADD COLUMN `product_discount_amount` decimal(12,2) NOT NULL DEFAULT 0 AFTER `regular_price`;
