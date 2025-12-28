import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  parentId: integer("parent_id"), // Self-reference for hierarchy
  userId: varchar("user_id").references(() => users.id).notNull(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  intervalValue: integer("interval_value").notNull(),
  intervalUnit: text("interval_unit").notNull(), // 'days', 'weeks', 'months', 'years'
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

export const completions = pgTable("completions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => tasks.id).notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  notes: text("notes"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
  categories: many(categories),
  tags: many(tags),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: "subcategories" }),
  subcategories: many(categories, { relationName: "subcategories" }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
  category: one(categories, { fields: [tasks.categoryId], references: [categories.id] }),
  tags: many(taskTags),
  completions: many(completions),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, { fields: [tags.userId], references: [users.id] }),
  tasks: many(taskTags),
}));

export const taskTagsRelations = relations(taskTags, ({ one }) => ({
  task: one(tasks, { fields: [taskTags.taskId], references: [tasks.id] }),
  tag: one(tags, { fields: [taskTags.tagId], references: [tags.id] }),
}));

export const completionsRelations = relations(completions, ({ one }) => ({
  task: one(tasks, { fields: [completions.taskId], references: [tasks.id] }),
}));

// Schemas
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, userId: true });
export const insertTagSchema = createInsertSchema(tags).omit({ id: true, userId: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, userId: true, createdAt: true, lastCompletedAt: true });
export const insertCompletionSchema = createInsertSchema(completions).omit({ id: true, completedAt: true });

// Types
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskTag = typeof taskTags.$inferSelect;
export type Completion = typeof completions.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertTag = z.infer<typeof insertTagSchema>;

// Custom Types for API
export type TaskWithDetails = Task & {
  category?: Category | null;
  tags?: Tag[];
  urgency?: number; // Calculated field
  status?: 'overdue' | 'due_soon' | 'later' | 'never_done';
  nextDue?: string; // ISO date
  daysUntilDue?: number;
};
