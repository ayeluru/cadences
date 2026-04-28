import { pgTable, text, serial, integer, boolean, timestamp, varchar, real, date, index, unique, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Note: Users are managed by Supabase Auth (auth.users table)
// userId columns reference Supabase user IDs (UUIDs as strings)

// ============ Enums ============

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const feedbackTypeEnum = pgEnum("feedback_type", ["bug", "feature_request", "feedback"]);
export const feedbackStatusEnum = pgEnum("feedback_status", [
  "new", "needs_info", "under_review", "duplicate",
  "backlog", "planned", "in_progress",
  "done", "released", "declined"
]);

// Profiles - allow users to organize tasks into different contexts (Work, Personal, Exercise, Demo)
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  userId: varchar("user_id").notNull(),
  isDemo: boolean("is_demo").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("profiles_user_id_slug_unique").on(table.userId, table.slug),
  index("profiles_user_id_idx").on(table.userId),
]);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  parentId: integer("parent_id").references((): any => categories.id, { onDelete: 'set null' }),
  userId: varchar("user_id").notNull(),
  profileId: integer("profile_id").references(() => profiles.id, { onDelete: 'cascade' }),
}, (table) => [
  index("categories_user_id_idx").on(table.userId),
  index("categories_profile_id_idx").on(table.profileId),
]);

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: varchar("user_id").notNull(),
  profileId: integer("profile_id").references(() => profiles.id, { onDelete: 'cascade' }),
}, (table) => [
  index("tags_user_id_idx").on(table.userId),
  index("tags_profile_id_idx").on(table.profileId),
]);

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  
  // Task type: 'interval' (every X days), 'frequency' (X times per week/month), 'scheduled' (specific days/times)
  taskType: text("task_type").default('interval').notNull(),
  
  // For interval-based tasks (every X days/weeks/months/years)
  intervalValue: integer("interval_value"),
  intervalUnit: text("interval_unit"), // 'days', 'weeks', 'months', 'years'
  
  // For frequency-based tasks (X times per period)
  targetCount: integer("target_count"), // e.g., 3
  targetPeriod: text("target_period"), // 'week', 'month'
  
  // For scheduled tasks - when this task should occur
  // Days of week: 0=Sunday, 1=Monday, ..., 6=Saturday (stored as comma-separated, e.g., "1,3,5")
  scheduledDaysOfWeek: text("scheduled_days_of_week"),
  // Days of month: 1-31 (stored as comma-separated, e.g., "1,15" for 1st and 15th)
  scheduledDaysOfMonth: text("scheduled_days_of_month"),
  // Time of day in HH:MM format (e.g., "09:00")
  scheduledTime: text("scheduled_time"),
  // Specific dates in YYYY-MM-DD format (stored as comma-separated for one-time or recurring annual dates)
  scheduledDates: text("scheduled_dates"),
  
  // For task variations - parent task that this variation fulfills
  parentTaskId: integer("parent_task_id").references((): any => tasks.id, { onDelete: 'set null' }),
  
  // Profile this task belongs to
  profileId: integer("profile_id").references(() => profiles.id, { onDelete: 'cascade' }),
  
  // Refractory period - minimum time between completions counting toward frequency target (in minutes)
  // For frequency tasks, prevents gaming by doing all reps back-to-back
  refractoryMinutes: integer("refractory_minutes"),
  
  lastCompletedAt: timestamp("last_completed_at"),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: 'set null' }),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  isArchived: boolean("is_archived").default(false),
}, (table) => [
  index("tasks_user_id_idx").on(table.userId),
  index("tasks_profile_id_idx").on(table.profileId),
]);

export const taskTags = pgTable("task_tags", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  tagId: integer("tag_id").references(() => tags.id, { onDelete: 'cascade' }).notNull(),
}, (table) => [
  unique("task_tags_task_id_tag_id_unique").on(table.taskId, table.tagId),
]);

// Define what metrics to track for each task (e.g., weight, sets, reps)
export const taskMetrics = pgTable("task_metrics", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  name: text("name").notNull(), // e.g., "weight", "sets", "reps", "front_left_tire"
  unit: text("unit"), // e.g., "lbs", "psi"
  dataType: text("data_type").default('number').notNull(), // 'number', 'text'
}, (table) => [
  index("task_metrics_task_id_idx").on(table.taskId),
]);

// Task variations - different ways to complete a task (e.g., Goblet Squats, Back Squats for a "Squats" task)
export const taskVariations = pgTable("task_variations", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("task_variations_task_id_idx").on(table.taskId),
]);

