ALTER TABLE `bills` ADD COLUMN `share_code` VARCHAR(8) NULL;
CREATE UNIQUE INDEX `bills_user_id_share_code_key` ON `bills`(`user_id`, `share_code`);
