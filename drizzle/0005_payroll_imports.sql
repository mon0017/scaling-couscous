CREATE TABLE payroll_imports (
 id text PRIMARY KEY NOT NULL,
 filename text NOT NULL,
 recorded_by text NOT NULL REFERENCES members(id),
 created_at text NOT NULL,
 row_count integer NOT NULL,
 total integer NOT NULL,
 skipped integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE payments ADD COLUMN source text NOT NULL DEFAULT 'manual';
--> statement-breakpoint
ALTER TABLE payments ADD COLUMN import_id text REFERENCES payroll_imports(id);
--> statement-breakpoint
ALTER TABLE payments ADD COLUMN recorded_at text;
