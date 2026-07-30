ALTER TABLE "tasks" DROP CONSTRAINT "tasks_confidence_values";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_confidence_values" CHECK ("tasks"."confidence" in (0, 0.5, 0.8, 1.0));