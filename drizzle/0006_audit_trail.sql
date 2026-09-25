CREATE TABLE audit_events (
 id text PRIMARY KEY NOT NULL,
 actor_id text NOT NULL,
 actor_name text NOT NULL,
 action text NOT NULL,
 entity_id text NOT NULL,
 before_json text NOT NULL,
 after_json text NOT NULL,
 created_at text NOT NULL
);
--> statement-breakpoint
CREATE INDEX audit_events_time_idx ON audit_events (created_at,id);
--> statement-breakpoint
CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'Audit events cannot be edited'); END;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'Audit events cannot be deleted'); END;
