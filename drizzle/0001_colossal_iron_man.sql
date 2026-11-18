CREATE TABLE `ai_assistants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`socialAccountId` int NOT NULL,
	`tone` varchar(80) NOT NULL DEFAULT 'Authentique',
	`language` varchar(48) NOT NULL DEFAULT 'Français',
	`style` varchar(160) NOT NULL DEFAULT 'Clair, chaleureux et utile',
	`audience` varchar(255) NOT NULL DEFAULT 'Communauté intéressée par la niche',
	`rules` text,
	`permission` varchar(32) NOT NULL DEFAULT 'suggestions',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_assistants_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_assistants_account_unique` UNIQUE(`socialAccountId`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`mediaType` varchar(24) NOT NULL DEFAULT 'image',
	`url` text,
	`tags` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`socialAccountId` int,
	`mediaId` int,
	`title` varchar(240) NOT NULL,
	`caption` text,
	`hashtags` text,
	`cta` varchar(240),
	`status` varchar(24) NOT NULL DEFAULT 'draft',
	`scheduledAt` timestamp,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`platform` varchar(32) NOT NULL,
	`handle` varchar(120) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`niche` varchar(120) NOT NULL DEFAULT 'Créateur',
	`avatarUrl` text,
	`followers` int NOT NULL DEFAULT 0,
	`engagementRate` varchar(16) NOT NULL DEFAULT '0.0',
	`connectionStatus` varchar(24) NOT NULL DEFAULT 'pending',
	`isActive` boolean NOT NULL DEFAULT true,
	`connectedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` varchar(24) NOT NULL DEFAULT 'user';--> statement-breakpoint
CREATE INDEX `ai_assistants_user_idx` ON `ai_assistants` (`userId`);--> statement-breakpoint
CREATE INDEX `media_user_idx` ON `media` (`userId`);--> statement-breakpoint
CREATE INDEX `posts_user_idx` ON `posts` (`userId`);--> statement-breakpoint
CREATE INDEX `posts_schedule_idx` ON `posts` (`userId`,`scheduledAt`);--> statement-breakpoint
CREATE INDEX `social_accounts_user_idx` ON `social_accounts` (`userId`);--> statement-breakpoint
CREATE INDEX `social_accounts_platform_handle_idx` ON `social_accounts` (`platform`,`handle`);