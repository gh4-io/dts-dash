CREATE TABLE `aircraft` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registration` text NOT NULL,
	`sp_id` integer,
	`guid` text,
	`aircraft_type` text,
	`aircraft_model_id` integer,
	`operator_id` integer,
	`manufacturer_id` integer,
	`engine_type_id` integer,
	`serial_number` text,
	`age` text,
	`lessor` text,
	`category` text,
	`operator_raw` text,
	`operator_match_confidence` integer,
	`source` text DEFAULT 'inferred' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	FOREIGN KEY (`aircraft_model_id`) REFERENCES `aircraft_models`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`engine_type_id`) REFERENCES `engine_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aircraft_registration_unique` ON `aircraft` (`registration`);--> statement-breakpoint
CREATE UNIQUE INDEX `aircraft_sp_id_unique` ON `aircraft` (`sp_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `aircraft_guid_unique` ON `aircraft` (`guid`);--> statement-breakpoint
CREATE INDEX `aircraft_operator_idx` ON `aircraft` (`operator_id`);--> statement-breakpoint
CREATE INDEX `aircraft_source_idx` ON `aircraft` (`source`);--> statement-breakpoint
CREATE INDEX `aircraft_model_idx` ON `aircraft` (`aircraft_model_id`);--> statement-breakpoint
CREATE TABLE `aircraft_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_code` text NOT NULL,
	`canonical_type` text NOT NULL,
	`manufacturer_id` integer,
	`display_name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`manufacturer_id`) REFERENCES `manufacturers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `aircraft_models_model_code_unique` ON `aircraft_models` (`model_code`);--> statement-breakpoint
