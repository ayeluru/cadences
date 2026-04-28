ALTER TABLE "tasks" ADD COLUMN "is_paused" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "paused_until" timestamp;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "resumed_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "vacation_mode" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "vacation_until" timestamp;