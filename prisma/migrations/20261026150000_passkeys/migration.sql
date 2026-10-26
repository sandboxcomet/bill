ALTER TABLE `users` ADD COLUMN `passkey_user_handle` VARCHAR(64) NULL;
CREATE UNIQUE INDEX `users_passkey_user_handle_key` ON `users`(`passkey_user_handle`);

CREATE TABLE `passkeys` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `credential_id` TEXT NOT NULL,
    `credential_hash` CHAR(64) NOT NULL,
    `public_key` BLOB NOT NULL,
    `user_handle` VARCHAR(64) NOT NULL,
    `counter` BIGINT NOT NULL DEFAULT 0,
    `transports` JSON NOT NULL,
    `device_type` VARCHAR(32) NOT NULL,
    `backed_up` BOOLEAN NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_used_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    UNIQUE INDEX `passkeys_credential_hash_key`(`credential_hash`),
    INDEX `passkeys_user_id_revoked_at_idx`(`user_id`, `revoked_at`),
    PRIMARY KEY (`id`),
    CONSTRAINT `passkeys_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Challenges are consumed once and retained; no history is removed by this migration.
CREATE TABLE `passkey_challenges` (
    `id` CHAR(64) NOT NULL,
    `purpose` VARCHAR(16) NOT NULL,
    `challenge` VARCHAR(128) NOT NULL,
    `user_id` INTEGER NULL,
    `auth_version` INTEGER NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `passkey_challenges_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
