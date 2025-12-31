import { 
  users, categories, tags, tasks, taskTags, completions, taskMetrics, metricValues, taskStreaks, profiles,
  type User, type Category, type Tag, type Task, type TaskTag, type Completion,
  type TaskMetric, type MetricValue, type TaskStreak, type Profile,
  type InsertCategory, type InsertTag, type InsertTask,
  type InsertTaskMetric, type InsertMetricValue, type InsertProfile
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte, inArray, notInArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  
  // Profiles
  getProfiles(userId: string): Promise<Profile[]>;
  getProfile(id: number, userId: string): Promise<Profile | undefined>;
  createProfile(userId: string, profile: InsertProfile): Promise<Profile>;
  updateProfile(id: number, userId: string, updates: Partial<InsertProfile>): Promise<Profile>;
  deleteProfile(id: number, userId: string): Promise<void>;
  deleteProfileData(profileId: number, userId: string): Promise<void>;
  getOrCreateDefaultProfile(userId: string): Promise<Profile>;
  
  // Categories (profileId: null = all profiles, number = specific profile)
  getCategories(userId: string, profileId?: number | null): Promise<Category[]>;
  createCategory(userId: string, category: InsertCategory): Promise<Category>;
  deleteCategory(id: number, userId: string): Promise<void>;
  
  // Tags (profileId: null = all profiles, number = specific profile)
  getTags(userId: string, profileId?: number | null): Promise<Tag[]>;
  createTag(userId: string, tag: InsertTag): Promise<Tag>;
  
  // Tasks (profileId: null = all profiles, number = specific profile)
  getTasks(userId: string, profileId?: number | null, excludeDemo?: boolean): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  getTaskVariations(parentId: number): Promise<Task[]>;
  createTask(userId: string, task: InsertTask, tagIds?: number[], metrics?: InsertTaskMetric[]): Promise<Task>;
  updateTask(id: number, updates: Partial<InsertTask>, tagIds?: number[], metrics?: InsertTaskMetric[]): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  deleteTaskWithCascade(id: number, userId: string): Promise<void>;
  archiveTask(id: number, userId: string): Promise<Task>;
  
  // Task Metrics
  getTaskMetrics(taskId: number): Promise<TaskMetric[]>;
  getTaskMetric(metricId: number): Promise<TaskMetric | undefined>;
  createTaskMetric(metric: InsertTaskMetric): Promise<TaskMetric>;
  deleteTaskMetric(metricId: number): Promise<void>;
  deleteTaskMetrics(taskId: number): Promise<void>;
  
  // Completions
  completeTask(taskId: number, completedAt?: Date, notes?: string, metricData?: {metricId: number, value: number | string}[], userId?: string): Promise<{task: Task, completion: Completion, streak?: TaskStreak}>;
  getCompletions(taskId: number): Promise<Completion[]>;
  getCompletionWithMetrics(completionId: number): Promise<{completion: Completion, metrics: MetricValue[]} | undefined>;
  getAllCompletions(userId: string): Promise<Completion[]>;
  getCompletionsInPeriod(taskId: number, startDate: Date, endDate: Date): Promise<Completion[]>;
  getCompletionsForCalendar(userId: string, startDate: Date, endDate: Date, profileId?: number, excludeDemo?: boolean): Promise<{date: string, count: number, tasks: {id: number, title: string, completedAt: string}[]}[]>;
  deleteCompletion(completionId: number, userId: string): Promise<void>;
  
  // Metric Values
  getMetricValues(completionId: number): Promise<MetricValue[]>;
  getMetricHistory(metricId: number, limit?: number): Promise<{value: number | string, completedAt: Date}[]>;

  // Task Tags helpers
  getTaskTags(taskId: number): Promise<Tag[]>;
  
  // Streaks
  getTaskStreak(taskId: number, userId: string): Promise<TaskStreak | undefined>;
  updateTaskStreak(taskId: number, userId: string, task: Task, completedAt: Date): Promise<TaskStreak>;
  getAllStreaks(userId: string): Promise<TaskStreak[]>;
  
  // Task Migration
  reassignTaskToProfile(taskId: number, targetProfileId: number, userId: string): Promise<Task>;
  migrateTasksToProfile(taskIds: number[], targetProfileId: number, userId: string): Promise<Task[]>;
  
  // Profile Import
  importTasksFromProfile(sourceProfileId: number, targetProfileId: number, userId: string): Promise<{ tasksCreated: number, categoriesCreated: number, tagsCreated: number }>;
}

export class DatabaseStorage implements IStorage {
  
