import { pgTable, text, serial, integer, boolean, timestamp, varchar, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

// Profiles - allow users to organize tasks into different contexts (Work, Personal, Exercise, Demo)
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(), // URL-friendly identifier
  userId: varchar("user_id").references(() => users.id).notNull(),
  isDemo: boolean("is_demo").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  userId: varchar("user_id").references(() => users.id).notNull(),
  profileId: integer("profile_id").references(() => profiles.id),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  profileId: integer("profile_id").references(() => profiles.id),
});

// Routines - group of exercises/tasks done together
export const routines = pgTable("routines", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  userId: varchar("user_id").references(() => users.id).notNull(),
  profileId: integer("profile_id").references(() => profiles.id),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  parentTaskId: integer("parent_task_id"),
  
  // Routine this task belongs to (optional)
  routineId: integer("routine_id"),
  
  // Profile this task belongs to
  profileId: integer("profile_id").references(() => profiles.id),
  
  // Refractory period - minimum time between completions counting toward frequency target (in minutes)
  // For frequency tasks, prevents gaming by doing all reps back-to-back
  refractoryMinutes: integer("refractory_minutes"),
  
  lastCompletedAt: timestamp("last_completed_at"),
  categoryId: integer("category_id").references(() => categories.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  isArchived: boolean("is_archived").default(false),
});

export const taskTags = pgTable("task_tags", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  tagId: integer("tag_id").references(() => tags.id).notNull(),
});

// Define what metrics to track for each task (e.g., weight, sets, reps)
export const taskMetrics = pgTable("task_metrics", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  name: text("name").notNull(), // e.g., "weight", "sets", "reps", "front_left_tire"
  unit: text("unit"), // e.g., "lbs", "psi"
  dataType: text("data_type").default('number').notNull(), // 'number', 'text'
});

export const completions = pgTable("completions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  notes: text("notes"),
  // For variations - which parent task this completion counts toward
  parentTaskId: integer("parent_task_id"),
});

// Store actual metric values recorded during completion
export const metricValues = pgTable("metric_values", {
  id: serial("id").primaryKey(),
  completionId: integer("completion_id").references(() => completions.id).notNull(),
  metricId: integer("metric_id").references(() => taskMetrics.id).notNull(),
  numericValue: real("numeric_value"),
  textValue: text("text_value"),
});

// Relations
export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
  tasks: many(tasks),
  categories: many(categories),
  tags: many(tags),
  routines: many(routines),
}));

export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
  categories: many(categories),
  tags: many(tags),
  routines: many(routines),
  profiles: many(profiles),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  profile: one(profiles, { fields: [categories.profileId], references: [profiles.id] }),
  parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: "subcategories" }),
  subcategories: many(categories, { relationName: "subcategories" }),
  tasks: many(tasks),
}));

export const routinesRelations = relations(routines, ({ one, many }) => ({
  user: one(users, { fields: [routines.userId], references: [users.id] }),
  profile: one(profiles, { fields: [routines.profileId], references: [profiles.id] }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  profile: one(profiles, { fields: [tasks.profileId], references: [profiles.id] }),
  category: one(categories, { fields: [tasks.categoryId], references: [categories.id] }),
  routine: one(routines, { fields: [tasks.routineId], references: [routines.id] }),
  parentTask: one(tasks, { fields: [tasks.parentTaskId], references: [tasks.id], relationName: "variations" }),
  variations: many(tasks, { relationName: "variations" }),
  tags: many(taskTags),
  completions: many(completions),
  metrics: many(taskMetrics),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, { fields: [tags.userId], references: [users.id] }),
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

// Schemas
export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true, userId: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, userId: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true, userId: true });
export const insertRoutineSchema = createInsertSchema(routines).omit({ id: true, userId: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, userId: true, createdAt: true, lastCompletedAt: true });
export const insertTaskMetricSchema = createInsertSchema(taskMetrics).omit({ id: true });
export const insertCompletionSchema = createInsertSchema(completions).omit({ id: true, completedAt: true });
export const insertMetricValueSchema = createInsertSchema(metricValues).omit({ id: true });

// Types
export type Profile = typeof profiles.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskTag = typeof taskTags.$inferSelect;
export type TaskMetric = typeof taskMetrics.$inferSelect;
export type Completion = typeof completions.$inferSelect;
export type MetricValue = typeof metricValues.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type InsertRoutine = z.infer<typeof insertRoutineSchema>;
export type InsertTaskMetric = z.infer<typeof insertTaskMetricSchema>;
export type InsertMetricValue = z.infer<typeof insertMetricValueSchema>;

// Task streaks - track consecutive completions
export const taskStreaks = pgTable("task_streaks", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  longestStreak: integer("longest_streak").default(0).notNull(),
  lastCompletedAt: timestamp("last_completed_at"),
  streakStartDate: timestamp("streak_start_date"),
  totalCompletions: integer("total_completions").default(0).notNull(),
});

export const taskStreaksRelations = relations(taskStreaks, ({ one }) => ({
  task: one(tasks, { fields: [taskStreaks.taskId], references: [tasks.id] }),
  user: one(users, { fields: [taskStreaks.userId], references: [users.id] }),
}));

export type TaskStreak = typeof taskStreaks.$inferSelect;

// Custom Types for API
export type TaskWithDetails = Task & {
  category?: Category | null;
  routine?: Routine | null;
  parentTask?: Task | null;
  variations?: Task[];
  tags?: Tag[];
  metrics?: TaskMetric[];
  urgency?: number;
  status?: 'overdue' | 'due_soon' | 'later' | 'never_done';
  nextDue?: string;
  daysUntilDue?: number;
  // For frequency tasks - progress toward target
  completionsThisPeriod?: number;
  targetProgress?: number; // percentage 0-100
  // Streak data
  streak?: TaskStreak | null;
};
