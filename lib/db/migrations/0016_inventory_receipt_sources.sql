ALTER TABLE `inventory_receipts`
  ADD COLUMN `source_type` enum('external','internal') NULL,
  ADD COLUMN `source_location_id` int NULL,
  ADD COLUMN `source_name` varchar(150) NULL,
  ADD CONSTRAINT `inventory_receipts_source_location_id_inventory_locations_id_fk`
    FOREIGN KEY (`source_location_id`) REFERENCES `inventory_locations`(`id`);
--> statement-breakpoint

CREATE INDEX `inventory_receipts_source_location_idx`
  ON `inventory_receipts` (`source_location_id`, `created_at`);
--> statement-breakpoint

ALTER TABLE `inventory_transfers`
  ADD COLUMN `receipt_id` int NULL,
  ADD CONSTRAINT `inventory_transfers_receipt_id_inventory_receipts_id_fk`
    FOREIGN KEY (`receipt_id`) REFERENCES `inventory_receipts`(`id`);
--> statement-breakpoint

CREATE INDEX `inventory_transfers_receipt_idx`
  ON `inventory_transfers` (`receipt_id`);