  // Comprehensive seed data for testing
  async seedUserData(userId: string): Promise<{ success: boolean, message: string }> {
    // Check if user already has tasks
    const existingTasks = await this.getTasks(userId);
    if (existingTasks.length > 0) {
      return { success: false, message: "User already has data. Delete existing tasks first." };
    }

    const now = new Date();
    
    // Create categories
    const householdCat = await this.createCategory(userId, { name: "Household" });
    const healthCat = await this.createCategory(userId, { name: "Health & Hygiene" });
    const exerciseCat = await this.createCategory(userId, { name: "Exercise" });
    const carCat = await this.createCategory(userId, { name: "Car Maintenance" });
    const financeCat = await this.createCategory(userId, { name: "Finance" });

    // Create tags
    const urgentTag = await this.createTag(userId, { name: "Urgent" });
    const quickTag = await this.createTag(userId, { name: "Quick" });
    const outdoorsTag = await this.createTag(userId, { name: "Outdoors" });

    // Helper to create dates in the past (deterministic based on day offset)
    const daysAgo = (days: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      // Use deterministic hour based on day offset (8am-7pm spread)
      d.setHours(8 + (days % 12), (days * 7) % 60, 0, 0);
      return d;
    };

    // ============ DAILY TASKS ============
    
    // Brush Teeth - Perfect streak (14 days)
    const brushTeeth = await this.createTask(userId, {
      title: "Brush Teeth",
      description: "Morning and night",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "days",
      categoryId: healthCat.id,
      isArchived: false
    });
    for (let i = 14; i >= 0; i--) {
      await this.completeTaskWithStreak(brushTeeth.id, userId, brushTeeth, daysAgo(i));
    }

    // Take Vitamins - Sporadic (about 50% completion - deterministic pattern)
    const vitamins = await this.createTask(userId, {
      title: "Take Daily Vitamins",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "days",
      categoryId: healthCat.id,
      isArchived: false
    });
    for (let i = 30; i >= 0; i--) {
      // Deterministic 50% pattern: skip every other day with offset
      if (i % 2 === 0 || i % 5 === 0) {
        await this.completeTaskWithStreak(vitamins.id, userId, vitamins, daysAgo(i));
      }
    }

    // Morning Journaling - Recently started (5 day streak)
    const journal = await this.createTask(userId, {
      title: "Morning Journaling",
      description: "Write 3 pages",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "days",
      categoryId: healthCat.id,
      isArchived: false
    });
    for (let i = 4; i >= 0; i--) {
      await this.completeTaskWithStreak(journal.id, userId, journal, daysAgo(i));
    }

    // Meditation - Broken streak (was good, then stopped)
    const meditation = await this.createTask(userId, {
      title: "Meditation",
      description: "10 minutes mindfulness",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "days",
      categoryId: healthCat.id,
      isArchived: false
    });
    // Was consistent 20-30 days ago
    for (let i = 30; i >= 20; i--) {
      await this.completeTaskWithStreak(meditation.id, userId, meditation, daysAgo(i));
    }
    // Then sporadic 10-20 days ago
    for (let i = 19; i >= 10; i--) {
      if (i % 3 === 0) {
        await this.completeTaskWithStreak(meditation.id, userId, meditation, daysAgo(i));
      }
    }
    // Then stopped completely

    // ============ WEEKLY TASKS ============

    // Laundry - Good streak (8 completions over 8 weeks)
    const laundry = await this.createTask(userId, {
      title: "Do Laundry",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "weeks",
      categoryId: householdCat.id,

      isArchived: false
    });
    for (let week = 8; week >= 0; week--) {
      await this.completeTaskWithStreak(laundry.id, userId, laundry, daysAgo(week * 7 + (week % 2)));
    }

    // Vacuum House - Missed last week
    const vacuum = await this.createTask(userId, {
      title: "Vacuum House",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "weeks",
      categoryId: householdCat.id,

      isArchived: false
    });
    for (let week = 10; week >= 2; week--) {
      await this.completeTaskWithStreak(vacuum.id, userId, vacuum, daysAgo(week * 7));
    }

    // Grocery Shopping - Very consistent
    const groceries = await this.createTask(userId, {
      title: "Grocery Shopping",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "weeks",
      categoryId: householdCat.id,
      isArchived: false
    }, [quickTag.id]);
    for (let week = 12; week >= 0; week--) {
      await this.completeTaskWithStreak(groceries.id, userId, groceries, daysAgo(week * 7 + 1));
    }

    // Mow Lawn - Seasonal (more recent in summer)
    const mowLawn = await this.createTask(userId, {
      title: "Mow Lawn",
      taskType: "interval",
      intervalValue: 2,
      intervalUnit: "weeks",
      categoryId: householdCat.id,
      isArchived: false
    }, [outdoorsTag.id]);
    for (let i = 0; i < 6; i++) {
      await this.completeTaskWithStreak(mowLawn.id, userId, mowLawn, daysAgo(i * 14 + 3));
    }

    // ============ MONTHLY TASKS ============

    // Change HVAC Filter - Perfect (3 completions over 3 months)
    const hvac = await this.createTask(userId, {
      title: "Change HVAC Filter",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "months",
      categoryId: householdCat.id,
      isArchived: false
    }, [urgentTag.id]);
    for (let month = 3; month >= 1; month--) {
      await this.completeTaskWithStreak(hvac.id, userId, hvac, daysAgo(month * 30));
    }

    // Check Smoke Detectors - Overdue (last done 2 months ago)
    const smokeDetectors = await this.createTask(userId, {
      title: "Check Smoke Detectors",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "months",
      categoryId: householdCat.id,
      isArchived: false
    }, [urgentTag.id]);
    await this.completeTaskWithStreak(smokeDetectors.id, userId, smokeDetectors, daysAgo(60));

    // Clean Refrigerator - Never done
    await this.createTask(userId, {
      title: "Clean Refrigerator",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "months",
      categoryId: householdCat.id,
      isArchived: false
    });

    // Pay Rent - Very consistent
    const rent = await this.createTask(userId, {
      title: "Pay Rent",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "months",
      categoryId: financeCat.id,
      isArchived: false
    }, [urgentTag.id]);
    for (let month = 6; month >= 0; month--) {
      await this.completeTaskWithStreak(rent.id, userId, rent, daysAgo(month * 30 + 1));
    }

    // ============ LONG-TERM TASKS ============

    // Oil Change - Every 3 months
    const oilChange = await this.createTask(userId, {
      title: "Oil Change",
      description: "Every 3000-5000 miles or 3 months",
      taskType: "interval",
      intervalValue: 3,
      intervalUnit: "months",
      categoryId: carCat.id,
      isArchived: false
    });
    const oilMileageMetric = await this.createTaskMetric({ taskId: oilChange.id, name: "Mileage", unit: "miles", dataType: "number" });
    await this.completeTaskWithStreak(oilChange.id, userId, oilChange, daysAgo(85), undefined, [{ metricId: oilMileageMetric.id, value: 45230 }]);
    await this.completeTaskWithStreak(oilChange.id, userId, oilChange, daysAgo(2), undefined, [{ metricId: oilMileageMetric.id, value: 48150 }]);

    // Check Tire Pressure - Monthly with metrics
    const tirePressure = await this.createTask(userId, {
      title: "Check Tire Pressure",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "months",
      categoryId: carCat.id,
      isArchived: false
    });
    const flMetric = await this.createTaskMetric({ taskId: tirePressure.id, name: "Front Left", unit: "psi", dataType: "number" });
    const frMetric = await this.createTaskMetric({ taskId: tirePressure.id, name: "Front Right", unit: "psi", dataType: "number" });
    const rlMetric = await this.createTaskMetric({ taskId: tirePressure.id, name: "Rear Left", unit: "psi", dataType: "number" });
    const rrMetric = await this.createTaskMetric({ taskId: tirePressure.id, name: "Rear Right", unit: "psi", dataType: "number" });
    
    // Historical tire pressure readings (deterministic)
    for (let month = 3; month >= 0; month--) {
      const baseP = 32 + (month % 3);
      await this.completeTaskWithStreak(tirePressure.id, userId, tirePressure, daysAgo(month * 30), undefined, [
        { metricId: flMetric.id, value: baseP + (month % 2) },
        { metricId: frMetric.id, value: baseP + 1 },
        { metricId: rlMetric.id, value: baseP - 1 },
        { metricId: rrMetric.id, value: baseP },
      ]);
    }

    // Rotate Tires - Every 6 months
    const rotateTires = await this.createTask(userId, {
      title: "Rotate Tires",
      taskType: "interval",
      intervalValue: 6,
      intervalUnit: "months",
      categoryId: carCat.id,
      isArchived: false
    });
    await this.completeTaskWithStreak(rotateTires.id, userId, rotateTires, daysAgo(180));

    // Annual Physical - Yearly
    const physical = await this.createTask(userId, {
      title: "Annual Physical",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "years",
      categoryId: healthCat.id,
      isArchived: false
    });
    await this.completeTaskWithStreak(physical.id, userId, physical, daysAgo(320));

    // Dentist Checkup - Every 6 months
    const dentist = await this.createTask(userId, {
      title: "Dentist Checkup",
      taskType: "interval",
      intervalValue: 6,
      intervalUnit: "months",
      categoryId: healthCat.id,
      isArchived: false
    });
    await this.completeTaskWithStreak(dentist.id, userId, dentist, daysAgo(150));

    // ============ FREQUENCY-BASED TASKS ============

    // Exercise 3x per week (parent with variations)
    const exercise = await this.createTask(userId, {
      title: "Exercise",
      description: "Any workout counts",
      taskType: "frequency",
      targetCount: 3,
      targetPeriod: "week",
      categoryId: exerciseCat.id,
      isArchived: false
    });

    // Cardio variation
    const cardio = await this.createTask(userId, {
      title: "Cardio",
      description: "Running, cycling, or swimming",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "days",
      parentTaskId: exercise.id,
      categoryId: exerciseCat.id,
      isArchived: false
    });
    const cardioDistanceMetric = await this.createTaskMetric({ taskId: cardio.id, name: "Distance", unit: "miles", dataType: "number" });
    const cardioDurationMetric = await this.createTaskMetric({ taskId: cardio.id, name: "Duration", unit: "min", dataType: "number" });
    
    // Strength Training variation
    const strength = await this.createTask(userId, {
      title: "Strength Training",
      description: "Weights and resistance",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "days",
      parentTaskId: exercise.id,
      categoryId: exerciseCat.id,
      isArchived: false
    });

    // Squats - frequency target 3x/week
    const squats = await this.createTask(userId, {
      title: "Squats",
      taskType: "frequency",
      targetCount: 3,
      targetPeriod: "week",
      categoryId: exerciseCat.id,

      isArchived: false
    });

    // Back Squat variation
    const backSquat = await this.createTask(userId, {
      title: "Back Squat",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "days",
      parentTaskId: squats.id,
      categoryId: exerciseCat.id,

      isArchived: false
    });
    const bsWeightMetric = await this.createTaskMetric({ taskId: backSquat.id, name: "Weight", unit: "lbs", dataType: "number" });
    const bsSetsMetric = await this.createTaskMetric({ taskId: backSquat.id, name: "Sets", unit: "", dataType: "number" });
    const bsRepsMetric = await this.createTaskMetric({ taskId: backSquat.id, name: "Reps", unit: "", dataType: "number" });

    // Goblet Squat variation
    const gobletSquat = await this.createTask(userId, {
      title: "Goblet Squat",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "days",
      parentTaskId: squats.id,
      categoryId: exerciseCat.id,

      isArchived: false
    });
    const gsWeightMetric = await this.createTaskMetric({ taskId: gobletSquat.id, name: "Weight", unit: "lbs", dataType: "number" });
    const gsSetsMetric = await this.createTaskMetric({ taskId: gobletSquat.id, name: "Sets", unit: "", dataType: "number" });
    const gsRepsMetric = await this.createTaskMetric({ taskId: gobletSquat.id, name: "Reps", unit: "", dataType: "number" });

    // Lunges in leg day
    const lunges = await this.createTask(userId, {
      title: "Walking Lunges",
      taskType: "frequency",
      targetCount: 2,
      targetPeriod: "week",
      categoryId: exerciseCat.id,

      isArchived: false
    });

    // Add exercise completions over past 8 weeks with progression (deterministic)
    for (let week = 8; week >= 0; week--) {
      // Cardio sessions (2-3 per week - deterministic)
      const cardioCount = 2 + (week % 2);
      for (let i = 0; i < cardioCount; i++) {
        const dist = 2.5 + (week % 3) * 0.5 + (8 - week) * 0.1;
        const dur = 20 + (week % 10) + (8 - week);
        await this.completeTaskWithStreak(cardio.id, userId, cardio, daysAgo(week * 7 + i * 2 + 1), undefined, [
          { metricId: cardioDistanceMetric.id, value: Math.round(dist * 10) / 10 },
          { metricId: cardioDurationMetric.id, value: dur },
        ]);
      }

      // Strength sessions (most weeks)
      if (week % 3 !== 2) {
        await this.completeTaskWithStreak(strength.id, userId, strength, daysAgo(week * 7 + 4));
      }

      // Squat variations (alternate between back and goblet)
      const sqWeight = 135 + (8 - week) * 5; // Progressive weight
      if (week % 2 === 0) {
        await this.completeTaskWithStreak(backSquat.id, userId, backSquat, daysAgo(week * 7 + 2), undefined, [
          { metricId: bsWeightMetric.id, value: sqWeight },
          { metricId: bsSetsMetric.id, value: 4 },
          { metricId: bsRepsMetric.id, value: 8 },
        ]);
        await this.completeTaskWithStreak(gobletSquat.id, userId, gobletSquat, daysAgo(week * 7 + 5), undefined, [
          { metricId: gsWeightMetric.id, value: 50 },
          { metricId: gsSetsMetric.id, value: 3 },
          { metricId: gsRepsMetric.id, value: 12 },
        ]);
      } else {
        await this.completeTaskWithStreak(backSquat.id, userId, backSquat, daysAgo(week * 7 + 3), undefined, [
          { metricId: bsWeightMetric.id, value: sqWeight },
          { metricId: bsSetsMetric.id, value: 5 },
          { metricId: bsRepsMetric.id, value: 5 },
        ]);
      }

      // Lunges (1-2 per week, deterministic pattern - skip week 4 and 7)
      if (week !== 4 && week !== 7) {
        await this.completeTaskWithStreak(lunges.id, userId, lunges, daysAgo(week * 7 + 3));
        if (week % 2 === 0) {
          await this.completeTaskWithStreak(lunges.id, userId, lunges, daysAgo(week * 7 + 6));
        }
      }
    }

    // Read Books - 2x per month (frequency)
    const readBooks = await this.createTask(userId, {
      title: "Finish a Book",
      taskType: "frequency",
      targetCount: 2,
      targetPeriod: "month",
      categoryId: healthCat.id,
      isArchived: false
    });
    // Completed 1 this month
    await this.completeTaskWithStreak(readBooks.id, userId, readBooks, daysAgo(5));

    // Water Plants - Twice weekly (frequency)
    const waterPlants = await this.createTask(userId, {
      title: "Water Plants",
      taskType: "frequency",
      targetCount: 2,
      targetPeriod: "week",
      categoryId: householdCat.id,
      isArchived: false
    });
    // Fairly consistent (skip second watering week 3 and 5)
    for (let week = 6; week >= 0; week--) {
      await this.completeTaskWithStreak(waterPlants.id, userId, waterPlants, daysAgo(week * 7 + 1));
      if (week !== 3 && week !== 5) {
        await this.completeTaskWithStreak(waterPlants.id, userId, waterPlants, daysAgo(week * 7 + 4));
      }
    }

    // Blood Pressure Check - Weekly with metrics
    const bloodPressure = await this.createTask(userId, {
      title: "Check Blood Pressure",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "weeks",
      categoryId: healthCat.id,
      isArchived: false
    });
    const systolicMetric = await this.createTaskMetric({ taskId: bloodPressure.id, name: "Systolic", unit: "mmHg", dataType: "number" });
    const diastolicMetric = await this.createTaskMetric({ taskId: bloodPressure.id, name: "Diastolic", unit: "mmHg", dataType: "number" });
    const pulseMetric = await this.createTaskMetric({ taskId: bloodPressure.id, name: "Pulse", unit: "bpm", dataType: "number" });
    
    for (let week = 10; week >= 0; week--) {
      await this.completeTaskWithStreak(bloodPressure.id, userId, bloodPressure, daysAgo(week * 7), undefined, [
        { metricId: systolicMetric.id, value: 118 + (week % 8) },
        { metricId: diastolicMetric.id, value: 75 + (week % 5) },
        { metricId: pulseMetric.id, value: 68 + (week % 7) },
      ]);
    }

    return { 
      success: true, 
      message: "Created 25+ tasks with 90+ days of history and metric tracking!" 
    };
  }

