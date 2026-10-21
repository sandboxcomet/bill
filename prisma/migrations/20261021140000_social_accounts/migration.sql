ALTER TABLE `users` ADD COLUMN `username` VARCHAR(24) NULL;
CREATE UNIQUE INDEX `users_username_key` ON `users`(`username`);
ALTER TABLE `participants` ADD COLUMN `account_user_id` INTEGER NULL;
ALTER TABLE `participants` ADD CONSTRAINT `participants_account_user_id_fkey` FOREIGN KEY (`account_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE `friendships` (
  `id` VARCHAR(191) NOT NULL,
  `low_user_id` INTEGER NOT NULL,
  `high_user_id` INTEGER NOT NULL,
  `requester_id` INTEGER NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `source` VARCHAR(191) NOT NULL DEFAULT 'REQUEST',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `friendship_pair` (`low_user_id`, `high_user_id`),
  INDEX `friendships_high_user_id_status_idx` (`high_user_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `friendships_low_user_id_fkey` FOREIGN KEY (`low_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `friendships_high_user_id_fkey` FOREIGN KEY (`high_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `friendships_requester_id_fkey` FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `friend_groups` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` INTEGER NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `friend_groups_user_id_idx` (`user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `friend_groups_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `friend_group_members` (
  `id` VARCHAR(191) NOT NULL,
  `group_id` VARCHAR(191) NOT NULL,
  `user_id` INTEGER NOT NULL,
  UNIQUE INDEX `friend_group_member` (`group_id`, `user_id`),
  INDEX `friend_group_members_user_id_idx` (`user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `friend_group_members_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `friend_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `friend_group_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
