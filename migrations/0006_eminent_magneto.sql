ALTER TYPE "public"."feedback_status" ADD VALUE 'needs_info' BEFORE 'under_review';--> statement-breakpoint
ALTER TYPE "public"."feedback_status" ADD VALUE 'duplicate' BEFORE 'planned';--> statement-breakpoint
ALTER TYPE "public"."feedback_status" ADD VALUE 'backlog' BEFORE 'planned';--> statement-breakpoint
ALTER TYPE "public"."feedback_status" ADD VALUE 'released' BEFORE 'declined';