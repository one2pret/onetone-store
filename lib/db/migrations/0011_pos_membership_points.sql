CREATE UNIQUE INDEX `points_ledger_membership_order_reason_unique`
  ON `points_ledger` (`membership_id`, `order_id`, `reason`);
