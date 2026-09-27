-- Add a selectable organization role without assigning approval authority.
INSERT INTO org_roles (id,name,parent_id)
SELECT lower(hex(randomblob(16))),'Member',NULL
WHERE NOT EXISTS (SELECT 1 FROM org_roles WHERE lower(trim(name))='member');
--> statement-breakpoint
INSERT INTO audit_events (id,actor_id,actor_name,action,entity_id,before_json,after_json,created_at)
SELECT lower(hex(randomblob(16))),'system:migration','System migration','Organization role added','organization','null','{"role":"Member"}',strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE changes()=1;
--> statement-breakpoint
UPDATE organization SET revision=revision+1 WHERE id=1 AND changes()=1;
