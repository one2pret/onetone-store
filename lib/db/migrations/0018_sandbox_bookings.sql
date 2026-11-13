-- No historical backfill: current product weights are not checkout evidence.
ALTER TABLE order_items ADD COLUMN unit_weight_grams INT NULL;
--> statement-breakpoint
CREATE TABLE sandbox_bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL UNIQUE,
  reference_id VARCHAR(100) NOT NULL UNIQUE,
  mode VARCHAR(16) NOT NULL DEFAULT 'sandbox',
  booking_status ENUM('needs_reconciliation', 'booked', 'rejected') NOT NULL,
  snapshot TEXT NOT NULL,
  snapshot_hash VARCHAR(64) NOT NULL,
  external_order_id VARCHAR(255) NULL UNIQUE,
  waybill_id VARCHAR(255) NULL,
  courier_tracking_id VARCHAR(255) NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
--> statement-breakpoint
CREATE TABLE sandbox_booking_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  actor_id INT NOT NULL,
  event VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES sandbox_bookings(id)
);