  // Clear all user data (for resetting before seeding)
  async clearUserData(userId: string): Promise<void> {
    // Get all user's tasks
    const userTasks = await db.select().from(tasks).where(eq(tasks.userId, userId));
    const taskIds = userTasks.map(t => t.id);

    if (taskIds.length > 0) {
      // Delete metric values for completions of these tasks
      const taskCompletions = await db.select().from(completions).where(
        inArray(completions.taskId, taskIds)
      );
      const completionIds = taskCompletions.map(c => c.id);
      
      if (completionIds.length > 0) {
        await db.delete(metricValues).where(
          inArray(metricValues.completionId, completionIds)
        );
      }

      // Delete completions
      await db.delete(completions).where(
        inArray(completions.taskId, taskIds)
      );

      // Delete task metrics
      await db.delete(taskMetrics).where(
        inArray(taskMetrics.taskId, taskIds)
      );

      // Delete task tags
      await db.delete(taskTags).where(
        inArray(taskTags.taskId, taskIds)
      );

      // Delete streaks
      await db.delete(taskStreaks).where(eq(taskStreaks.userId, userId));

      // Delete tasks (hard delete for reset)
      await db.delete(tasks).where(eq(tasks.userId, userId));
    }


    // Delete tags
    await db.delete(tags).where(eq(tags.userId, userId));

    // Delete categories
    await db.delete(categories).where(eq(categories.userId, userId));
  }

  // Helper method to complete task and update streak
  private async completeTaskWithStreak(
    taskId: number, 
    userId: string, 
    task: Task, 
    completedAt: Date,
    notes?: string,
    metricData?: {metricId: number, value: number | string}[]
  ): Promise<void> {
    // Add completion record
    const [completion] = await db.insert(completions).values({
      taskId,
      completedAt,
      notes,
      parentTaskId: task.parentTaskId || null,
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

    // Update task's lastCompletedAt only if this completion is more recent
    const currentTask = await this.getTask(taskId);
    if (!currentTask?.lastCompletedAt || completedAt > currentTask.lastCompletedAt) {
      await db.update(tasks)
        .set({ lastCompletedAt: completedAt })
        .where(eq(tasks.id, taskId));
    }

    // If this is a variation, also update parent task's lastCompletedAt (only if more recent)
    if (task.parentTaskId) {
      const parentTask = await this.getTask(task.parentTaskId);
      if (!parentTask?.lastCompletedAt || completedAt > parentTask.lastCompletedAt) {
        await db.update(tasks)
          .set({ lastCompletedAt: completedAt })
          .where(eq(tasks.id, task.parentTaskId));
      }
    }

    // Update streak
    await this.updateTaskStreak(taskId, userId, task, completedAt);
    
    // Also update parent task streak if this is a variation
    if (task.parentTaskId) {
      const parentTask = await this.getTask(task.parentTaskId);
      if (parentTask) {
        await this.updateTaskStreak(task.parentTaskId, userId, parentTask, completedAt);
      }
    }
  }
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  // Profile methods
  async getProfiles(userId: string): Promise<Profile[]> {
    return await db.select().from(profiles).where(eq(profiles.userId, userId));
  }

  async getProfile(id: number, userId: string): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles)
      .where(and(eq(profiles.id, id), eq(profiles.userId, userId)));
    return profile;
  }

  async createProfile(userId: string, profile: InsertProfile): Promise<Profile> {
    const [newProfile] = await db.insert(profiles)
      .values({ ...profile, userId })
      .returning();
    return newProfile;
  }

