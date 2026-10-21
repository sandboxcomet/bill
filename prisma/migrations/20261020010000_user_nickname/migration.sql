-- Add a separate display name without changing OAuth identity or existing rows.
ALTER TABLE `users` ADD COLUMN `nickname` VARCHAR(40) NULL;
