-- AlterTable
ALTER TABLE `bill_items` ADD COLUMN `payer_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `bills` ADD COLUMN `item_payers_enabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `participants` ADD COLUMN `paid_upfront` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `prompt_pay_id` VARCHAR(13) NULL,
    ADD COLUMN `share_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `bill_settlements` (
    `id` VARCHAR(191) NOT NULL,
    `bill_id` VARCHAR(191) NOT NULL,
    `from_participant_id` VARCHAR(191) NOT NULL,
    `to_participant_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 2) NOT NULL,
    `paid_amount` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `is_paid` BOOLEAN NOT NULL DEFAULT false,
    `archived` BOOLEAN NOT NULL DEFAULT false,

    INDEX `bill_settlements_from_participant_id_idx`(`from_participant_id`),
    INDEX `bill_settlements_to_participant_id_idx`(`to_participant_id`),
    UNIQUE INDEX `settlement_pair`(`bill_id`, `from_participant_id`, `to_participant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bill_items` ADD CONSTRAINT `bill_items_payer_id_fkey` FOREIGN KEY (`payer_id`) REFERENCES `participants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bill_settlements` ADD CONSTRAINT `bill_settlements_bill_id_fkey` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bill_settlements` ADD CONSTRAINT `bill_settlements_from_participant_id_fkey` FOREIGN KEY (`from_participant_id`) REFERENCES `participants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bill_settlements` ADD CONSTRAINT `bill_settlements_to_participant_id_fkey` FOREIGN KEY (`to_participant_id`) REFERENCES `participants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

