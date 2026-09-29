ALTER TABLE `products`
  ADD COLUMN `sale_channel` enum('online','pos','all') NOT NULL DEFAULT 'online' AFTER `sale_ends_at`;

ALTER TABLE `order_items`
  ADD COLUMN `manual_discount_amount` decimal(12,2) NOT NULL DEFAULT '0' AFTER `product_discount_amount`;