  async updateProfile(id: number, userId: string, updates: Partial<InsertProfile>): Promise<Profile> {
    const [profile] = await db.select().from(profiles)
      .where(and(eq(profiles.id, id), eq(profiles.userId, userId)));
    if (!profile) {
      throw new Error("Profile not found or unauthorized");
    }
    const [updated] = await db.update(profiles)
      .set(updates)
      .where(eq(profiles.id, id))
      .returning();
    return updated;
  }

  async deleteProfile(id: number, userId: string): Promise<void> {
    const [profile] = await db.select().from(profiles)
      .where(and(eq(profiles.id, id), eq(profiles.userId, userId)));
    if (!profile) {
      throw new Error("Profile not found or unauthorized");
    }
    
    // Get all tasks in this profile
    const profileTasks = await db.select().from(tasks)
      .where(and(eq(tasks.profileId, id), eq(tasks.userId, userId)));
    const taskIds = profileTasks.map(t => t.id);
    
    if (taskIds.length > 0) {
      // Delete completions and their metric values
      const taskCompletions = await db.select().from(completions)
        .where(inArray(completions.taskId, taskIds));
      const completionIds = taskCompletions.map(c => c.id);
      
      if (completionIds.length > 0) {
        await db.delete(metricValues).where(inArray(metricValues.completionId, completionIds));
      }
      await db.delete(completions).where(inArray(completions.taskId, taskIds));
      await db.delete(taskMetrics).where(inArray(taskMetrics.taskId, taskIds));
      await db.delete(taskTags).where(inArray(taskTags.taskId, taskIds));
      await db.delete(taskStreaks).where(inArray(taskStreaks.taskId, taskIds));
      await db.delete(tasks).where(inArray(tasks.id, taskIds));
    }
    
    // Delete categories and tags in this profile
    await db.delete(categories).where(and(eq(categories.profileId, id), eq(categories.userId, userId)));
    await db.delete(tags).where(and(eq(tags.profileId, id), eq(tags.userId, userId)));
    
    // Delete the profile itself
    await db.delete(profiles).where(eq(profiles.id, id));
  }