export const completions = pgTable("completions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  notes: text("notes"),
  variationId: integer("variation_id").references(() => taskVariations.id, { onDelete: 'set null' }),
}, (table) => [
  index("completions_task_id_idx").on(table.taskId),
]);

// Store actual metric values recorded during completion
export const metricValues = pgTable("metric_values", {
  id: serial("id").primaryKey(),
  completionId: integer("completion_id").references(() => completions.id, { onDelete: 'cascade' }).notNull(),
  metricId: integer("metric_id").references(() => taskMetrics.id, { onDelete: 'cascade' }).notNull(),
  numericValue: real("numeric_value"),
  textValue: text("text_value"),
}, (table) => [
  index("metric_values_completion_id_idx").on(table.completionId),
  index("metric_values_metric_id_idx").on(table.metricId),
]);

// Task streaks - track consecutive completions
export const taskStreaks = pgTable("task_streaks", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar("user_id").notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastCompletedAt: timestamp("last_completed_at"),
  streakStartDate: timestamp("streak_start_date"),
  totalCompletions: integer("total_completions").default(0).notNull(),
}, (table) => [
  index("task_streaks_task_id_idx").on(table.taskId),
]);

// ============ Roles & Feedback Tables ============

export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  grantedBy: varchar("granted_by"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("user_roles_user_id_unique").on(table.userId),
  index("user_roles_user_id_idx").on(table.userId),
]);

export const feedbackSubmissions = pgTable("feedback_submissions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  type: feedbackTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  status: feedbackStatusEnum("status").default("new").notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  adminResponse: text("admin_response"),
  adminResponseBy: varchar("admin_response_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("feedback_submissions_user_id_idx").on(table.userId),
  index("feedback_submissions_status_idx").on(table.status),
  index("feedback_submissions_is_public_idx").on(table.isPublic),
]);

export const feedbackVotes = pgTable("feedback_votes", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  feedbackId: integer("feedback_id").references(() => feedbackSubmissions.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("feedback_votes_user_feedback_unique").on(table.userId, table.feedbackId),
  index("feedback_votes_feedback_id_idx").on(table.feedbackId),
]);

export const feedbackComments = pgTable("feedback_comments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  feedbackId: integer("feedback_id").references(() => feedbackSubmissions.id, { onDelete: 'cascade' }).notNull(),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  isOfficialResponse: boolean("is_official_response").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("feedback_comments_feedback_id_idx").on(table.feedbackId),
]);

export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  timezone: varchar("timezone", { length: 100 }).default("UTC").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("user_settings_user_id_unique").on(table.userId),
  index("user_settings_user_id_idx").on(table.userId),
]);

export const userActivity = pgTable("user_activity", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
}, (table) => [
  unique("user_activity_user_id_unique").on(table.userId),
  index("user_activity_user_id_idx").on(table.userId),
]);

export const taskAssignments = pgTable("task_assignments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 255 }).notNull(),
  plannedDate: date("planned_date").notNull(),
  originalDate: date("original_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("task_assignments_user_id_date_idx").on(table.userId, table.plannedDate),
  index("task_assignments_task_id_idx").on(table.taskId),
]);

// Relations (users managed by Supabase Auth, no ORM relation needed)
export const profilesRelations = relations(profiles, ({ many }) => ({
  tasks: many(tasks),
  categories: many(categories),
  tags: many(tags),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  profile: one(profiles, { fields: [categories.profileId], references: [profiles.id] }),
  parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: "subcategories" }),
  subcategories: many(categories, { relationName: "subcategories" }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  profile: one(profiles, { fields: [tasks.profileId], references: [profiles.id] }),
  category: one(categories, { fields: [tasks.categoryId], references: [categories.id] }),
  parentTask: one(tasks, { fields: [tasks.parentTaskId], references: [tasks.id], relationName: "childTasks" }),
  childTasks: many(tasks, { relationName: "childTasks" }),
  tags: many(taskTags),
  completions: many(completions),
  metrics: many(taskMetrics),
  variations: many(taskVariations),
}));

export const taskVariationsRelations = relations(taskVariations, ({ one }) => ({
  task: one(tasks, { fields: [taskVariations.taskId], references: [tasks.id] }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  profile: one(profiles, { fields: [tags.profileId], references: [profiles.id] }),
  tasks: many(taskTags),
}));

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, { fields: [taskTags.taskId], references: [tasks.id] }),
  tag: one(tags, { fields: [taskTags.tagId], references: [tags.id] }),
}));

