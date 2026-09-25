ALTER TABLE `pos_sessions`
  ADD COLUMN `assigned_cashier_name` varchar(255) NULL AFTER `pos_session_status`;