CREATE TABLE `aircraft_type_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pattern` text NOT NULL,
	`canonical_type` text NOT NULL,
	`description` text,
	`priority` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`event_data` text,
	`page` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ae_user_created` ON `analytics_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `app_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cron_job_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_key` text NOT NULL,
	`last_run_at` text,
	`last_run_status` text,
	`last_run_message` text,
	`run_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cron_job_runs_job_key_unique` ON `cron_job_runs` (`job_key`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`color` text NOT NULL,
	`color_text` text DEFAULT '#ffffff' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`country` text,
	`established` text,
	`group_parent` text,
	`base_airport` text,
	`website` text,
	`moc_phone` text,
	`iata_code` text,
	`icao_code` text,
	`sp_id` integer,
	`guid` text,
	`source` text DEFAULT 'inferred' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` integer,
	`updated_by` integer,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_name_unique` ON `customers` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_sp_id_unique` ON `customers` (`sp_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `customers_guid_unique` ON `customers` (`guid`);--> statement-breakpoint
CREATE TABLE `engine_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`manufacturer` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `engine_types_name_unique` ON `engine_types` (`name`);--> statement-breakpoint
CREATE TABLE `feedback_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`parent_id` integer,
	`author_id` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `feedback_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_feedback_comments_post` ON `feedback_comments` (`post_id`);--> statement-breakpoint
CREATE TABLE `feedback_labels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_labels_name_unique` ON `feedback_labels` (`name`);--> statement-breakpoint
CREATE TABLE `feedback_post_labels` (
	`post_id` integer NOT NULL,
	`label_id` integer NOT NULL,
	PRIMARY KEY(`post_id`, `label_id`),
	FOREIGN KEY (`post_id`) REFERENCES `feedback_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `feedback_labels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_feedback_post_labels_post` ON `feedback_post_labels` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_feedback_post_labels_label` ON `feedback_post_labels` (`label_id`);--> statement-breakpoint
CREATE TABLE `feedback_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_id` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_feedback_posts_author` ON `feedback_posts` (`author_id`);--> statement-breakpoint
CREATE INDEX `idx_feedback_posts_status` ON `feedback_posts` (`status`);--> statement-breakpoint
CREATE INDEX `idx_feedback_posts_created` ON `feedback_posts` (`created_at`);--> statement-breakpoint
CREATE TABLE `import_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`imported_at` text NOT NULL,
	`record_count` integer NOT NULL,
	`source` text NOT NULL,
	`file_name` text,
	`imported_by` integer NOT NULL,
	`status` text NOT NULL,
	`errors` text,
	`idempotency_key` text,
	FOREIGN KEY (`imported_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invite_codes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`created_by` integer NOT NULL,
	`max_uses` integer DEFAULT 1 NOT NULL,
	`current_uses` integer DEFAULT 0 NOT NULL,
	`expires_at` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_codes_code_unique` ON `invite_codes` (`code`);--> statement-breakpoint
CREATE INDEX `idx_invite_codes_code` ON `invite_codes` (`code`);--> statement-breakpoint
CREATE TABLE `manufacturers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `manufacturers_name_unique` ON `manufacturers` (`name`);--> statement-breakpoint
CREATE TABLE `master_data_import_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`imported_at` text NOT NULL,
	`data_type` text NOT NULL,
	`source` text NOT NULL,
	`format` text NOT NULL,
	`file_name` text,
	`records_total` integer NOT NULL,
	`records_added` integer NOT NULL,
	`records_updated` integer NOT NULL,
	`records_skipped` integer NOT NULL,
	`imported_by` integer NOT NULL,
	`status` text NOT NULL,
	`warnings` text,
	`errors` text,
	FOREIGN KEY (`imported_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mh_overrides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`work_package_id` integer NOT NULL,
	`override_mh` real NOT NULL,
	`updated_by` integer NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`work_package_id`) REFERENCES `work_packages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mh_overrides_work_package_id_unique` ON `mh_overrides` (`work_package_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_token` text,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_session_token_unique` ON `sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `unified_import_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`imported_at` text NOT NULL,
	`data_type` text NOT NULL,
	`source` text NOT NULL,
	`format` text NOT NULL,
	`file_name` text,
	`imported_by` integer NOT NULL,
	`status` text NOT NULL,
	`records_total` integer NOT NULL,
	`records_inserted` integer DEFAULT 0 NOT NULL,
	`records_updated` integer DEFAULT 0 NOT NULL,
	`records_skipped` integer DEFAULT 0 NOT NULL,
	`field_mapping` text,
	`warnings` text,
	`errors` text,
	`idempotency_key` text,
	FOREIGN KEY (`imported_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`color_mode` text DEFAULT 'dark' NOT NULL,
	`theme_preset` text DEFAULT 'vitepress' NOT NULL,
	`accent_color` text,
	`compact_mode` integer DEFAULT false NOT NULL,
	`default_timezone` text DEFAULT 'UTC' NOT NULL,
	`default_date_range` text,
	`default_zoom` text,
	`time_format` text DEFAULT '24h' NOT NULL,
	`table_page_size` integer DEFAULT 30 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auth_id` text NOT NULL,
	`email` text NOT NULL,
	`username` text,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`force_password_change` integer DEFAULT false NOT NULL,
	`token_version` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_auth_id_unique` ON `users` (`auth_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `work_packages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guid` text NOT NULL,
	`sp_id` integer,
	`title` text,
	`aircraft_reg` text NOT NULL,
	`aircraft_type` text,
	`customer` text NOT NULL,
	`customer_ref` text,
	`flight_id` text,
	`arrival` text NOT NULL,
	`departure` text NOT NULL,
	`total_mh` real,
	`total_ground_hours` text,
	`status` text DEFAULT 'New' NOT NULL,
	`description` text,
	`parent_id` text,
	`has_workpackage` integer,
	`workpackage_no` text,
	`calendar_comments` text,
	`is_not_closed_or_canceled` text,
	`document_set_id` integer,
	`aircraft_sp_id` integer,
	`customer_sp_id` integer,
	`sp_modified` text,
	`sp_created` text,
	`sp_version` text,
	`import_log_id` integer,
	`imported_at` text NOT NULL,
	FOREIGN KEY (`import_log_id`) REFERENCES `import_log`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_packages_guid_unique` ON `work_packages` (`guid`);--> statement-breakpoint
CREATE UNIQUE INDEX `work_packages_sp_id_unique` ON `work_packages` (`sp_id`);--> statement-breakpoint
CREATE INDEX `idx_wp_arrival` ON `work_packages` (`arrival`);--> statement-breakpoint
CREATE INDEX `idx_wp_departure` ON `work_packages` (`departure`);--> statement-breakpoint
CREATE INDEX `idx_wp_customer` ON `work_packages` (`customer`);--> statement-breakpoint
CREATE INDEX `idx_wp_aircraft_reg` ON `work_packages` (`aircraft_reg`);--> statement-breakpoint
CREATE INDEX `idx_wp_import_log` ON `work_packages` (`import_log_id`);--> statement-breakpoint
CREATE INDEX `idx_wp_status` ON `work_packages` (`status`);--> statement-breakpoint
CREATE INDEX `idx_wp_arrival_departure` ON `work_packages` (`arrival`,`departure`);--> statement-breakpoint
CREATE INDEX `idx_wp_customer_arrival` ON `work_packages` (`customer`,`arrival`);