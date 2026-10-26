-- Retain both user records and all financial/social history after a merge.
ALTER TABLE `users`
    ADD COLUMN `auth_version` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `merged_into_id` INTEGER NULL;
CREATE INDEX `users_merged_into_id_idx` ON `users`(`merged_into_id`);
ALTER TABLE `users` ADD CONSTRAINT `users_merged_into_id_fkey`
    FOREIGN KEY (`merged_into_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `account_connections` (
    `id` CHAR(64) NOT NULL,
    `initiator_id` INTEGER NOT NULL,
    `initiator_version` INTEGER NOT NULL,
    `provider` VARCHAR(16) NOT NULL,
    `provider_account_id` VARCHAR(191) NULL,
    `target_user_id` INTEGER NULL,
    `target_version` INTEGER NULL,
    `profile_name` VARCHAR(191) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'STARTED',
    `primary_user_id` INTEGER NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    INDEX `account_connections_initiator_id_status_idx`(`initiator_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
