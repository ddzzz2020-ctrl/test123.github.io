CREATE TABLE `task_rows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`rowIndex` int NOT NULL,
	`commentText` text,
	`tags` text,
	`rowData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_rows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`originalFilename` varchar(512) NOT NULL,
	`sourceFileKey` varchar(1024),
	`sourceFileUrl` text,
	`resultFileKey` varchar(1024),
	`resultFileUrl` text,
	`commentColumn` varchar(256),
	`status` enum('pending','processing','done','failed') NOT NULL DEFAULT 'pending',
	`totalRows` int NOT NULL DEFAULT 0,
	`processedRows` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`fileType` varchar(16),
	`columns` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
