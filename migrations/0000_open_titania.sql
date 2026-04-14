CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_id" integer,
	"user_id" varchar NOT NULL,
	"profile_id" integer
);
--> statement-breakpoint
CREATE TABLE "completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"variation_id" integer
);
--> statement-breakpoint
CREATE TABLE "metric_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"completion_id" integer NOT NULL,
	"metric_id" integer NOT NULL,
	"numeric_value" real,
	"text_value" text
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"user_id" varchar NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"user_id" varchar NOT NULL,
	"profile_id" integer
);
--> statement-breakpoint
CREATE TABLE "task_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"data_type" text DEFAULT 'number' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_streaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_completed_at" timestamp,
	"streak_start_date" timestamp,
	"total_completions" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"tag_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_variations" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"task_type" text DEFAULT 'interval' NOT NULL,
	"interval_value" integer,
	"interval_unit" text,
	"target_count" integer,
	"target_period" text,
	"scheduled_days_of_week" text,
	"scheduled_days_of_month" text,
	"scheduled_time" text,
	"scheduled_dates" text,
	"parent_task_id" integer,
	"profile_id" integer,
	"refractory_minutes" integer,
	"last_completed_at" timestamp,
	"category_id" integer,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"is_archived" boolean DEFAULT false
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_completion_id_completions_id_fk" FOREIGN KEY ("completion_id") REFERENCES "public"."completions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_metric_id_task_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."task_metrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_metrics" ADD CONSTRAINT "task_metrics_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_streaks" ADD CONSTRAINT "task_streaks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_variations" ADD CONSTRAINT "task_variations_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;