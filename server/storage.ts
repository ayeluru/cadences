import { 
  users, categories, tags, tasks, taskTags, completions,
  type User, type Category, type Tag, type Task, type TaskTag, type Completion,
  type InsertCategory, type InsertTag, type InsertTask
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  // Users (handled by auth storage mostly, but good to have access)
  getUser(id: string): Promise<User | undefined>;
  
  // Categories
  getCategories(userId: string): Promise<Category[]>;
  createCategory(userId: string, category: InsertCategory): Promise<Category>;
  deleteCategory(id: number, userId: string): Promise<void>;
  
  // Tags
  getTags(userId: string): Promise<Tag[]>;
  createTag(userId: string, tag: InsertTag): Promise<Tag>;
  
  // Tasks
  getTasks(userId: string): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(userId: string, task: InsertTask, tagIds?: number[]): Promise<Task>;
  updateTask(id: number, updates: Partial<InsertTask>, tagIds?: number[]): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  
  // Completions
  completeTask(taskId: number, completedAt?: Date, notes?: string): Promise<Task>;
  getCompletions(taskId: number): Promise<Completion[]>;
  getAllCompletions(userId: string): Promise<Completion[]>; // For stats

  // Task Tags helpers
  getTaskTags(taskId: number): Promise<Tag[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getCategories(userId: string): Promise<Category[]> {
    return await db.select().from(categories).where(eq(categories.userId, userId));
  }

  async createCategory(userId: string, category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values({ ...category, userId }).returning();
    return newCategory;
  }

  async deleteCategory(id: number, userId: string): Promise<void> {
    // Verify ownership first
    const [cat] = await db.select().from(categories).where(eq(categories.id, id));
    if (!cat || cat.userId !== userId) {
      throw new Error("Category not found or unauthorized");
    }
    // Clear any tasks that reference this category
    await db.update(tasks).set({ categoryId: null }).where(eq(tasks.categoryId, id));
    // Delete the category
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getTags(userId: string): Promise<Tag[]> {
    return await db.select().from(tags).where(eq(tags.userId, userId));
  }

  async createTag(userId: string, tag: InsertTag): Promise<Tag> {
    const [newTag] = await db.insert(tags).values({ ...tag, userId }).returning();
    return newTag;
  }

  async getTasks(userId: string): Promise<Task[]> {
    return await db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.isArchived, false)));
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async createTask(userId: string, task: InsertTask, tagIds?: number[]): Promise<Task> {
    const [newTask] = await db.insert(tasks).values({ ...task, userId }).returning();
    
    if (tagIds && tagIds.length > 0) {
      await db.insert(taskTags).values(
        tagIds.map(tagId => ({ taskId: newTask.id, tagId }))
      );
    }
    
    return newTask;
  }

  async updateTask(id: number, updates: Partial<InsertTask>, tagIds?: number[]): Promise<Task> {
    const [updatedTask] = await db.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
    
    if (tagIds) {
      // Replace tags
      await db.delete(taskTags).where(eq(taskTags.taskId, id));
      if (tagIds.length > 0) {
        await db.insert(taskTags).values(
          tagIds.map(tagId => ({ taskId: id, tagId }))
        );
      }
    }
    
    return updatedTask;
  }

  async deleteTask(id: number): Promise<void> {
    // Soft delete or hard delete? Let's do soft delete via isArchived for safety, 
    // but the schema has isArchived. Let's use that.
    await db.update(tasks).set({ isArchived: true }).where(eq(tasks.id, id));
  }

  async completeTask(taskId: number, completedAt: Date = new Date(), notes?: string): Promise<Task> {
    // 1. Add completion record
    await db.insert(completions).values({
      taskId,
      completedAt,
      notes,
    });

    // 2. Update task's lastCompletedAt
    const [updatedTask] = await db.update(tasks)
      .set({ lastCompletedAt: completedAt })
      .where(eq(tasks.id, taskId))
      .returning();

    return updatedTask;
  }

  async getCompletions(taskId: number): Promise<Completion[]> {
    return await db.select().from(completions)
      .where(eq(completions.taskId, taskId))
      .orderBy(desc(completions.completedAt));
  }

  async getAllCompletions(userId: string): Promise<Completion[]> {
    // Join tasks to filter by user
    const result = await db.select({
      completion: completions,
    })
    .from(completions)
    .innerJoin(tasks, eq(completions.taskId, tasks.id))
    .where(eq(tasks.userId, userId))
    .orderBy(desc(completions.completedAt));
    
    return result.map(r => r.completion);
  }

  async getTaskTags(taskId: number): Promise<Tag[]> {
    const result = await db.select({
      tag: tags
    })
    .from(taskTags)
    .innerJoin(tags, eq(taskTags.tagId, tags.id))
    .where(eq(taskTags.taskId, taskId));
    
    return result.map(r => r.tag);
  }
}

export const storage = new DatabaseStorage();
