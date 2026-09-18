CREATE TABLE `approval_routes` (
	`type_id` text NOT NULL,
	`position` integer NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`type_id`, `position`),
	FOREIGN KEY (`type_id`) REFERENCES `loan_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `org_roles`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `loan_approvals` (
	`loan_id` text NOT NULL,
	`position` integer NOT NULL,
	`role_id` text NOT NULL,
	`role_name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_by` text,
	`decided_at` text,
	`reason` text,
	PRIMARY KEY(`loan_id`, `position`),
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `org_roles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE INDEX `loan_approvals_role_idx` ON `loan_approvals` (`role_id`,`loan_id`);
--> statement-breakpoint
CREATE TABLE `loan_documents` (
	`loan_id` text NOT NULL,
	`document_id` text NOT NULL,
	PRIMARY KEY(`loan_id`, `document_id`),
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `loan_documents_document_id_unique` ON `loan_documents` (`document_id`);
--> statement-breakpoint
CREATE INDEX `loan_documents_loan_idx` ON `loan_documents` (`loan_id`);
--> statement-breakpoint
CREATE TABLE `loan_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX `loan_types_name_unique` ON `loan_types` (`name`);
--> statement-breakpoint
CREATE TABLE `member_roles` (
	`member_id` text NOT NULL,
	`role_id` text NOT NULL,
	PRIMARY KEY(`member_id`, `role_id`),
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `org_roles`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TABLE `org_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	FOREIGN KEY (`parent_id`) REFERENCES `org_roles`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE UNIQUE INDEX `org_roles_name_unique` ON `org_roles` (`name`);
--> statement-breakpoint
CREATE TABLE `organization` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);

--> statement-breakpoint
INSERT INTO organization (id,name) VALUES (1,'My union');
INSERT INTO org_roles (id,name) VALUES ('workspace-admin','Workspace administrator');
INSERT INTO member_roles (member_id,role_id) SELECT id,'workspace-admin' FROM members WHERE role='admin';
INSERT INTO loan_types (id,name) VALUES ('personal','Personal loan'),('emergency','Emergency loan'),('education','Education loan');
INSERT INTO approval_routes (type_id,position,role_id) SELECT id,1,'workspace-admin' FROM loan_types;
INSERT INTO loan_approvals (loan_id,position,role_id,role_name) SELECT id,1,'workspace-admin','Workspace administrator' FROM loans WHERE status='pending';
