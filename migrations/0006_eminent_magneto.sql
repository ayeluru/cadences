ALTER TYPE "public"."feedback_status" ADD VALUE IF NOT EXISTS 'needs_info' BEFORE 'under_review';--> statement-breakpoint
ALTER TYPE "public"."feedback_status" ADD VALUE IF NOT EXISTS 'duplicate' BEFORE 'planned';--> statement-breakpoint
ALTER TYPE "public"."feedback_status" ADD VALUE IF NOT EXISTS 'backlog' BEFORE 'planned';--> statement-breakpoint
ALTER TYPE "public"."feedback_status" ADD VALUE IF NOT EXISTS 'released' BEFORE 'declined';