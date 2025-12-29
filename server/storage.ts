import { 
  users, categories, tags, tasks, taskTags, completions, routines, taskMetrics, metricValues, taskStreaks,
  type User, type Category, type Tag, type Task, type TaskTag, type Completion,
  type Routine, type TaskMetric, type MetricValue, type TaskStreak,
  type InsertCategory, type InsertTag, type InsertTask, type InsertRoutine,
  type InsertTaskMetric, type InsertMetricValue
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  
  // Categories
  getCategories(userId: string): Promise<Category[]>;
  createCategory(userId: string, category: InsertCategory): Promise<Category>;
  deleteCategory(id: number, userId: string): Promise<void>;
  
  // Tags
  getTags(userId: string): Promise<Tag[]>;
  createTag(userId: string, tag: InsertTag): Promise<Tag>;
  
  // Routines
  getRoutines(userId: string): Promise<Routine[]>;
  createRoutine(userId: string, routine: InsertRoutine): Promise<Routine>;
  deleteRoutine(id: number, userId: string): Promise<void>;
  
  // Tasks
  getTasks(userId: string): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  getTaskVariations(parentId: number): Promise<Task[]>;
  createTask(userId: string, task: InsertTask, tagIds?: number[], metrics?: InsertTaskMetric[]): Promise<Task>;
  updateTask(id: number, updates: Partial<InsertTask>, tagIds?: number[], metrics?: InsertTaskMetric[]): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  
  // Task Metrics
  getTaskMetrics(taskId: number): Promise<TaskMetric[]>;
  createTaskMetric(metric: InsertTaskMetric): Promise<TaskMetric>;
  deleteTaskMetrics(taskId: number): Promise<void>;
  
  // Completions
  completeTask(taskId: number, completedAt?: Date, notes?: string, metricData?: {metricId: number, value: number | string}[], userId?: string): Promise<{task: Task, completion: Completion, streak?: TaskStreak}>;
  getCompletions(taskId: number): Promise<Completion[]>;
  getAllCompletions(userId: string): Promise<Completion[]>;
  getCompletionsInPeriod(taskId: number, startDate: Date, endDate: Date): Promise<Completion[]>;
  
  // Metric Values
  getMetricValues(completionId: number): Promise<MetricValue[]>;
  getMetricHistory(metricId: number, limit?: number): Promise<{value: number | string, completedAt: Date}[]>;

  // Task Tags helpers
  getTaskTags(taskId: number): Promise<Tag[]>;
  
  // Streaks
  getTaskStreak(taskId: number, userId: string): Promise<TaskStreak | undefined>;
  updateTaskStreak(taskId: number, userId: string, task: Task, completedAt: Date): Promise<TaskStreak>;
  getAllStreaks(userId: string): Promise<TaskStreak[]>;
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

  // Routines
  async getRoutines(userId: string): Promise<Routine[]> {
    return await db.select().from(routines).where(eq(routines.userId, userId));
  }

  async createRoutine(userId: string, routine: InsertRoutine): Promise<Routine> {
    const [newRoutine] = await db.insert(routines).values({ ...routine, userId }).returning();
    return newRoutine;
  }

  async deleteRoutine(id: number, userId: string): Promise<void> {
    const [routine] = await db.select().from(routines).where(eq(routines.id, id));
    if (!routine || routine.userId !== userId) {
      throw new Error("Routine not found or unauthorized");
    }
    // Clear routineId from tasks
    await db.update(tasks).set({ routineId: null }).where(eq(tasks.routineId, id));
    await db.delete(routines).where(eq(routines.id, id));
  }

  // Task Variations
  async getTaskVariations(parentId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(and(eq(tasks.parentTaskId, parentId), eq(tasks.isArchived, false)));
  }

  // Task Metrics
  async getTaskMetrics(taskId: number): Promise<TaskMetric[]> {
    return await db.select().from(taskMetrics).where(eq(taskMetrics.taskId, taskId));
  }

  async createTaskMetric(metric: InsertTaskMetric): Promise<TaskMetric> {
    const [newMetric] = await db.insert(taskMetrics).values(metric).returning();
    return newMetric;
  }

  async deleteTaskMetrics(taskId: number): Promise<void> {
    await db.delete(taskMetrics).where(eq(taskMetrics.taskId, taskId));
  }

  async completeTask(
    taskId: number, 
    completedAt: Date = new Date(), 
    notes?: string,
    metricData?: {metricId: number, value: number | string}[],
    userId?: string
  ): Promise<{task: Task, completion: Completion, streak?: TaskStreak}> {
    // Get the task to check if it's a variation
    const task = await this.getTask(taskId);
    
    // Add completion record
    const [completion] = await db.insert(completions).values({
      taskId,
      completedAt,
      notes,
      parentTaskId: task?.parentTaskId || null,
    }).returning();

    // Add metric values if provided
    if (metricData && metricData.length > 0) {
      await db.insert(metricValues).values(
        metricData.map(m => ({
          completionId: completion.id,
          metricId: m.metricId,
          numericValue: typeof m.value === 'number' ? m.value : null,
          textValue: typeof m.value === 'string' ? m.value : null,
        }))
      );
    }

    // Update task's lastCompletedAt
    const [updatedTask] = await db.update(tasks)
      .set({ lastCompletedAt: completedAt })
      .where(eq(tasks.id, taskId))
      .returning();

    // If this is a variation, also update parent task's lastCompletedAt
    if (task?.parentTaskId) {
      await db.update(tasks)
        .set({ lastCompletedAt: completedAt })
        .where(eq(tasks.id, task.parentTaskId));
    }

    // Update streak if userId provided
    let streak: TaskStreak | undefined;
    if (userId && task) {
      streak = await this.updateTaskStreak(taskId, userId, task, completedAt);
      
      // Also update parent task streak if this is a variation
      if (task.parentTaskId) {
        const parentTask = await this.getTask(task.parentTaskId);
        if (parentTask) {
          await this.updateTaskStreak(task.parentTaskId, userId, parentTask, completedAt);
        }
      }
    }

    return { task: updatedTask, completion, streak };
  }

  async getCompletions(taskId: number): Promise<Completion[]> {
    return await db.select().from(completions)
      .where(eq(completions.taskId, taskId))
      .orderBy(desc(completions.completedAt));
  }

  async getAllCompletions(userId: string): Promise<Completion[]> {
    const result = await db.select({
      completion: completions,
    })
    .from(completions)
    .innerJoin(tasks, eq(completions.taskId, tasks.id))
    .where(eq(tasks.userId, userId))
    .orderBy(desc(completions.completedAt));
    
    return result.map(r => r.completion);
  }

  async getCompletionsInPeriod(taskId: number, startDate: Date, endDate: Date): Promise<Completion[]> {
    return await db.select().from(completions)
      .where(and(
        eq(completions.taskId, taskId),
        gte(completions.completedAt, startDate),
        sql`${completions.completedAt} <= ${endDate}`
      ))
      .orderBy(desc(completions.completedAt));
  }

  // Metric Values
  async getMetricValues(completionId: number): Promise<MetricValue[]> {
    return await db.select().from(metricValues).where(eq(metricValues.completionId, completionId));
  }

  async getMetricHistory(metricId: number, limit: number = 50): Promise<{value: number | string, completedAt: Date}[]> {
    const result = await db.select({
      numericValue: metricValues.numericValue,
      textValue: metricValues.textValue,
      completedAt: completions.completedAt,
    })
    .from(metricValues)
    .innerJoin(completions, eq(metricValues.completionId, completions.id))
    .where(eq(metricValues.metricId, metricId))
    .orderBy(desc(completions.completedAt))
    .limit(limit);
    
    return result.map(r => ({
      value: r.numericValue !== null ? r.numericValue : (r.textValue || ''),
      completedAt: r.completedAt,
    }));
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

  // Streak methods
  async getTaskStreak(taskId: number, userId: string): Promise<TaskStreak | undefined> {
    const [streak] = await db.select().from(taskStreaks)
      .where(and(eq(taskStreaks.taskId, taskId), eq(taskStreaks.userId, userId)));
    return streak;
  }

  async getAllStreaks(userId: string): Promise<TaskStreak[]> {
    return await db.select().from(taskStreaks)
      .where(eq(taskStreaks.userId, userId))
      .orderBy(desc(taskStreaks.currentStreak));
  }

  async updateTaskStreak(taskId: number, userId: string, task: Task, completedAt: Date): Promise<TaskStreak> {
    // Get current streak or create new one
    let streak = await this.getTaskStreak(taskId, userId);
    
    // Get interval in days for this task to determine if streak is broken
    const intervalDays = this.getIntervalInDays(task);
    
    // Calculate streak based on completion date
    const now = completedAt;
    
    if (!streak) {
      // First completion - create streak record
      const [newStreak] = await db.insert(taskStreaks).values({
        taskId,
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastCompletedAt: now,
        streakStartDate: now,
        totalCompletions: 1,
      }).returning();
      return newStreak;
    }

    // Calculate if streak continues or breaks
    const lastCompletion = streak.lastCompletedAt;
    const daysSinceLastCompletion = lastCompletion 
      ? Math.floor((now.getTime() - lastCompletion.getTime()) / (1000 * 60 * 60 * 24))
      : Infinity;

    // Streak continues if completed within the grace window (interval + 50% buffer)
    const graceWindow = Math.max(intervalDays * 1.5, intervalDays + 1);
    const streakContinues = daysSinceLastCompletion <= graceWindow;

    let newCurrentStreak: number;
    let newStreakStartDate: Date;

    if (streakContinues && daysSinceLastCompletion >= 0.5) {
      // Streak continues - increment
      newCurrentStreak = streak.currentStreak + 1;
      newStreakStartDate = streak.streakStartDate || now;
    } else if (daysSinceLastCompletion < 0.5) {
      // Same day completion - don't increment streak
      newCurrentStreak = streak.currentStreak;
      newStreakStartDate = streak.streakStartDate || now;
    } else {
      // Streak broken - reset to 1
      newCurrentStreak = 1;
      newStreakStartDate = now;
    }

    const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

    const [updatedStreak] = await db.update(taskStreaks)
      .set({
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastCompletedAt: now,
        streakStartDate: newStreakStartDate,
        totalCompletions: streak.totalCompletions + 1,
      })
      .where(eq(taskStreaks.id, streak.id))
      .returning();

    return updatedStreak;
  }

  private getIntervalInDays(task: Task): number {
    // For frequency tasks, use target period
    if (task.taskType === 'frequency') {
      return task.targetPeriod === 'week' ? 7 : 30;
    }
    
    // For interval tasks
    const value = task.intervalValue || 1;
    const unit = task.intervalUnit || 'days';
    
    switch (unit) {
      case 'days': return value;
      case 'weeks': return value * 7;
      case 'months': return value * 30;
      case 'years': return value * 365;
      default: return value;
    }
  }
}

export const storage = new DatabaseStorage();
