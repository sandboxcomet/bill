ALTER TABLE `bills` ADD COLUMN `restaurants` JSON NULL;
ALTER TABLE `bill_items` ADD COLUMN `restaurant_id` VARCHAR(191) NULL;
