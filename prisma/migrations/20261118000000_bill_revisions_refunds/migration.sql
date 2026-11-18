ALTER TABLE `bill_items` ADD COLUMN `archived` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `bill_revisions` (
  `id` VARCHAR(191) NOT NULL,
  `bill_id` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `actor_id` INTEGER NOT NULL,
  `snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `bill_revisions_bill_id_version_key` (`bill_id`, `version`),
  CONSTRAINT `bill_revisions_bill_id_fkey` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bill_refunds` (
  `id` VARCHAR(191) NOT NULL,
  `bill_id` VARCHAR(191) NOT NULL,
  `version` INTEGER NOT NULL,
  `target_type` VARCHAR(191) NOT NULL,
  `target_id` VARCHAR(191) NOT NULL,
  `from_participant_id` VARCHAR(191) NULL,
  `to_participant_id` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `refunded_amount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `bill_refunds_bill_id_version_idx` (`bill_id`, `version`),
  INDEX `bill_refunds_target_type_target_id_idx` (`target_type`, `target_id`),
  CONSTRAINT `bill_refunds_bill_id_fkey` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
