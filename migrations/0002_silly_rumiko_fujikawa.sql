CREATE TYPE "public"."feedback_status" AS ENUM('new', 'under_review', 'planned', 'in_progress', 'done', 'declined');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('bug', 'feature_request', 'feedback');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "feedback_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"feedback_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feedback_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"type" "feedback_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"status" "feedback_status" DEFAULT 'new' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"admin_response" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "feedback_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"feedback_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "feedback_votes_user_feedback_unique" UNIQUE("user_id","feedback_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"granted_by" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_roles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_feedback_id_feedback_submissions_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_votes" ADD CONSTRAINT "feedback_votes_feedback_id_feedback_submissions_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_comments_feedback_id_idx" ON "feedback_comments" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "feedback_submissions_user_id_idx" ON "feedback_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_submissions_status_idx" ON "feedback_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedback_submissions_is_public_idx" ON "feedback_submissions" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "feedback_votes_feedback_id_idx" ON "feedback_votes" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "user_roles_user_id_idx" ON "user_roles" USING btree ("user_id");