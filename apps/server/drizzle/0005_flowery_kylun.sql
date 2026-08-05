ALTER TABLE "tasks" RENAME COLUMN "due_date" TO "due_end_date";--> statement-breakpoint
ALTER INDEX "tasks_due_idx" RENAME TO "tasks_due_end_idx";--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "due_start_date" date;--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "estimate_hours";--> statement-breakpoint
CREATE INDEX "tasks_due_start_idx" ON "tasks" USING btree ("due_start_date");