  async deleteProfileData(profileId: number, userId: string): Promise<void> {
    const [profile] = await db.select().from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)));
    if (!profile) {
      throw new Error("Profile not found or unauthorized");
    }
    
    // Get all tasks in this profile
    const profileTasks = await db.select().from(tasks)
      .where(and(eq(tasks.profileId, profileId), eq(tasks.userId, userId)));
    const taskIds = profileTasks.map(t => t.id);
    
    if (taskIds.length > 0) {
      // Delete completions and their metric values
      const taskCompletions = await db.select().from(completions)
        .where(inArray(completions.taskId, taskIds));
      const completionIds = taskCompletions.map(c => c.id);
      
      if (completionIds.length > 0) {
        await db.delete(metricValues).where(inArray(metricValues.completionId, completionIds));
      }
      await db.delete(completions).where(inArray(completions.taskId, taskIds));
      await db.delete(taskMetrics).where(inArray(taskMetrics.taskId, taskIds));
      await db.delete(taskTags).where(inArray(taskTags.taskId, taskIds));
      await db.delete(taskStreaks).where(inArray(taskStreaks.taskId, taskIds));
      await db.delete(tasks).where(inArray(tasks.id, taskIds));
    }
    
    // Delete categories and tags in this profile (but keep the profile itself)
    await db.delete(categories).where(and(eq(categories.profileId, profileId), eq(categories.userId, userId)));
    await db.delete(tags).where(and(eq(tags.profileId, profileId), eq(tags.userId, userId)));
  }

  async deleteAllProfilesData(userId: string): Promise<void> {
    // Get all profiles for this user
    const userProfiles = await this.getProfiles(userId);
    
    // Clear data from each profile
    for (const profile of userProfiles) {
      await this.deleteProfileData(profile.id, userId);
    }
  }

  async getOrCreateDefaultProfile(userId: string): Promise<Profile> {
    // Check if user has any profiles
    const existingProfiles = await this.getProfiles(userId);
    if (existingProfiles.length > 0) {
      // Return the first non-demo profile, or the first one if all are demo
      const nonDemoProfile = existingProfiles.find(p => !p.isDemo);
      return nonDemoProfile || existingProfiles[0];
    }
    
    // Create default profile
    return await this.createProfile(userId, {
      name: "Personal",
      slug: "personal",
      isDemo: false
    });
  }

  // Seed demo profile with comprehensive sample data demonstrating all features
  async seedDemoProfile(userId: string, profileId: number): Promise<{ success: boolean, message: string }> {
    const now = new Date();
    
    // Helper to create dates in the past with some time variation
    const daysAgo = (days: number, hourOffset: number = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      d.setHours(8 + hourOffset + (days % 6), (days * 11) % 60, 0, 0);
      return d;
    };

    // ===== CATEGORIES =====
    const [householdCat] = await db.insert(categories).values({ name: "Household", userId, profileId }).returning();
    const [healthCat] = await db.insert(categories).values({ name: "Health & Hygiene", userId, profileId }).returning();
    const [exerciseCat] = await db.insert(categories).values({ name: "Exercise", userId, profileId }).returning();
    const [carCat] = await db.insert(categories).values({ name: "Car Maintenance", userId, profileId }).returning();
    const [financeCat] = await db.insert(categories).values({ name: "Finance", userId, profileId }).returning();
    const [petsCat] = await db.insert(categories).values({ name: "Pet Care", userId, profileId }).returning();
    const [gardenCat] = await db.insert(categories).values({ name: "Garden & Outdoor", userId, profileId }).returning();

    // ===== TAGS =====
    const [urgentTag] = await db.insert(tags).values({ name: "Urgent", userId, profileId }).returning();
    const [quickTag] = await db.insert(tags).values({ name: "Quick", userId, profileId }).returning();
    const [outdoorsTag] = await db.insert(tags).values({ name: "Outdoors", userId, profileId }).returning();
    const [weekendTag] = await db.insert(tags).values({ name: "Weekend", userId, profileId }).returning();
    const [morningTag] = await db.insert(tags).values({ name: "Morning", userId, profileId }).returning();
    const [nightTag] = await db.insert(tags).values({ name: "Night", userId, profileId }).returning();

    // ===== DAILY TASKS WITH STREAKS =====
    
    // 1. Brush Teeth - Perfect 30+ day streak
    const [brushTeeth] = await db.insert(tasks).values({
      title: "Brush Teeth",
      description: "Morning and night dental hygiene",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "days",
      categoryId: healthCat.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    await db.insert(taskTags).values([{ taskId: brushTeeth.id, tagId: quickTag.id }, { taskId: brushTeeth.id, tagId: morningTag.id }]);
    for (let i = 35; i >= 0; i--) {
      await this.completeTaskWithStreak(brushTeeth.id, userId, brushTeeth, daysAgo(i));
    }

    // 2. Take Vitamins - 15 day streak
    const [takeVitamins] = await db.insert(tasks).values({
      title: "Take Vitamins",
      description: "Daily multivitamin and fish oil",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "days",
      categoryId: healthCat.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    await db.insert(taskTags).values([{ taskId: takeVitamins.id, tagId: quickTag.id }, { taskId: takeVitamins.id, tagId: morningTag.id }]);
    for (let i = 15; i >= 0; i--) {
      await this.completeTaskWithStreak(takeVitamins.id, userId, takeVitamins, daysAgo(i));
    }

    // 3. Meditate - Broken streak (last done 3 days ago, was 5 day streak before that)
    const [meditate] = await db.insert(tasks).values({
      title: "Meditate",
      description: "10 minutes of mindfulness",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "days",
      categoryId: healthCat.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    await db.insert(taskTags).values([{ taskId: meditate.id, tagId: nightTag.id }]);
    for (let i = 8; i >= 3; i--) {
      await this.completeTaskWithStreak(meditate.id, userId, meditate, daysAgo(i));
    }

    // 4. Feed Dog - Perfect streak with metrics (weight of food)
    const [feedDog] = await db.insert(tasks).values({
      title: "Feed Dog",
      description: "Morning and evening feeding",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "days",
      categoryId: petsCat.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    const [foodAmountMetric] = await db.insert(taskMetrics).values({ taskId: feedDog.id, name: "Food Amount", unit: "cups", dataType: "number" }).returning();
    const [appetiteMetric] = await db.insert(taskMetrics).values({ taskId: feedDog.id, name: "Appetite", unit: "", dataType: "text" }).returning();
    for (let i = 20; i >= 0; i--) {
      await this.completeTaskWithStreak(feedDog.id, userId, feedDog, daysAgo(i));
      const comp = await db.select().from(completions).where(eq(completions.taskId, feedDog.id)).orderBy(desc(completions.completedAt)).limit(1);
      if (comp[0]) {
        const appetites = ["Good", "Great", "Normal", "Hungry"];
        await db.insert(metricValues).values([
          { completionId: comp[0].id, metricId: foodAmountMetric.id, numericValue: 1.5 + (i % 3) * 0.25 },
          { completionId: comp[0].id, metricId: appetiteMetric.id, textValue: appetites[i % 4] },
        ]);
      }
    }

    // 5. Skincare - Never done (due soon status)
    const [skincare] = await db.insert(tasks).values({
      title: "Skincare",
      description: "Cleanser, toner, moisturizer",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "days",
      categoryId: healthCat.id,
      profileId,
      userId,
      isArchived: false
    }).returning();

    // ===== WEEKLY TASKS =====
    
    // 6. Do Laundry - Weekly with 5 week streak
    const [laundry] = await db.insert(tasks).values({
      title: "Do Laundry",
      description: "Wash, dry, fold, and put away",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "weeks",
      categoryId: householdCat.id,

      profileId,
      userId,
      isArchived: false
    }).returning();
    await db.insert(taskTags).values([{ taskId: laundry.id, tagId: weekendTag.id }]);
    for (let week = 5; week >= 0; week--) {
      await this.completeTaskWithStreak(laundry.id, userId, laundry, daysAgo(week * 7 + 1));
    }

    // 7. Clean Bathroom - Overdue (last done 12 days ago, due every week)
    const [cleanBathroom] = await db.insert(tasks).values({
      title: "Clean Bathroom",
      description: "Toilet, sink, shower, mirror",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "weeks",
      categoryId: householdCat.id,

      profileId,
      userId,
      isArchived: false
    }).returning();
    await db.insert(taskTags).values([{ taskId: cleanBathroom.id, tagId: weekendTag.id }]);
    await this.completeTaskWithStreak(cleanBathroom.id, userId, cleanBathroom, daysAgo(12));
    await this.completeTaskWithStreak(cleanBathroom.id, userId, cleanBathroom, daysAgo(19));

    // 8. Vacuum House - Due soon (last done 5 days ago, due every week)
    const [vacuum] = await db.insert(tasks).values({
      title: "Vacuum House",
      description: "All rooms and hallways",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "weeks",
      categoryId: householdCat.id,

      profileId,
      userId,
      isArchived: false
    }).returning();
    await this.completeTaskWithStreak(vacuum.id, userId, vacuum, daysAgo(5));
    await this.completeTaskWithStreak(vacuum.id, userId, vacuum, daysAgo(12));

    // 9. Walk Dog (Long) - Never done weekly task
    const [walkDogLong] = await db.insert(tasks).values({
      title: "Long Dog Walk",
      description: "30+ minute walk in the park",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "weeks",
      categoryId: petsCat.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    await db.insert(taskTags).values([{ taskId: walkDogLong.id, tagId: outdoorsTag.id }, { taskId: walkDogLong.id, tagId: weekendTag.id }]);

    // ===== FREQUENCY TASKS WITH VARIATIONS =====
    
    // 10. Exercise 4x/week - Parent frequency task with refractory period
    const [exercise] = await db.insert(tasks).values({
      title: "Exercise",
      description: "Any workout counts toward weekly goal",
      taskType: "frequency",
      targetCount: 4,
      targetPeriod: "week",
      refractoryMinutes: 480, // 8 hours minimum between workouts
      categoryId: exerciseCat.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    
    // Exercise variations (linked to parent)
    const [backSquat] = await db.insert(tasks).values({
      title: "Back Squat",
      description: "3x8 with progressive overload",
      taskType: "interval",
      intervalValue: 3,
      intervalUnit: "days",
      categoryId: exerciseCat.id,

      parentTaskId: exercise.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    const [squatWeightMetric] = await db.insert(taskMetrics).values({ taskId: backSquat.id, name: "Weight", unit: "lbs", dataType: "number" }).returning();
    const [squatRepsMetric] = await db.insert(taskMetrics).values({ taskId: backSquat.id, name: "Reps", unit: "", dataType: "number" }).returning();
    const [squatRPEMetric] = await db.insert(taskMetrics).values({ taskId: backSquat.id, name: "RPE", unit: "", dataType: "number" }).returning();
    
    // Squat completions with progressive overload metrics
    for (let session = 8; session >= 0; session--) {
      const baseWeight = 135 + (8 - session) * 5;
      await this.completeTaskWithStreak(backSquat.id, userId, backSquat, daysAgo(session * 3 + 1, 2));
      const comp = await db.select().from(completions).where(eq(completions.taskId, backSquat.id)).orderBy(desc(completions.completedAt)).limit(1);
      if (comp[0]) {
        await db.insert(metricValues).values([
          { completionId: comp[0].id, metricId: squatWeightMetric.id, numericValue: baseWeight },
          { completionId: comp[0].id, metricId: squatRepsMetric.id, numericValue: 8 - (session % 2) },
          { completionId: comp[0].id, metricId: squatRPEMetric.id, numericValue: 7 + (session % 3) },
        ]);
      }
    }

    const [benchPress] = await db.insert(tasks).values({
      title: "Bench Press",
      description: "3x5 strength focus",
      taskType: "interval",
      intervalValue: 4,
      intervalUnit: "days",
      categoryId: exerciseCat.id,
      parentTaskId: exercise.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    const [benchWeightMetric] = await db.insert(taskMetrics).values({ taskId: benchPress.id, name: "Weight", unit: "lbs", dataType: "number" }).returning();
    for (let session = 6; session >= 0; session--) {
      await this.completeTaskWithStreak(benchPress.id, userId, benchPress, daysAgo(session * 4 + 2, 3));
      const comp = await db.select().from(completions).where(eq(completions.taskId, benchPress.id)).orderBy(desc(completions.completedAt)).limit(1);
      if (comp[0]) {
        await db.insert(metricValues).values([
          { completionId: comp[0].id, metricId: benchWeightMetric.id, numericValue: 95 + (6 - session) * 5 },
        ]);
      }
    }

    const [pullUps] = await db.insert(tasks).values({
      title: "Pull-ups",
      description: "3 sets to failure",
      taskType: "interval",
      intervalValue: 3,
      intervalUnit: "days",
      categoryId: exerciseCat.id,
      parentTaskId: exercise.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    const [pullUpRepsMetric] = await db.insert(taskMetrics).values({ taskId: pullUps.id, name: "Total Reps", unit: "", dataType: "number" }).returning();
    for (let session = 7; session >= 0; session--) {
      await this.completeTaskWithStreak(pullUps.id, userId, pullUps, daysAgo(session * 3, 4));
      const comp = await db.select().from(completions).where(eq(completions.taskId, pullUps.id)).orderBy(desc(completions.completedAt)).limit(1);
      if (comp[0]) {
        await db.insert(metricValues).values([
          { completionId: comp[0].id, metricId: pullUpRepsMetric.id, numericValue: 18 + (7 - session) },
        ]);
      }
    }

    const [running] = await db.insert(tasks).values({
      title: "Running",
      description: "Cardio session",
      taskType: "interval",
      intervalValue: 2,
      intervalUnit: "days",
      categoryId: exerciseCat.id,
      parentTaskId: exercise.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    await db.insert(taskTags).values([{ taskId: running.id, tagId: outdoorsTag.id }]);
    const [runDistanceMetric] = await db.insert(taskMetrics).values({ taskId: running.id, name: "Distance", unit: "miles", dataType: "number" }).returning();
    const [runDurationMetric] = await db.insert(taskMetrics).values({ taskId: running.id, name: "Duration", unit: "min", dataType: "number" }).returning();
    const [runPaceMetric] = await db.insert(taskMetrics).values({ taskId: running.id, name: "Pace", unit: "min/mi", dataType: "text" }).returning();
    for (let session = 10; session >= 0; session--) {
      await this.completeTaskWithStreak(running.id, userId, running, daysAgo(session * 2 + 1, 1));
      const comp = await db.select().from(completions).where(eq(completions.taskId, running.id)).orderBy(desc(completions.completedAt)).limit(1);
      if (comp[0]) {
        const distance = 2.5 + (10 - session) * 0.2 + (session % 3) * 0.3;
        const duration = distance * 9 + (session % 5);
        await db.insert(metricValues).values([
          { completionId: comp[0].id, metricId: runDistanceMetric.id, numericValue: Math.round(distance * 10) / 10 },
          { completionId: comp[0].id, metricId: runDurationMetric.id, numericValue: Math.round(duration) },
          { completionId: comp[0].id, metricId: runPaceMetric.id, textValue: `${Math.floor(duration/distance)}:${String(Math.round((duration/distance % 1) * 60)).padStart(2, '0')}` },
        ]);
      }
    }

    // ===== MONTHLY TASKS =====
    
    // 11. Check Tire Pressure - Monthly with metrics
    const [tirePressure] = await db.insert(tasks).values({
      title: "Check Tire Pressure",
      description: "Ensure all tires are at correct PSI",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "months",
      categoryId: carCat.id,

      profileId,
      userId,
      isArchived: false
    }).returning();
    await db.insert(taskTags).values([{ taskId: tirePressure.id, tagId: quickTag.id }]);
    const [frontLeftMetric] = await db.insert(taskMetrics).values({ taskId: tirePressure.id, name: "Front Left", unit: "psi", dataType: "number" }).returning();
    const [frontRightMetric] = await db.insert(taskMetrics).values({ taskId: tirePressure.id, name: "Front Right", unit: "psi", dataType: "number" }).returning();
    const [rearLeftMetric] = await db.insert(taskMetrics).values({ taskId: tirePressure.id, name: "Rear Left", unit: "psi", dataType: "number" }).returning();
    const [rearRightMetric] = await db.insert(taskMetrics).values({ taskId: tirePressure.id, name: "Rear Right", unit: "psi", dataType: "number" }).returning();
    for (let month = 3; month >= 0; month--) {
      await this.completeTaskWithStreak(tirePressure.id, userId, tirePressure, daysAgo(month * 30 + 2));
      const comp = await db.select().from(completions).where(eq(completions.taskId, tirePressure.id)).orderBy(desc(completions.completedAt)).limit(1);
      if (comp[0]) {
        await db.insert(metricValues).values([
          { completionId: comp[0].id, metricId: frontLeftMetric.id, numericValue: 32 + (month % 2) },
          { completionId: comp[0].id, metricId: frontRightMetric.id, numericValue: 33 - (month % 2) },
          { completionId: comp[0].id, metricId: rearLeftMetric.id, numericValue: 31 + month },
          { completionId: comp[0].id, metricId: rearRightMetric.id, numericValue: 32 },
        ]);
      }
    }

    // 12. Review Budget - Monthly finance task
    const [reviewBudget] = await db.insert(tasks).values({
      title: "Review Monthly Budget",
      description: "Check spending vs budget categories",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "months",
      categoryId: financeCat.id,

      profileId,
      userId,
      isArchived: false
    }).returning();
    await this.completeTaskWithStreak(reviewBudget.id, userId, reviewBudget, daysAgo(35));
    await this.completeTaskWithStreak(reviewBudget.id, userId, reviewBudget, daysAgo(5));

    // 13. Water Indoor Plants - Bi-weekly, overdue
    const [waterPlants] = await db.insert(tasks).values({
      title: "Water Indoor Plants",
      description: "Check soil moisture before watering",
      taskType: "interval",
      intervalValue: 2,
      intervalUnit: "weeks",
      categoryId: gardenCat.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    await this.completeTaskWithStreak(waterPlants.id, userId, waterPlants, daysAgo(18));

    // ===== YEARLY TASKS =====
    
    // 14. Annual Car Inspection - Yearly task
    const [carInspection] = await db.insert(tasks).values({
      title: "Annual Car Inspection",
      description: "State inspection and emissions test",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "years",
      categoryId: carCat.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    await db.insert(taskTags).values([{ taskId: carInspection.id, tagId: urgentTag.id }]);
    await this.completeTaskWithStreak(carInspection.id, userId, carInspection, daysAgo(320));

    // 15. Replace Smoke Detector Batteries - Yearly, never done
    const [smokeBatteries] = await db.insert(tasks).values({
      title: "Replace Smoke Detector Batteries",
      description: "Replace batteries in all smoke and CO detectors",
      taskType: "interval",
      intervalValue: 1,
      intervalUnit: "years",
      categoryId: householdCat.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    await db.insert(taskTags).values([{ taskId: smokeBatteries.id, tagId: urgentTag.id }]);

    // ===== FREQUENCY TASK WITH REFRACTORY =====
    
    // 16. Drink Water - 8x per day with refractory (frequency task)
    const [drinkWater] = await db.insert(tasks).values({
      title: "Drink Water",
      description: "Stay hydrated - 8 glasses per day",
      taskType: "frequency",
      targetCount: 8,
      targetPeriod: "day",
      refractoryMinutes: 60, // At least 1 hour between glasses
      categoryId: healthCat.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    await db.insert(taskTags).values([{ taskId: drinkWater.id, tagId: quickTag.id }]);

    // 17. Read - 3x per week (frequency task)
    const [read] = await db.insert(tasks).values({
      title: "Read for 30 Minutes",
      description: "Reading books or articles",
      taskType: "frequency",
      targetCount: 3,
      targetPeriod: "week",
      categoryId: healthCat.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    await db.insert(taskTags).values([{ taskId: read.id, tagId: nightTag.id }]);
    const [pagesReadMetric] = await db.insert(taskMetrics).values({ taskId: read.id, name: "Pages Read", unit: "", dataType: "number" }).returning();
    const [bookTitleMetric] = await db.insert(taskMetrics).values({ taskId: read.id, name: "Book Title", unit: "", dataType: "text" }).returning();
    const bookTitles = ["Atomic Habits", "Deep Work", "The Psychology of Money", "Thinking Fast and Slow"];
    for (let i = 12; i >= 0; i--) {
      if (i % 2 === 0 || i % 3 === 0) {
        await this.completeTaskWithStreak(read.id, userId, read, daysAgo(i, 5));
        const comp = await db.select().from(completions).where(eq(completions.taskId, read.id)).orderBy(desc(completions.completedAt)).limit(1);
        if (comp[0]) {
          await db.insert(metricValues).values([
            { completionId: comp[0].id, metricId: pagesReadMetric.id, numericValue: 15 + (i * 3) % 25 },
            { completionId: comp[0].id, metricId: bookTitleMetric.id, textValue: bookTitles[i % 4] },
          ]);
        }
      }
    }

    // 18. Call Family - 2x per month
    const [callFamily] = await db.insert(tasks).values({
      title: "Call Family",
      description: "Check in with parents or siblings",
      taskType: "frequency",
      targetCount: 2,
      targetPeriod: "month",
      categoryId: healthCat.id,
      profileId,
      userId,
      isArchived: false
    }).returning();
    await this.completeTaskWithStreak(callFamily.id, userId, callFamily, daysAgo(5));
    await this.completeTaskWithStreak(callFamily.id, userId, callFamily, daysAgo(20));
    await this.completeTaskWithStreak(callFamily.id, userId, callFamily, daysAgo(35));

    return { success: true, message: "Demo profile seeded with comprehensive sample data" };
  }

  async getCategories(userId: string, profileId?: number | null, excludeDemo?: boolean): Promise<Category[]> {
    if (profileId !== undefined && profileId !== null) {
      return await db.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.profileId, profileId)));
    }
    // For aggregate view, optionally exclude demo profile data
    if (excludeDemo) {
      const demoProfiles = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.userId, userId), eq(profiles.isDemo, true)));
      const demoProfileIds = demoProfiles.map(p => p.id);
      if (demoProfileIds.length > 0) {
        return await db.select().from(categories).where(and(eq(categories.userId, userId), notInArray(categories.profileId, demoProfileIds)));
      }
    }
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

  async getTags(userId: string, profileId?: number | null, excludeDemo?: boolean): Promise<Tag[]> {
    if (profileId !== undefined && profileId !== null) {
      return await db.select().from(tags).where(and(eq(tags.userId, userId), eq(tags.profileId, profileId)));
    }
    if (excludeDemo) {
      const demoProfiles = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.userId, userId), eq(profiles.isDemo, true)));
      const demoProfileIds = demoProfiles.map(p => p.id);
      if (demoProfileIds.length > 0) {
        return await db.select().from(tags).where(and(eq(tags.userId, userId), notInArray(tags.profileId, demoProfileIds)));
      }
    }
    return await db.select().from(tags).where(eq(tags.userId, userId));
  }

  async createTag(userId: string, tag: InsertTag): Promise<Tag> {
    const [newTag] = await db.insert(tags).values({ ...tag, userId }).returning();
    return newTag;
  }

  async getTasks(userId: string, profileId?: number | null, excludeDemo?: boolean): Promise<Task[]> {
    if (profileId !== undefined && profileId !== null) {
      return await db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.profileId, profileId), eq(tasks.isArchived, false)));
    }
    if (excludeDemo) {
      const demoProfiles = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.userId, userId), eq(profiles.isDemo, true)));
      const demoProfileIds = demoProfiles.map(p => p.id);
      if (demoProfileIds.length > 0) {
        return await db.select().from(tasks).where(and(eq(tasks.userId, userId), eq(tasks.isArchived, false), notInArray(tasks.profileId, demoProfileIds)));
      }
    }
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

  async deleteTaskWithCascade(id: number, userId: string): Promise<void> {
    // Verify task belongs to user
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task || task.userId !== userId) {
      throw new Error("Task not found or unauthorized");
    }

    // Get all task IDs to delete (including variations)
    const variations = await db.select().from(tasks).where(eq(tasks.parentTaskId, id));
    const allTaskIds = [id, ...variations.map(v => v.id)];

    // Delete metric values for completions of these tasks
    const taskCompletions = await db.select().from(completions).where(
      inArray(completions.taskId, allTaskIds)
    );
    const completionIds = taskCompletions.map(c => c.id);
    
    if (completionIds.length > 0) {
      await db.delete(metricValues).where(inArray(metricValues.completionId, completionIds));
    }

    // Delete completions
    await db.delete(completions).where(inArray(completions.taskId, allTaskIds));

    // Delete task metrics
    await db.delete(taskMetrics).where(inArray(taskMetrics.taskId, allTaskIds));

    // Delete task tags
    await db.delete(taskTags).where(inArray(taskTags.taskId, allTaskIds));

    // Delete streaks for these tasks
    await db.delete(taskStreaks).where(inArray(taskStreaks.taskId, allTaskIds));

    // Delete variations first, then the parent task
    if (variations.length > 0) {
      await db.delete(tasks).where(inArray(tasks.id, variations.map(v => v.id)));
    }
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async archiveTask(id: number, userId: string): Promise<Task> {
    // Verify task belongs to user
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task || task.userId !== userId) {
      throw new Error("Task not found or unauthorized");
    }

    // Archive the task (keeps all historical data)
    const [updated] = await db.update(tasks)
      .set({ isArchived: true })
      .where(eq(tasks.id, id))
      .returning();

    // Also archive any variations (with user scoping for security)
    await db.update(tasks)
      .set({ isArchived: true })
      .where(and(eq(tasks.parentTaskId, id), eq(tasks.userId, userId)));

    return updated;
  }

  // Task Variations
  async getTaskVariations(parentId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(and(eq(tasks.parentTaskId, parentId), eq(tasks.isArchived, false)));
  }

  // Task Metrics
  async getTaskMetrics(taskId: number): Promise<TaskMetric[]> {
    return await db.select().from(taskMetrics).where(eq(taskMetrics.taskId, taskId));
  }

  async getTaskMetric(metricId: number): Promise<TaskMetric | undefined> {
    const [metric] = await db.select().from(taskMetrics).where(eq(taskMetrics.id, metricId));
    return metric;
  }

  async createTaskMetric(metric: InsertTaskMetric): Promise<TaskMetric> {
    const [newMetric] = await db.insert(taskMetrics).values(metric).returning();
    return newMetric;
  }

  async deleteTaskMetric(metricId: number): Promise<void> {
    await db.delete(metricValues).where(eq(metricValues.metricId, metricId));
    await db.delete(taskMetrics).where(eq(taskMetrics.id, metricId));
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

  async getAllCompletions(userId: string, profileId?: number | null, excludeDemo?: boolean): Promise<Completion[]> {
    if (profileId !== undefined && profileId !== null) {
      // Filter by specific profile
      const result = await db.select({
        completion: completions,
      })
      .from(completions)
      .innerJoin(tasks, eq(completions.taskId, tasks.id))
      .where(and(eq(tasks.userId, userId), eq(tasks.profileId, profileId)))
      .orderBy(desc(completions.completedAt));
      return result.map(r => r.completion);
    }
    
    // For aggregate view, optionally exclude demo profile data
    if (excludeDemo) {
      const demoProfiles = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.userId, userId), eq(profiles.isDemo, true)));
      const demoProfileIds = demoProfiles.map(p => p.id);
      if (demoProfileIds.length > 0) {
        const result = await db.select({
          completion: completions,
        })
        .from(completions)
        .innerJoin(tasks, eq(completions.taskId, tasks.id))
        .where(and(eq(tasks.userId, userId), notInArray(tasks.profileId, demoProfileIds)))
        .orderBy(desc(completions.completedAt));
        return result.map(r => r.completion);
      }
    }
    
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

  async getCompletionWithMetrics(completionId: number): Promise<{completion: Completion, metrics: MetricValue[]} | undefined> {
    const [completion] = await db.select().from(completions).where(eq(completions.id, completionId));
    if (!completion) return undefined;
    const metrics = await this.getMetricValues(completionId);
    return { completion, metrics };
  }

  async getCompletionsForCalendar(userId: string, startDate: Date, endDate: Date, profileId?: number, excludeDemo?: boolean): Promise<{date: string, count: number, tasks: {id: number, title: string, completedAt: string}[]}[]> {
    const conditions = [
      eq(tasks.userId, userId),
      gte(completions.completedAt, startDate),
      sql`${completions.completedAt} <= ${endDate}`
    ];
    
    if (profileId !== undefined) {
      conditions.push(eq(tasks.profileId, profileId));
    }
    
    if (excludeDemo) {
      // Exclude tasks from demo profiles
      const demoProfileIds = await db.select({ id: profiles.id })
        .from(profiles)
        .where(and(eq(profiles.userId, userId), eq(profiles.isDemo, true)));
      const demoIds = demoProfileIds.map(p => p.id);
      if (demoIds.length > 0) {
        conditions.push(notInArray(tasks.profileId, demoIds));
      }
    }
    
    const result = await db.select({
      completion: completions,
      task: tasks,
    })
    .from(completions)
    .innerJoin(tasks, eq(completions.taskId, tasks.id))
    .where(and(...conditions))
    .orderBy(completions.completedAt);
    
    // Group by date
    const groupedByDate = new Map<string, {id: number, title: string, completedAt: string}[]>();
    for (const row of result) {
      const dateStr = row.completion.completedAt.toISOString().slice(0, 10);
      if (!groupedByDate.has(dateStr)) {
        groupedByDate.set(dateStr, []);
      }
      groupedByDate.get(dateStr)!.push({
        id: row.task.id,
        title: row.task.title,
        completedAt: row.completion.completedAt.toISOString(),
      });
    }
    
    return Array.from(groupedByDate.entries()).map(([date, taskList]) => ({
      date,
      count: taskList.length,
      tasks: taskList,
    }));
  }

  async deleteCompletion(completionId: number, userId: string): Promise<void> {
    const [completion] = await db.select().from(completions).where(eq(completions.id, completionId));
    if (!completion) throw new Error("Completion not found");
    
    const task = await this.getTask(completion.taskId);
    if (!task || task.userId !== userId) throw new Error("Access denied");
    
    // Delete metric values first
    await db.delete(metricValues).where(eq(metricValues.completionId, completionId));
    
    // Delete the completion
    await db.delete(completions).where(eq(completions.id, completionId));
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

  async getAllStreaks(userId: string, profileId?: number | null, excludeDemo?: boolean): Promise<TaskStreak[]> {
    if (profileId !== undefined && profileId !== null) {
      // Filter by specific profile - join with tasks to get profileId
      const result = await db.select({
        streak: taskStreaks
      })
      .from(taskStreaks)
      .innerJoin(tasks, eq(taskStreaks.taskId, tasks.id))
      .where(and(eq(taskStreaks.userId, userId), eq(tasks.profileId, profileId)))
      .orderBy(desc(taskStreaks.currentStreak));
      return result.map(r => r.streak);
    }
    
    if (excludeDemo) {
      const demoProfiles = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.userId, userId), eq(profiles.isDemo, true)));
      const demoProfileIds = demoProfiles.map(p => p.id);
      if (demoProfileIds.length > 0) {
        const result = await db.select({
          streak: taskStreaks
        })
        .from(taskStreaks)
        .innerJoin(tasks, eq(taskStreaks.taskId, tasks.id))
        .where(and(eq(taskStreaks.userId, userId), notInArray(tasks.profileId, demoProfileIds)))
        .orderBy(desc(taskStreaks.currentStreak));
        return result.map(r => r.streak);
      }
    }
    
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

  // Task Migration methods
  async reassignTaskToProfile(taskId: number, targetProfileId: number, userId: string): Promise<Task> {
    // Verify task ownership
    const task = await this.getTask(taskId);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found or access denied");
    }
    
    // Verify target profile ownership
    const profile = await this.getProfile(targetProfileId, userId);
    if (!profile) {
      throw new Error("Target profile not found or access denied");
    }
    
    // Get task's tags and find/create equivalent tags in target profile
    const taskTagsList = await this.getTaskTags(taskId);
    const newTagIds: number[] = [];
    
    for (const tag of taskTagsList) {
      // Check if a tag with the same name exists in target profile
      const targetTags = await this.getTags(userId, targetProfileId);
      let existingTag = targetTags.find(t => t.name === tag.name);
      
      if (!existingTag) {
        // Create tag in target profile
        existingTag = await this.createTag(userId, { name: tag.name, profileId: targetProfileId });
      }
      newTagIds.push(existingTag.id);
    }
    
    // Handle category - find/create equivalent in target profile
    let newCategoryId: number | null = null;
    if (task.categoryId) {
      const categories = await this.getCategories(userId);
      const oldCategory = categories.find(c => c.id === task.categoryId);
      if (oldCategory) {
        const targetCategories = await this.getCategories(userId, targetProfileId);
        let existingCategory = targetCategories.find(c => c.name === oldCategory.name);
        if (!existingCategory) {
          existingCategory = await this.createCategory(userId, { name: oldCategory.name, profileId: targetProfileId });
        }
        newCategoryId = existingCategory.id;
      }
    }
    
    // Clear old tag associations
    await db.delete(taskTags).where(eq(taskTags.taskId, taskId));
    
    // Update task's profileId and categoryId
    const [updatedTask] = await db.update(tasks)
      .set({ 
        profileId: targetProfileId, 
        categoryId: newCategoryId
      })
      .where(eq(tasks.id, taskId))
      .returning();
    
    // Create new tag associations
    for (const tagId of newTagIds) {
      await db.insert(taskTags).values({ taskId, tagId });
    }
    
    // Migrate any variations (child tasks linked to this parent)
    const variationTasks = await db.select().from(tasks)
      .where(and(eq(tasks.parentTaskId, taskId), eq(tasks.userId, userId)));
    
    for (const variation of variationTasks) {
      // Recursively migrate variations to the same target profile
      await this.reassignTaskToProfile(variation.id, targetProfileId, userId);
    }
    
    // Note: Completions and streaks remain linked to the task by taskId - no migration needed
    // as they are not profile-scoped but task-scoped
    
    return updatedTask;
  }

  async migrateTasksToProfile(taskIds: number[], targetProfileId: number, userId: string): Promise<Task[]> {
    const results: Task[] = [];
    for (const taskId of taskIds) {
      const updatedTask = await this.reassignTaskToProfile(taskId, targetProfileId, userId);
      results.push(updatedTask);
    }
    return results;
  }

  async importTasksFromProfile(
    sourceProfileId: number, 
    targetProfileId: number, 
    userId: string
  ): Promise<{ tasksCreated: number, categoriesCreated: number, tagsCreated: number }> {
    // Get all source data
    const sourceCategories = await this.getCategories(userId, sourceProfileId);
    const sourceTags = await this.getTags(userId, sourceProfileId);
    const sourceTasks = await this.getTasks(userId, sourceProfileId);
    
    // Maps from old IDs to new IDs
    const categoryMap = new Map<number, number>();
    const tagMap = new Map<number, number>();
    const taskMap = new Map<number, number>();
    
    // 1. Copy categories
    for (const cat of sourceCategories) {
      const newCat = await this.createCategory(userId, { 
        name: cat.name, 
        parentId: null, // Handle parent mapping below
        profileId: targetProfileId 
      });
      categoryMap.set(cat.id, newCat.id);
    }
    
    // Update parent references for categories
    for (const cat of sourceCategories) {
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        const newCatId = categoryMap.get(cat.id)!;
        const newParentId = categoryMap.get(cat.parentId)!;
        await db.update(categories)
          .set({ parentId: newParentId })
          .where(eq(categories.id, newCatId));
      }
    }
    
    // 2. Copy tags
    for (const tag of sourceTags) {
      const newTag = await this.createTag(userId, { 
        name: tag.name, 
        profileId: targetProfileId 
      });
      tagMap.set(tag.id, newTag.id);
    }
    
    
    // 4. Copy tasks (parent tasks first, then variations)
    const parentTasks = sourceTasks.filter(t => !t.parentTaskId);
    const variationTasks = sourceTasks.filter(t => t.parentTaskId);
    
    for (const task of parentTasks) {
      // Get task's tags
      const taskTagIds = await this.getTaskTags(task.id);
      const newTagIds = taskTagIds.map(t => tagMap.get(t.id)).filter((id): id is number => id !== undefined);
      
      // Create the task copy
      const newTask = await this.createTask(userId, {
        title: task.title,
        description: task.description,
        taskType: task.taskType,
        intervalValue: task.intervalValue,
        intervalUnit: task.intervalUnit,
        targetCount: task.targetCount,
        targetPeriod: task.targetPeriod,
        scheduledDaysOfWeek: task.scheduledDaysOfWeek,
        scheduledDaysOfMonth: task.scheduledDaysOfMonth,
        scheduledTime: task.scheduledTime,
        scheduledDates: task.scheduledDates,
        refractoryMinutes: task.refractoryMinutes,
        categoryId: task.categoryId ? categoryMap.get(task.categoryId) : null,
        profileId: targetProfileId,
        parentTaskId: null // Parent tasks have no parent
      }, newTagIds);
      
      // Copy metrics for this task
      const taskMetricsList = await this.getTaskMetrics(task.id);
      for (const metric of taskMetricsList) {
        await this.createTaskMetric({
          taskId: newTask.id,
          name: metric.name,
          unit: metric.unit,
          dataType: metric.dataType
        });
      }
      
      taskMap.set(task.id, newTask.id);
    }
    
    // Now copy variation tasks
    for (const task of variationTasks) {
      const newParentId = task.parentTaskId ? taskMap.get(task.parentTaskId) : null;
      if (!newParentId && task.parentTaskId) continue; // Skip if parent wasn't copied
      
      const taskTagIds = await this.getTaskTags(task.id);
      const newTagIds = taskTagIds.map(t => tagMap.get(t.id)).filter((id): id is number => id !== undefined);
      
      const newTask = await this.createTask(userId, {
        title: task.title,
        description: task.description,
        taskType: task.taskType,
        intervalValue: task.intervalValue,
        intervalUnit: task.intervalUnit,
        targetCount: task.targetCount,
        targetPeriod: task.targetPeriod,
        scheduledDaysOfWeek: task.scheduledDaysOfWeek,
        scheduledDaysOfMonth: task.scheduledDaysOfMonth,
        scheduledTime: task.scheduledTime,
        scheduledDates: task.scheduledDates,
        refractoryMinutes: task.refractoryMinutes,
        categoryId: task.categoryId ? categoryMap.get(task.categoryId) : null,
        profileId: targetProfileId,
        parentTaskId: newParentId
      }, newTagIds);
      
      // Copy metrics for this variation
      const taskMetricsList = await this.getTaskMetrics(task.id);
      for (const metric of taskMetricsList) {
        await this.createTaskMetric({
          taskId: newTask.id,
          name: metric.name,
          unit: metric.unit,
          dataType: metric.dataType
        });
      }
      
      taskMap.set(task.id, newTask.id);
    }
    
    return {
      tasksCreated: taskMap.size,
      categoriesCreated: categoryMap.size,
      tagsCreated: tagMap.size
    };
  }
}

export const storage = new DatabaseStorage();
