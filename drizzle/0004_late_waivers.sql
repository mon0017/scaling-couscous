ALTER TABLE organization ADD COLUMN default_late_rate_bps integer NOT NULL DEFAULT 300;
--> statement-breakpoint
ALTER TABLE loans ADD COLUMN late_waivers text NOT NULL DEFAULT '[]';
