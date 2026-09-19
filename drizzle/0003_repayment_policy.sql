ALTER TABLE loans ADD repayment_method text NOT NULL DEFAULT 'auto_deduct';
--> statement-breakpoint
ALTER TABLE loans ADD late_policy text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE loans ADD repayment_revision integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE payments ADD interest_amount integer NOT NULL DEFAULT 0;

