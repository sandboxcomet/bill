CREATE TABLE `personal_aliases` (
  `owner_id` INTEGER NOT NULL,
  `target_id` INTEGER NOT NULL,
  `name` VARCHAR(191) NULL,
  PRIMARY KEY (`owner_id`, `target_id`),
  CONSTRAINT `personal_aliases_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `personal_aliases_target_id_fkey` FOREIGN KEY (`target_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
