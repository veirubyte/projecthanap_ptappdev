-- Run once against an existing Project HANAP database.
-- New database imports from project_hanap (4).sql already include these columns.
ALTER TABLE `item_reports`
  ADD COLUMN `custody_received_at` timestamp NULL DEFAULT NULL AFTER `secret_answer`,
  ADD COLUMN `custody_received_by` int(11) DEFAULT NULL AFTER `custody_received_at`,
  ADD CONSTRAINT `fk_item_reports_custody_received_by`
    FOREIGN KEY (`custody_received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;
