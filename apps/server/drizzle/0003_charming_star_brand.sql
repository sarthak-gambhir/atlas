CREATE TABLE "project_members" (
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill: give every existing project an owner (first admin by creation order).
UPDATE "projects" SET "owner_id" = (
	SELECT "id" FROM "users" WHERE "role" = 'admin' ORDER BY "created_at" LIMIT 1
) WHERE "owner_id" IS NULL;--> statement-breakpoint
-- Backfill: preserve current visibility by making everyone a member of every project.
INSERT INTO "project_members" ("project_id", "user_id")
SELECT p."id", u."id" FROM "projects" p CROSS JOIN "users" u
ON CONFLICT DO NOTHING;