export const taskMetricsRelations = relations(taskMetrics, ({ one, many }) => ({
  task: one(tasks, { fields: [taskMetrics.taskId], references: [tasks.id] }),
  values: many(metricValues),
}));

export const completionsRelations = relations(completions, ({ one, many }) => ({
  task: one(tasks, { fields: [completions.taskId], references: [tasks.id] }),
  metricValues: many(metricValues),
}));

export const metricValuesRelations = relations(metricValues, ({ one }) => ({
  completion: one(completions, { fields: [metricValues.completionId], references: [completions.id] }),
  metric: one(taskMetrics, { fields: [metricValues.metricId], references: [taskMetrics.id] }),
}));

export const taskStreaksRelations = relations(taskStreaks, ({ one }) => ({
  task: one(tasks, { fields: [taskStreaks.taskId], references: [tasks.id] }),
}));

// Feedback relations
export const feedbackSubmissionsRelations = relations(feedbackSubmissions, ({ many }) => ({
  votes: many(feedbackVotes),
  comments: many(feedbackComments),
}));

export const feedbackVotesRelations = relations(feedbackVotes, ({ one }) => ({
  feedback: one(feedbackSubmissions, { fields: [feedbackVotes.feedbackId], references: [feedbackSubmissions.id] }),
}));

export const feedbackCommentsRelations = relations(feedbackComments, ({ one }) => ({
  feedback: one(feedbackSubmissions, { fields: [feedbackComments.feedbackId], references: [feedbackSubmissions.id] }),
}));

// Schemas
export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true, userId: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, userId: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true, userId: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, userId: true, createdAt: true, lastCompletedAt: true });
export const insertTaskMetricSchema = createInsertSchema(taskMetrics).omit({ id: true });
export const insertCompletionSchema = createInsertSchema(completions).omit({ id: true, completedAt: true });
export const insertMetricValueSchema = createInsertSchema(metricValues).omit({ id: true });
export const insertTaskVariationSchema = createInsertSchema(taskVariations).omit({ id: true, createdAt: true });

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({ id: true, userId: true, createdAt: true, updatedAt: true });
export const insertTaskAssignmentSchema = createInsertSchema(taskAssignments).omit({ id: true, userId: true, createdAt: true });
export const insertFeedbackSchema = createInsertSchema(feedbackSubmissions).omit({ id: true, userId: true, status: true, isPublic: true, isAnonymous: true, adminResponse: true, adminResponseBy: true, createdAt: true, updatedAt: true });
export const insertFeedbackCommentSchema = createInsertSchema(feedbackComments).omit({ id: true, userId: true, createdAt: true });

// Types
export type Profile = typeof profiles.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskTag = typeof taskTags.$inferSelect;
export type TaskMetric = typeof taskMetrics.$inferSelect;
export type Completion = typeof completions.$inferSelect;
export type MetricValue = typeof metricValues.$inferSelect;
export type TaskVariation = typeof taskVariations.$inferSelect;
export type TaskStreak = typeof taskStreaks.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type FeedbackSubmission = typeof feedbackSubmissions.$inferSelect;
export type FeedbackVote = typeof feedbackVotes.$inferSelect;
export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type UserActivity = typeof userActivity.$inferSelect;
export type FeedbackComment = typeof feedbackComments.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type InsertTaskMetric = z.infer<typeof insertTaskMetricSchema>;
export type InsertMetricValue = z.infer<typeof insertMetricValueSchema>;
export type InsertTaskVariation = z.infer<typeof insertTaskVariationSchema>;
export type InsertTaskAssignment = z.infer<typeof insertTaskAssignmentSchema>;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type InsertFeedbackComment = z.infer<typeof insertFeedbackCommentSchema>;

// Custom Types for API
export type TaskWithDetails = Task & {
  category?: Category | null;
  parentTask?: Task | null;
  tags?: Tag[];
  metrics?: TaskMetric[];
  variations?: TaskVariation[];
  urgency?: number;
  status?: 'overdue' | 'due_soon' | 'later' | 'never_done';
  nextDue?: string;
  daysUntilDue?: number;
  completionsThisPeriod?: number;
  targetProgress?: number; // percentage 0-100
  streak?: TaskStreak | null;
  variationStats?: { variationId: number; name: string; count: number; percentage: number }[];
  completedToday?: boolean;
  effectiveDueToday?: boolean;
  recentCompletionDates?: string[];
};
