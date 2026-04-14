ALTER TABLE "categories" DROP CONSTRAINT "categories_profile_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "completions" DROP CONSTRAINT "completions_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "metric_values" DROP CONSTRAINT "metric_values_completion_id_completions_id_fk";
--> statement-breakpoint
ALTER TABLE "metric_values" DROP CONSTRAINT "metric_values_metric_id_task_metrics_id_fk";
--> statement-breakpoint
ALTER TABLE "tags" DROP CONSTRAINT "tags_profile_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "task_metrics" DROP CONSTRAINT "task_metrics_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "task_streaks" DROP CONSTRAINT "task_streaks_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "task_tags" DROP CONSTRAINT "task_tags_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "task_tags" DROP CONSTRAINT "task_tags_tag_id_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "task_variations" DROP CONSTRAINT "task_variations_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_profile_id_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_variation_id_task_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."task_variations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_completion_id_completions_id_fk" FOREIGN KEY ("completion_id") REFERENCES "public"."completions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_metric_id_task_metrics_id_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."task_metrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_metrics" ADD CONSTRAINT "task_metrics_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_streaks" ADD CONSTRAINT "task_streaks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_variations" ADD CONSTRAINT "task_variations_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_task_id_tasks_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_user_id_idx" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "categories_profile_id_idx" ON "categories" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "completions_task_id_idx" ON "completions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "metric_values_completion_id_idx" ON "metric_values" USING btree ("completion_id");--> statement-breakpoint
CREATE INDEX "metric_values_metric_id_idx" ON "metric_values" USING btree ("metric_id");--> statement-breakpoint
CREATE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tags_user_id_idx" ON "tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tags_profile_id_idx" ON "tags" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "task_metrics_task_id_idx" ON "task_metrics" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_streaks_task_id_idx" ON "task_streaks" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_variations_task_id_idx" ON "task_variations" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "tasks_user_id_idx" ON "tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_profile_id_idx" ON "tasks" USING btree ("profile_id");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_slug_unique" UNIQUE("user_id","slug");--> statement-breakpoint
ALTER TABLE "task_tags" ADD CONSTRAINT "task_tags_task_id_tag_id_unique" UNIQUE("task_id","tag_id");