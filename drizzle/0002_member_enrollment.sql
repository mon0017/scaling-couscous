ALTER TABLE `members` ADD `auth_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `members_auth_id_unique` ON `members` (`auth_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (lower(trim("email")));
--> statement-breakpoint
UPDATE members SET auth_id=id;
