-- OAuth providers can return profile image URLs longer than 191 characters.
ALTER TABLE `users` MODIFY `image` TEXT NULL;
