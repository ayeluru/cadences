CREATE TABLE "user_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_activity_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE INDEX "user_activity_user_id_idx" ON "user_activity" USING btree ("user_id");