ALTER TABLE `product_images`
  ADD COLUMN `variant_id` int NULL AFTER `variant_color`,
  ADD CONSTRAINT `product_images_variant_id_product_variants_id_fk`
    FOREIGN KEY (`variant_id`) REFERENCES `product_variants` (`id`) ON DELETE SET NULL;

CREATE INDEX `product_images_variant_id_idx` ON `product_images` (`variant_id`);
