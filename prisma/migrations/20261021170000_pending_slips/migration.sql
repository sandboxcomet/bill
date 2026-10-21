ALTER TABLE `payment_evidence`
  ADD COLUMN `payload_hash` CHAR(64) NULL,
  ADD COLUMN `encrypted_slip` TEXT NULL,
  ADD COLUMN `provider_job_id` VARCHAR(64) NULL,
  ADD COLUMN `queued_at` DATETIME(3) NULL,
  ADD COLUMN `next_check_at` DATETIME(3) NULL,
  ADD COLUMN `lease_until` DATETIME(3) NULL,
  ADD COLUMN `retry_count` INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX `payment_evidence_payload_hash_key` ON `payment_evidence`(`payload_hash`);
CREATE UNIQUE INDEX `payment_evidence_provider_job_id_key` ON `payment_evidence`(`provider_job_id`);
CREATE INDEX `payment_evidence_status_next_check_at_idx` ON `payment_evidence`(`status`, `next_check_at`);
