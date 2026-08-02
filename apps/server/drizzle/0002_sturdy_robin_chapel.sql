CREATE TABLE "project_default_tags" (
	"project_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "project_default_tags_project_id_tag_id_pk" PRIMARY KEY("project_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "default_assignee_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "default_impact" smallint;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "default_effort" smallint;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "default_confidence" real;--> statement-breakpoint
ALTER TABLE "project_default_tags" ADD CONSTRAINT "project_default_tags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_default_tags" ADD CONSTRAINT "project_default_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_default_assignee_id_users_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_default_impact_range" CHECK ("projects"."default_impact" is null or "projects"."default_impact" between 1 and 5);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_default_effort_range" CHECK ("projects"."default_effort" is null or "projects"."default_effort" between 1 and 5);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_default_confidence_values" CHECK ("projects"."default_confidence" is null or "projects"."default_confidence" in (0, 0.5, 0.8, 1.0));