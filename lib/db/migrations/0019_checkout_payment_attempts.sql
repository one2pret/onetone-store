-- Persistence foundation for checkout provider attempts. NO live invoice calls.
-- Each attempted external reference is unique. Retain ambiguous outcomes for
-- operator reconciliation instead of blindly retrying Xendit.
CREATE TABLE checkout_payment_attempts (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  attempt_no INT NOT NULL,
  mode ENUM('sandbox', 'live') NOT NULL,
  external_id VARCHAR(100) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status ENUM(
    'reserved', 'requesting', 'needs_reconciliation',
    'ready', 'paid', 'expired', 'failed'
  ) NOT NULL DEFAULT 'reserved',
  xendit_id VARCHAR(255) NULL,
  invoice_url TEXT NULL,
  last_error_code VARCHAR(100) NULL,
  requested_at TIMESTAMP NULL,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY checkout_payment_attempt_order_sequence_unique (order_id, attempt_no),
  UNIQUE KEY checkout_payment_attempt_external_id_unique (external_id),
  UNIQUE KEY checkout_payment_attempt_xendit_id_unique (xendit_id),
  KEY checkout_payment_attempt_status_idx (status),
  CONSTRAINT checkout_payment_attempt_order_fk FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT checkout_payment_attempt_no_positive CHECK (attempt_no > 0),
  CONSTRAINT checkout_payment_attempt_amount_positive CHECK (amount > 0)
);
