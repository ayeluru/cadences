import {
  categories, tags, tasks, taskTags, completions, taskMetrics, metricValues, taskStreaks, profiles, taskVariations,
  userRoles, feedbackSubmissions, feedbackVotes, feedbackComments,
  type Category, type Tag, type Task, type TaskTag, type Completion,
  type TaskMetric, type MetricValue, type TaskStreak, type Profile, type TaskVariation,
  type UserRole, type FeedbackSubmission, type FeedbackVote, type FeedbackComment,
  type InsertCategory, type InsertTag, type InsertTask,
  type InsertTaskMetric, type InsertMetricValue, type InsertProfile,
  type InsertFeedback, type InsertFeedbackComment
} from "../../shared/schema.js";

// User type from Supabase auth (no longer using custom users table)
export type User = { id: string; email?: string };
import { db } from "./db.js";
import { eq, desc, asc, sql, and, gte, lte, inArray, notInArray, or, count as drizzleCount } from "drizzle-orm";
import { startOfDay, differenceInDays } from "date-fns";

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
  deleteTag(id: number, userId: string): Promise<void>;
  
  // Tasks (profileId: null = all profiles, number = specific profile)
  getTasks(userId: string, profileId?: number | null, excludeDemo?: boolean): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  createTask(userId: string, task: InsertTask, tagIds?: number[], metrics?: InsertTaskMetric[]): Promise<Task>;
  updateTask(id: number, updates: Partial<InsertTask>, tagIds?: number[], metrics?: InsertTaskMetric[]): Promise<Task>;
  deleteTask(id: number): Promise<void>;
  deleteTaskWithCascade(id: number, userId: string): Promise<void>;
  archiveTask(id: number, userId: string): Promise<Task>;
  
  // Task Variations (dropdown options for completing a task)
  getTaskVariations(taskId: number): Promise<TaskVariation[]>;
  createTaskVariation(taskId: number, name: string): Promise<TaskVariation>;
  deleteTaskVariation(variationId: number): Promise<void>;
  getVariationStats(taskId: number): Promise<{ variationId: number; name: string; count: number; percentage: number }[]>;
  
  // Task Metrics
  getTaskMetrics(taskId: number): Promise<TaskMetric[]>;
  getTaskMetric(metricId: number): Promise<TaskMetric | undefined>;
  createTaskMetric(metric: InsertTaskMetric): Promise<TaskMetric>;
  deleteTaskMetric(metricId: number): Promise<void>;
  deleteTaskMetrics(taskId: number): Promise<void>;
  
  // Completions
  completeTask(taskId: number, completedAt?: Date, notes?: string, metricData?: {metricId: number, value: number | string}[], userId?: string, variationId?: number): Promise<{task: Task, completion: Completion, streak?: TaskStreak}>;
  getCompletions(taskId: number): Promise<Completion[]>;
  getCompletionWithMetrics(completionId: number): Promise<{completion: Completion, metrics: MetricValue[]} | undefined>;
  getAllCompletions(userId: string): Promise<Completion[]>;
  getCompletionsInPeriod(taskId: number, startDate: Date, endDate: Date): Promise<Completion[]>;
  getCompletionsForCalendar(userId: string, startDate: Date, endDate: Date, profileId?: number, excludeDemo?: boolean): Promise<{date: string, count: number, tasks: {id: number, title: string, completedAt: string}[]}[]>;
  deleteCompletion(completionId: number, userId: string): Promise<void>;
  
  // Metric Values
  getMetricValues(completionId: number): Promise<MetricValue[]>;
  getMetricHistory(metricId: number, limit?: number): Promise<{id: number, value: number | string, completedAt: Date, variationId: number | null, variationName: string | null}[]>;

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
  
  // Account Management
  deleteAllUserData(userId: string): Promise<void>;
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

  async clearUserData(userId: string): Promise<void> {
    // CASCADE handles all child data (completions, metrics, streaks, variations, tag associations)
    await db.delete(tasks).where(eq(tasks.userId, userId));
    await db.delete(tags).where(eq(tags.userId, userId));
    await db.delete(categories).where(eq(categories.userId, userId));
  }

  // Helper method to complete task and update streak (used for seeding demo data)
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

    // Update streak
    await this.updateTaskStreak(taskId, userId, task, completedAt);
  }
  async getUser(id: string): Promise<User | undefined> {
    // Users are managed by Supabase Auth, not our database
    // Return a minimal User object since we have the ID
    return { id };
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

    // ON DELETE CASCADE handles tasks, categories, tags, and all their children
    await db.delete(profiles).where(eq(profiles.id, id));
  }

  async deleteProfileData(profileId: number, userId: string): Promise<void> {
    const [profile] = await db.select().from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)));
    if (!profile) {
      throw new Error("Profile not found or unauthorized");
    }

    // Delete tasks (CASCADE handles completions, metrics, streaks, variations, tag associations)
    await db.delete(tasks).where(and(eq(tasks.profileId, profileId), eq(tasks.userId, userId)));
    // Delete categories and tags (keep the profile itself)
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
    const WEEKS = 13; // 3 months of data
    const MAX_DAYS = WEEKS * 7;

    const daysAgo = (days: number, hourOffset: number = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() - days);
      d.setHours(8 + hourOffset + (days % 6), (days * 11) % 60, 0, 0);
      return d;
    };

    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    // ===== BATCH: Categories & Tags =====
    const allCats = await db.insert(categories).values([
      { name: "Household", userId, profileId },
      { name: "Health & Hygiene", userId, profileId },
      { name: "Exercise", userId, profileId },
      { name: "Car Maintenance", userId, profileId },
      { name: "Finance", userId, profileId },
      { name: "Pet Care", userId, profileId },
      { name: "Garden & Outdoor", userId, profileId },
    ]).returning();
    const [householdCat, healthCat, exerciseCat, carCat, financeCat, petsCat, gardenCat] = allCats;

    const allTags = await db.insert(tags).values([
      { name: "Urgent", userId, profileId },
      { name: "Quick", userId, profileId },
      { name: "Outdoors", userId, profileId },
      { name: "Weekend", userId, profileId },
      { name: "Morning", userId, profileId },
      { name: "Night", userId, profileId },
    ]).returning();
    const [urgentTag, quickTag, outdoorsTag, weekendTag, morningTag, nightTag] = allTags;

    // ===== BATCH: All tasks at once =====
    const allTasks = await db.insert(tasks).values([
      { title: "Brush Teeth", description: "Morning and night dental hygiene", taskType: "interval" as const, intervalValue: 1, intervalUnit: "days" as const, categoryId: healthCat.id, profileId, userId, isArchived: false },
      { title: "Take Vitamins", description: "Daily multivitamin and fish oil", taskType: "interval" as const, intervalValue: 1, intervalUnit: "days" as const, categoryId: healthCat.id, profileId, userId, isArchived: false },
      { title: "Meditate", description: "10 minutes of mindfulness", taskType: "interval" as const, intervalValue: 1, intervalUnit: "days" as const, categoryId: healthCat.id, profileId, userId, isArchived: false },
      { title: "Feed Dog", description: "Morning and evening feeding", taskType: "interval" as const, intervalValue: 1, intervalUnit: "days" as const, categoryId: petsCat.id, profileId, userId, isArchived: false },
      { title: "Skincare", description: "Cleanser, toner, moisturizer", taskType: "interval" as const, intervalValue: 1, intervalUnit: "days" as const, categoryId: healthCat.id, profileId, userId, isArchived: false },
      { title: "Do Laundry", description: "Wash, dry, fold, and put away", taskType: "interval" as const, intervalValue: 1, intervalUnit: "weeks" as const, categoryId: householdCat.id, profileId, userId, isArchived: false },
      { title: "Clean Bathroom", description: "Toilet, sink, shower, mirror", taskType: "interval" as const, intervalValue: 1, intervalUnit: "weeks" as const, categoryId: householdCat.id, profileId, userId, isArchived: false },
      { title: "Vacuum House", description: "All rooms and hallways", taskType: "interval" as const, intervalValue: 1, intervalUnit: "weeks" as const, categoryId: householdCat.id, profileId, userId, isArchived: false },
      { title: "Long Dog Walk", description: "30+ minute walk in the park", taskType: "interval" as const, intervalValue: 1, intervalUnit: "weeks" as const, categoryId: petsCat.id, profileId, userId, isArchived: false },
      { title: "Strength Training", description: "Track weight lifted across different exercises", taskType: "interval" as const, intervalValue: 2, intervalUnit: "days" as const, categoryId: exerciseCat.id, profileId, userId, isArchived: false },
      { title: "Running", description: "Track running workouts", taskType: "interval" as const, intervalValue: 2, intervalUnit: "days" as const, categoryId: exerciseCat.id, profileId, userId, isArchived: false },
      { title: "Weigh In", description: "Daily weight tracking", taskType: "interval" as const, intervalValue: 1, intervalUnit: "days" as const, categoryId: healthCat.id, profileId, userId, isArchived: false },
      { title: "Check Tire Pressure", description: "Ensure all tires are at correct PSI", taskType: "interval" as const, intervalValue: 1, intervalUnit: "months" as const, categoryId: carCat.id, profileId, userId, isArchived: false },
      { title: "Review Monthly Budget", description: "Check spending vs budget categories", taskType: "interval" as const, intervalValue: 1, intervalUnit: "months" as const, categoryId: financeCat.id, profileId, userId, isArchived: false },
      { title: "Water Indoor Plants", description: "Check soil moisture before watering", taskType: "interval" as const, intervalValue: 2, intervalUnit: "weeks" as const, categoryId: gardenCat.id, profileId, userId, isArchived: false },
      { title: "Annual Car Inspection", description: "State inspection and emissions test", taskType: "interval" as const, intervalValue: 1, intervalUnit: "years" as const, categoryId: carCat.id, profileId, userId, isArchived: false },
      { title: "Replace Smoke Detector Batteries", description: "Replace batteries in all smoke and CO detectors", taskType: "interval" as const, intervalValue: 1, intervalUnit: "years" as const, categoryId: householdCat.id, profileId, userId, isArchived: false },
      { title: "Drink Water", description: "Stay hydrated - 8 glasses per day", taskType: "frequency" as const, targetCount: 8, targetPeriod: "day" as const, refractoryMinutes: 60, categoryId: healthCat.id, profileId, userId, isArchived: false },
      { title: "Read for 30 Minutes", description: "Reading books or articles", taskType: "frequency" as const, targetCount: 3, targetPeriod: "week" as const, categoryId: healthCat.id, profileId, userId, isArchived: false },
      { title: "Call Family", description: "Check in with parents or siblings", taskType: "frequency" as const, targetCount: 2, targetPeriod: "month" as const, categoryId: healthCat.id, profileId, userId, isArchived: false },
    ]).returning();

    const [brushTeeth, takeVitamins, meditate, feedDog, _skincare,
           laundry, cleanBathroom, vacuum, walkDogLong,
           strengthTraining, running, bodyWeight,
           tirePressure, reviewBudget, waterPlants,
           carInspection, smokeBatteries,
           drinkWater, read, callFamily] = allTasks;

    // ===== BATCH: Task tags =====
    await db.insert(taskTags).values([
      { taskId: brushTeeth.id, tagId: quickTag.id }, { taskId: brushTeeth.id, tagId: morningTag.id },
      { taskId: takeVitamins.id, tagId: quickTag.id }, { taskId: takeVitamins.id, tagId: morningTag.id },
      { taskId: meditate.id, tagId: nightTag.id },
      { taskId: laundry.id, tagId: weekendTag.id },
      { taskId: cleanBathroom.id, tagId: weekendTag.id },
      { taskId: walkDogLong.id, tagId: outdoorsTag.id }, { taskId: walkDogLong.id, tagId: weekendTag.id },
      { taskId: running.id, tagId: outdoorsTag.id },
      { taskId: bodyWeight.id, tagId: morningTag.id }, { taskId: bodyWeight.id, tagId: quickTag.id },
      { taskId: tirePressure.id, tagId: quickTag.id },
      { taskId: carInspection.id, tagId: urgentTag.id },
      { taskId: smokeBatteries.id, tagId: urgentTag.id },
      { taskId: drinkWater.id, tagId: quickTag.id },
      { taskId: read.id, tagId: nightTag.id },
    ]);

    // ===== BATCH: Variations =====
    const strengthVars = await db.insert(taskVariations).values([
      { taskId: strengthTraining.id, name: "Bench Press" },
      { taskId: strengthTraining.id, name: "Back Squat" },
      { taskId: strengthTraining.id, name: "Deadlift" },
      { taskId: strengthTraining.id, name: "Overhead Press" },
    ]).returning();
    const [benchVar, squatVar, deadliftVar, ohpVar] = strengthVars;

    const runVars = await db.insert(taskVariations).values([
      { taskId: running.id, name: "Easy Run" },
      { taskId: running.id, name: "Tempo Run" },
      { taskId: running.id, name: "Long Run" },
      { taskId: running.id, name: "Intervals" },
    ]).returning();
    const [easyRunVar, tempoRunVar, longRunVar, intervalsVar] = runVars;

    const readVars = await db.insert(taskVariations).values([
      { taskId: read.id, name: "Fiction" },
      { taskId: read.id, name: "Non-Fiction" },
      { taskId: read.id, name: "Technical" },
    ]).returning();
    const [fictionVar, nonFictionVar, technicalVar] = readVars;

    // ===== BATCH: Metrics =====
    const allMetrics = await db.insert(taskMetrics).values([
      { taskId: feedDog.id, name: "Food Amount", unit: "cups", dataType: "number" as const },
      { taskId: feedDog.id, name: "Appetite", unit: "", dataType: "text" as const },
      { taskId: strengthTraining.id, name: "Weight", unit: "lbs", dataType: "number" as const },
      { taskId: strengthTraining.id, name: "Reps", unit: "", dataType: "number" as const },
      { taskId: running.id, name: "Distance", unit: "miles", dataType: "number" as const },
      { taskId: running.id, name: "Duration", unit: "min", dataType: "number" as const },
      { taskId: bodyWeight.id, name: "Weight", unit: "lbs", dataType: "number" as const },
      { taskId: tirePressure.id, name: "Front Left", unit: "psi", dataType: "number" as const },
      { taskId: tirePressure.id, name: "Front Right", unit: "psi", dataType: "number" as const },
      { taskId: tirePressure.id, name: "Rear Left", unit: "psi", dataType: "number" as const },
      { taskId: tirePressure.id, name: "Rear Right", unit: "psi", dataType: "number" as const },
      { taskId: read.id, name: "Pages Read", unit: "", dataType: "number" as const },
    ]).returning();
    const [foodAmountMetric, appetiteMetric, strengthWeightMetric, strengthRepsMetric,
           runDistanceMetric, runDurationMetric, weightMetric,
           frontLeftMetric, frontRightMetric, rearLeftMetric, rearRightMetric,
           pagesReadMetric] = allMetrics;

    // ===== BUILD ALL COMPLETIONS IN MEMORY, THEN BATCH INSERT =====
    const pendingCompletions: { taskId: number; completedAt: Date }[] = [];
    // Track which completions need variation/metric data (by index into pendingCompletions)
    type PostInsertWork = { idx: number; variationId?: number; metrics?: { metricId: number; numericValue?: number; textValue?: string }[] };
    const postWork: PostInsertWork[] = [];

    const addCompletion = (taskId: number, completedAt: Date, variationId?: number, metrics?: PostInsertWork['metrics']) => {
      const idx = pendingCompletions.length;
      pendingCompletions.push({ taskId, completedAt });
      if (variationId || metrics) {
        postWork.push({ idx, variationId, metrics });
      }
    };

    // Brush Teeth - 35 day streak
    for (let i = 35; i >= 0; i--) addCompletion(brushTeeth.id, daysAgo(i));

    // Take Vitamins - 15 day streak
    for (let i = 15; i >= 0; i--) addCompletion(takeVitamins.id, daysAgo(i));

    // Meditate - broken streak (last done 3 days ago)
    for (let i = 8; i >= 3; i--) addCompletion(meditate.id, daysAgo(i));

    // Feed Dog - 20 day streak with metrics
    const appetites = ["Good", "Great", "Normal", "Hungry"];
    for (let i = 20; i >= 0; i--) {
      addCompletion(feedDog.id, daysAgo(i), undefined, [
        { metricId: foodAmountMetric.id, numericValue: 1.5 + (i % 3) * 0.25 },
        { metricId: appetiteMetric.id, textValue: appetites[i % 4] },
      ]);
    }

    // Laundry - 5 week streak
    for (let week = 5; week >= 0; week--) addCompletion(laundry.id, daysAgo(week * 7 + 1));

    // Clean Bathroom - overdue
    addCompletion(cleanBathroom.id, daysAgo(19));
    addCompletion(cleanBathroom.id, daysAgo(12));

    // Vacuum - due soon
    addCompletion(vacuum.id, daysAgo(12));
    addCompletion(vacuum.id, daysAgo(5));

    // Strength Training - 3 months, Mon/Wed/Fri
    const strengthBaseWeights: Record<number, number> = {
      [benchVar.id]: 95, [squatVar.id]: 135, [deadliftVar.id]: 185, [ohpVar.id]: 65
    };
    const liftSchedule = [
      { day: 0, hour: 6, minute: 30 },
      { day: 2, hour: 17, minute: 45 },
      { day: 4, hour: 7, minute: 15 },
    ];
    for (let week = WEEKS; week >= 0; week--) {
      for (let si = 0; si < liftSchedule.length; si++) {
        const s = liftSchedule[si];
        const sessionDay = week * 7 + s.day;
        if (sessionDay > MAX_DAYS) continue;
        if (sessionDay > 7 && seededRandom(week * 10 + si) < 0.12) continue;
        const varIdx = (week * 3 + si) % strengthVars.length;
        const variation = strengthVars[varIdx];
        const baseWeight = strengthBaseWeights[variation.id];
        const progressWeight = baseWeight + Math.floor((WEEKS - week) * 1.5);
        const weightVar = Math.floor(seededRandom(sessionDay * 100 + varIdx) * 10);
        const reps = 5 + (si % 3);
        const cd = new Date(now); cd.setDate(cd.getDate() - sessionDay); cd.setHours(s.hour, s.minute, 0, 0);
        addCompletion(strengthTraining.id, cd, variation.id, [
          { metricId: strengthWeightMetric.id, numericValue: progressWeight + weightVar },
          { metricId: strengthRepsMetric.id, numericValue: reps },
        ]);
      }
    }

    // Running - 3 months, Tue/Thu/Sat
    const runSchedule = [
      { day: 1, hour: 6, minute: 15 },
      { day: 3, hour: 18, minute: 30 },
      { day: 5, hour: 8, minute: 0 },
    ];
    for (let week = WEEKS; week >= 0; week--) {
      for (let si = 0; si < runSchedule.length; si++) {
        const s = runSchedule[si];
        const sessionDay = week * 7 + s.day;
        if (sessionDay > MAX_DAYS) continue;
        if (sessionDay > 7 && seededRandom(week * 10 + si + 500) < 0.10) continue;
        let variation: typeof easyRunVar; let baseDistance: number;
        if (si === 0) { variation = easyRunVar; baseDistance = 3.5; }
        else if (si === 1) { variation = week % 2 === 0 ? tempoRunVar : intervalsVar; baseDistance = variation.id === tempoRunVar.id ? 5 : 4; }
        else { variation = longRunVar; baseDistance = 8 + (WEEKS - week) * 0.1; }
        const distVar = (seededRandom(sessionDay * 100 + si) * 0.5) - 0.25;
        const distance = baseDistance + distVar;
        const pace = variation.id === tempoRunVar.id || variation.id === intervalsVar.id ? 7.5 : 9;
        const cd = new Date(now); cd.setDate(cd.getDate() - sessionDay); cd.setHours(s.hour, s.minute, 0, 0);
        addCompletion(running.id, cd, variation.id, [
          { metricId: runDistanceMetric.id, numericValue: Math.round(distance * 10) / 10 },
          { metricId: runDurationMetric.id, numericValue: Math.round(distance * pace) },
        ]);
      }
    }

    // Weigh In - 3 months daily with weight trend
    const startWeight = 185; const targetLoss = 5;
    for (let day = MAX_DAYS; day >= 0; day--) {
      if (day > 0 && seededRandom(day * 77) < 0.15) continue;
      const progress = (MAX_DAYS - day) / MAX_DAYS;
      const w = startWeight - (targetLoss * progress) + (seededRandom(day * 33) - 0.5) * 2;
      addCompletion(bodyWeight.id, daysAgo(day, 0), undefined, [
        { metricId: weightMetric.id, numericValue: Math.round(w * 10) / 10 },
      ]);
    }

    // Tire Pressure - monthly for 3 months
    for (let month = 3; month >= 0; month--) {
      addCompletion(tirePressure.id, daysAgo(month * 30 + 2), undefined, [
        { metricId: frontLeftMetric.id, numericValue: 32 + (month % 3) },
        { metricId: frontRightMetric.id, numericValue: 33 - (month % 2) },
        { metricId: rearLeftMetric.id, numericValue: 31 + (month % 4) },
        { metricId: rearRightMetric.id, numericValue: 32 + ((3 - month) % 2) },
      ]);
    }

    // Review Budget
    addCompletion(reviewBudget.id, daysAgo(35));
    addCompletion(reviewBudget.id, daysAgo(5));

    // Water Plants
    addCompletion(waterPlants.id, daysAgo(18));

    // Car Inspection (done ~10 months ago)
    addCompletion(carInspection.id, daysAgo(320));

    // Reading - 3 months
    for (let week = WEEKS; week >= 0; week--) {
      const sessions = 2 + (week % 3 === 0 ? 1 : 0);
      for (let s = 0; s < sessions; s++) {
        const sessionDay = week * 7 + s * 2 + 1;
        if (sessionDay > MAX_DAYS) continue;
        const varIndex = (week + s) % readVars.length;
        const variation = readVars[varIndex];
        const basePages = variation.id === fictionVar.id ? 35 : variation.id === nonFictionVar.id ? 25 : 15;
        const pages = basePages + Math.floor(seededRandom(sessionDay * 200 + s) * 15);
        addCompletion(read.id, daysAgo(sessionDay, 21), variation.id, [
          { metricId: pagesReadMetric.id, numericValue: pages },
        ]);
      }
    }

    // Call Family
    addCompletion(callFamily.id, daysAgo(35));
    addCompletion(callFamily.id, daysAgo(20));
    addCompletion(callFamily.id, daysAgo(5));

    // ===== EXECUTE: Batch insert all completions =====
    const BATCH_SIZE = 200;
    const insertedCompletions: { id: number; taskId: number; completedAt: Date }[] = [];
    for (let i = 0; i < pendingCompletions.length; i += BATCH_SIZE) {
      const batch = pendingCompletions.slice(i, i + BATCH_SIZE);
      const rows = await db.insert(completions).values(batch).returning();
      insertedCompletions.push(...rows);
    }

    // ===== EXECUTE: Batch update variations and insert metrics =====
    const variationUpdates: { id: number; variationId: number }[] = [];
    const allMetricValues: { completionId: number; metricId: number; numericValue?: number | null; textValue?: string | null }[] = [];

    for (const pw of postWork) {
      const comp = insertedCompletions[pw.idx];
      if (!comp) continue;
      if (pw.variationId) {
        variationUpdates.push({ id: comp.id, variationId: pw.variationId });
      }
      if (pw.metrics) {
        for (const m of pw.metrics) {
          allMetricValues.push({
            completionId: comp.id,
            metricId: m.metricId,
            numericValue: m.numericValue ?? null,
            textValue: m.textValue ?? null,
          });
        }
      }
    }

    // Batch update variations (no batch update in drizzle, use raw SQL)
    if (variationUpdates.length > 0) {
      for (let i = 0; i < variationUpdates.length; i += BATCH_SIZE) {
        const batch = variationUpdates.slice(i, i + BATCH_SIZE);
        const cases = batch.map(v => `WHEN ${v.id} THEN ${v.variationId}`).join(' ');
        const ids = batch.map(v => v.id).join(',');
        await db.execute(sql`UPDATE completions SET variation_id = CASE id ${sql.raw(cases)} END WHERE id IN (${sql.raw(ids)})`);
      }
    }

    // Batch insert metric values
    if (allMetricValues.length > 0) {
      for (let i = 0; i < allMetricValues.length; i += BATCH_SIZE) {
        const batch = allMetricValues.slice(i, i + BATCH_SIZE);
        await db.insert(metricValues).values(batch);
      }
    }

    // ===== EXECUTE: Update lastCompletedAt per task and create streaks =====
    const taskCompletionMap = new Map<number, Date>();
    for (const comp of insertedCompletions) {
      const existing = taskCompletionMap.get(comp.taskId);
      if (!existing || comp.completedAt > existing) {
        taskCompletionMap.set(comp.taskId, comp.completedAt);
      }
    }
    const taskMapEntries = Array.from(taskCompletionMap.entries());
    for (const [taskId, lastDate] of taskMapEntries) {
      await db.update(tasks).set({ lastCompletedAt: lastDate }).where(eq(tasks.id, taskId));
    }

    // Build streaks from completion history per task
    const taskIds = Array.from(new Set(insertedCompletions.map(c => c.taskId)));
    for (const taskId of taskIds) {
      const taskComps = insertedCompletions
        .filter(c => c.taskId === taskId)
        .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
      if (taskComps.length === 0) continue;

      const task = allTasks.find(t => t.id === taskId)!;
      let intervalDays = 1;
      if (task.intervalUnit === 'days') intervalDays = task.intervalValue ?? 1;
      else if (task.intervalUnit === 'weeks') intervalDays = (task.intervalValue ?? 1) * 7;
      else if (task.intervalUnit === 'months') intervalDays = (task.intervalValue ?? 1) * 30;
      else if (task.intervalUnit === 'years') intervalDays = (task.intervalValue ?? 1) * 365;
      if (task.taskType === 'frequency' && task.targetCount && task.targetPeriod) {
        const periodDays = task.targetPeriod === 'day' ? 1 : task.targetPeriod === 'week' ? 7 : 30;
        intervalDays = Math.ceil(periodDays / task.targetCount);
      }
      const graceWindow = intervalDays * 1.5 + 1;

      let currentStreak = 1;
      let longestStreak = 1;
      for (let i = 1; i < taskComps.length; i++) {
        const daysBetween = (taskComps[i].completedAt.getTime() - taskComps[i-1].completedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysBetween <= graceWindow) {
          currentStreak++;
          longestStreak = Math.max(longestStreak, currentStreak);
        } else {
          currentStreak = 1;
        }
      }

      await db.insert(taskStreaks).values({
        taskId,
        userId,
        currentStreak,
        longestStreak,
        lastCompletedAt: taskComps[taskComps.length - 1].completedAt,
      });
    }

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

  async deleteTag(id: number, userId: string): Promise<void> {
    const [tag] = await db.select().from(tags).where(eq(tags.id, id));
    if (!tag || tag.userId !== userId) {
      throw new Error("Tag not found or unauthorized");
    }
    await db.delete(taskTags).where(eq(taskTags.tagId, id));
    await db.delete(tags).where(eq(tags.id, id));
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

  async createTask(userId: string, task: InsertTask, tagIds?: number[], metrics?: InsertTaskMetric[]): Promise<Task> {
    const [newTask] = await db.insert(tasks).values({ ...task, userId }).returning();

    if (tagIds && tagIds.length > 0) {
      await db.insert(taskTags).values(
        tagIds.map(tagId => ({ taskId: newTask.id, tagId }))
      );
    }

    if (metrics && metrics.length > 0) {
      await db.insert(taskMetrics).values(
        metrics.map(metric => ({ ...metric, taskId: newTask.id }))
      );
    }

    return newTask;
  }

  async updateTask(id: number, updates: Partial<InsertTask>, tagIds?: number[], metrics?: InsertTaskMetric[]): Promise<Task> {
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

    if (metrics) {
      // Replace metrics
      await db.delete(taskMetrics).where(eq(taskMetrics.taskId, id));
      if (metrics.length > 0) {
        await db.insert(taskMetrics).values(
          metrics.map(metric => ({ ...metric, taskId: id }))
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
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task || task.userId !== userId) {
      throw new Error("Task not found or unauthorized");
    }

    // Child tasks (variations) have parentTaskId FK with SET NULL,
    // so delete them explicitly first, then the parent.
    // All other related data (completions, metrics, streaks, tags, variations)
    // is cleaned up automatically by ON DELETE CASCADE.
    const childTasks = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.parentTaskId, id));
    if (childTasks.length > 0) {
      await db.delete(tasks).where(inArray(tasks.id, childTasks.map(t => t.id)));
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

  // Task Variations (dropdown options for completing a task)
  async getTaskVariations(taskId: number): Promise<TaskVariation[]> {
    return await db.select().from(taskVariations).where(eq(taskVariations.taskId, taskId));
  }

  async createTaskVariation(taskId: number, name: string): Promise<TaskVariation> {
    const [variation] = await db.insert(taskVariations).values({ taskId, name }).returning();
    return variation;
  }

  async deleteTaskVariation(variationId: number): Promise<void> {
    await db.delete(taskVariations).where(eq(taskVariations.id, variationId));
  }

  async getVariationStats(taskId: number): Promise<{ variationId: number; name: string; count: number; percentage: number }[]> {
    const variations = await this.getTaskVariations(taskId);
    if (variations.length === 0) return [];

    const taskCompletions = await this.getCompletions(taskId);
    const totalWithVariation = taskCompletions.filter(c => c.variationId !== null).length;
    
    const stats = variations.map(v => {
      const count = taskCompletions.filter(c => c.variationId === v.id).length;
      const percentage = totalWithVariation > 0 ? Math.round((count / totalWithVariation) * 100) : 0;
      return { variationId: v.id, name: v.name, count, percentage };
    });
    
    return stats.sort((a, b) => b.count - a.count);
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
    userId?: string,
    variationId?: number
  ): Promise<{task: Task, completion: Completion, streak?: TaskStreak}> {
    // Get the task
    const task = await this.getTask(taskId);
    
    // Add completion record with variationId if specified
    const [completion] = await db.insert(completions).values({
      taskId,
      completedAt,
      notes,
      variationId: variationId || null,
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

    // Update streak if userId provided
    let streak: TaskStreak | undefined;
    if (userId && task) {
      streak = await this.updateTaskStreak(taskId, userId, task, completedAt);
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
        lte(completions.completedAt, endDate)
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
      lte(completions.completedAt, endDate)
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

    // Update task's lastCompletedAt to the most recent remaining completion
    const [latestRemaining] = await db.select()
      .from(completions)
      .where(eq(completions.taskId, completion.taskId))
      .orderBy(desc(completions.completedAt))
      .limit(1);

    await db.update(tasks)
      .set({ lastCompletedAt: latestRemaining?.completedAt || null })
      .where(eq(tasks.id, completion.taskId));

    // Recalculate the streak from remaining completion history
    await this.recalculateStreak(completion.taskId, userId, task);
  }

  private async recalculateStreak(taskId: number, userId: string, task: Task): Promise<void> {
    const allCompletions = await db.select()
      .from(completions)
      .where(eq(completions.taskId, taskId))
      .orderBy(asc(completions.completedAt));

    const existing = await this.getTaskStreak(taskId, userId);

    if (allCompletions.length === 0) {
      if (existing) {
        await db.delete(taskStreaks)
          .where(eq(taskStreaks.id, existing.id));
      }
      return;
    }

    const intervalDays = this.getIntervalInDays(task);
    const graceWindow = Math.max(Math.ceil(intervalDays * 1.5), Math.ceil(intervalDays) + 1);

    let currentStreak = 1;
    let longestStreak = 1;
    let streakStartDate = allCompletions[0].completedAt;
    let lastDay = startOfDay(allCompletions[0].completedAt);

    for (let i = 1; i < allCompletions.length; i++) {
      const day = startOfDay(allCompletions[i].completedAt);
      const gap = differenceInDays(day, lastDay);

      if (gap === 0) continue; // same calendar day

      if (gap <= graceWindow) {
        currentStreak++;
      } else {
        currentStreak = 1;
        streakStartDate = allCompletions[i].completedAt;
      }

      longestStreak = Math.max(longestStreak, currentStreak);
      lastDay = day;
    }

    const lastCompletion = allCompletions[allCompletions.length - 1];

    if (existing) {
      await db.update(taskStreaks)
        .set({
          currentStreak,
          longestStreak,
          lastCompletedAt: lastCompletion.completedAt,
          streakStartDate,
          totalCompletions: allCompletions.length,
        })
        .where(eq(taskStreaks.id, existing.id));
    } else {
      await db.insert(taskStreaks).values({
        taskId,
        userId,
        currentStreak,
        longestStreak,
        lastCompletedAt: lastCompletion.completedAt,
        streakStartDate,
        totalCompletions: allCompletions.length,
      });
    }
  }

  // Metric Values
  async getMetricValues(completionId: number): Promise<MetricValue[]> {
    return await db.select().from(metricValues).where(eq(metricValues.completionId, completionId));
  }

  async getMetricHistory(metricId: number, limit: number = 50): Promise<{id: number, value: number | string, completedAt: Date, variationId: number | null, variationName: string | null}[]> {
    const result = await db.select({
      id: metricValues.id,
      numericValue: metricValues.numericValue,
      textValue: metricValues.textValue,
      completedAt: completions.completedAt,
      variationId: completions.variationId,
    })
    .from(metricValues)
    .innerJoin(completions, eq(metricValues.completionId, completions.id))
    .where(eq(metricValues.metricId, metricId))
    .orderBy(desc(completions.completedAt))
    .limit(limit);
    
    // Get variation names for any completions with variationId
    const variationIds = result.filter(r => r.variationId !== null).map(r => r.variationId as number);
    const uniqueVariationIds = Array.from(new Set(variationIds));
    
    let variationMap = new Map<number, string>();
    if (uniqueVariationIds.length > 0) {
      const variationsData = await db.select().from(taskVariations).where(inArray(taskVariations.id, uniqueVariationIds));
      variationsData.forEach(v => variationMap.set(v.id, v.name));
    }
    
    return result.map(r => ({
      id: r.id,
      value: r.numericValue !== null ? r.numericValue : (r.textValue || ''),
      completedAt: r.completedAt,
      variationId: r.variationId,
      variationName: r.variationId ? variationMap.get(r.variationId) || null : null,
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
    let streak = await this.getTaskStreak(taskId, userId);
    
    const intervalDays = this.getIntervalInDays(task);
    
    if (!streak) {
      const [newStreak] = await db.insert(taskStreaks).values({
        taskId,
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastCompletedAt: completedAt,
        streakStartDate: completedAt,
        totalCompletions: 1,
      }).returning();
      return newStreak;
    }

    const lastCompletion = streak.lastCompletedAt;

    // Use calendar-day comparison to avoid midnight edge cases
    const completedDay = startOfDay(completedAt);
    const lastCompletionDay = lastCompletion ? startOfDay(lastCompletion) : null;
    const calendarDaysDiff = lastCompletionDay
      ? differenceInDays(completedDay, lastCompletionDay)
      : Infinity;

    // Grace window: interval * 1.5, floored to at least interval + 1 day
    const graceWindow = Math.max(Math.ceil(intervalDays * 1.5), Math.ceil(intervalDays) + 1);

    let newCurrentStreak: number;
    let newStreakStartDate: Date;

    if (calendarDaysDiff === 0) {
      // Same calendar day — don't increment
      newCurrentStreak = streak.currentStreak;
      newStreakStartDate = streak.streakStartDate || completedAt;
    } else if (calendarDaysDiff < 0) {
      // Backdated completion (before last recorded) — don't alter streak count
      newCurrentStreak = streak.currentStreak;
      newStreakStartDate = streak.streakStartDate || completedAt;
    } else if (calendarDaysDiff <= graceWindow) {
      // Within grace window on a new day — streak continues
      newCurrentStreak = streak.currentStreak + 1;
      newStreakStartDate = streak.streakStartDate || completedAt;
    } else {
      // Gap too large — streak broken
      newCurrentStreak = 1;
      newStreakStartDate = completedAt;
    }

    const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

    // Only advance lastCompletedAt if this completion is newer
    const newLastCompletedAt = lastCompletion && completedAt <= lastCompletion
      ? lastCompletion
      : completedAt;

    const [updatedStreak] = await db.update(taskStreaks)
      .set({
        currentStreak: newCurrentStreak,
        longestStreak: newLongestStreak,
        lastCompletedAt: newLastCompletedAt,
        streakStartDate: newStreakStartDate,
        totalCompletions: streak.totalCompletions + 1,
      })
      .where(eq(taskStreaks.id, streak.id))
      .returning();

    return updatedStreak;
  }

  getIntervalInDays(task: Task): number {
    if (task.taskType === 'frequency') {
      // Per-completion interval: e.g. 3x/week → 7/3 ≈ 2.3 days between completions
      const periodDays = task.targetPeriod === 'week' ? 7 : task.targetPeriod === 'month' ? 30 : 365;
      return periodDays / (task.targetCount || 1);
    }

    if (task.taskType === 'scheduled') {
      return this.getScheduledIntervalDays(task);
    }

    // Interval-based tasks
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

  // Calculate the max gap between consecutive scheduled occurrences,
  // so the grace window accommodates the natural schedule rhythm.
  private getScheduledIntervalDays(task: Task): number {
    if (task.scheduledDaysOfWeek) {
      const days = task.scheduledDaysOfWeek.split(',')
        .map(Number)
        .filter(d => d >= 0 && d <= 6)
        .sort((a, b) => a - b);
      if (days.length === 0) return 1;
      if (days.length === 1) return 7;

      let maxGap = 0;
      for (let i = 1; i < days.length; i++) {
        maxGap = Math.max(maxGap, days[i] - days[i - 1]);
      }
      // Wrap-around gap (e.g., Fri→Mon = 7 - 5 + 1 = 3)
      maxGap = Math.max(maxGap, 7 - days[days.length - 1] + days[0]);
      return maxGap;
    }

    if (task.scheduledDaysOfMonth) {
      const rawDays = task.scheduledDaysOfMonth.split(',')
        .map(d => parseInt(d.trim()))
        .filter(d => !isNaN(d));
      // Resolve negative days relative to a 30-day month for gap estimation
      const days = rawDays
        .map(d => d < 0 ? 31 + d : d)
        .filter(d => d >= 1 && d <= 31)
        .sort((a, b) => a - b);
      if (days.length === 0) return 1;
      if (days.length === 1) return 30;

      let maxGap = 0;
      for (let i = 1; i < days.length; i++) {
        maxGap = Math.max(maxGap, days[i] - days[i - 1]);
      }
      maxGap = Math.max(maxGap, 30 - days[days.length - 1] + days[0]);
      return maxGap;
    }

    if (task.scheduledDates) {
      // One-off specific dates — no recurring interval for streaks
      return 365;
    }

    return 1;
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
  
  async deleteAllUserData(userId: string): Promise<void> {
    // Deleting profiles CASCADE-deletes tasks, categories, and tags.
    // Deleting tasks CASCADE-deletes completions, metrics, streaks, variations, and tag associations.
    await db.delete(profiles).where(eq(profiles.userId, userId));
  }

  // Batch query methods — fetch data for many tasks in a single DB round-trip

  async getTaskTagsBatch(taskIds: number[]): Promise<Map<number, Tag[]>> {
    if (taskIds.length === 0) return new Map();
    const result = await db.select({ taskId: taskTags.taskId, tag: tags })
      .from(taskTags)
      .innerJoin(tags, eq(taskTags.tagId, tags.id))
      .where(inArray(taskTags.taskId, taskIds));
    const map = new Map<number, Tag[]>();
    for (const row of result) {
      if (!map.has(row.taskId)) map.set(row.taskId, []);
      map.get(row.taskId)!.push(row.tag);
    }
    return map;
  }

  async getTaskMetricsBatch(taskIds: number[]): Promise<Map<number, TaskMetric[]>> {
    if (taskIds.length === 0) return new Map();
    const result = await db.select().from(taskMetrics).where(inArray(taskMetrics.taskId, taskIds));
    const map = new Map<number, TaskMetric[]>();
    for (const row of result) {
      if (!map.has(row.taskId)) map.set(row.taskId, []);
      map.get(row.taskId)!.push(row);
    }
    return map;
  }

  async getTaskVariationsBatch(taskIds: number[]): Promise<Map<number, TaskVariation[]>> {
    if (taskIds.length === 0) return new Map();
    const result = await db.select().from(taskVariations).where(inArray(taskVariations.taskId, taskIds));
    const map = new Map<number, TaskVariation[]>();
    for (const row of result) {
      if (!map.has(row.taskId)) map.set(row.taskId, []);
      map.get(row.taskId)!.push(row);
    }
    return map;
  }

  async getTaskStreaksBatch(taskIds: number[], userId: string): Promise<Map<number, TaskStreak>> {
    if (taskIds.length === 0) return new Map();
    const result = await db.select().from(taskStreaks)
      .where(and(inArray(taskStreaks.taskId, taskIds), eq(taskStreaks.userId, userId)));
    const map = new Map<number, TaskStreak>();
    for (const row of result) {
      map.set(row.taskId, row);
    }
    return map;
  }

  async getCompletionsInPeriodBatch(taskIds: number[], startDate: Date, endDate: Date): Promise<Map<number, Completion[]>> {
    if (taskIds.length === 0) return new Map();
    const result = await db.select().from(completions)
      .where(and(
        inArray(completions.taskId, taskIds),
        gte(completions.completedAt, startDate),
        lte(completions.completedAt, endDate)
      ))
      .orderBy(desc(completions.completedAt));
    const map = new Map<number, Completion[]>();
    for (const row of result) {
      if (!map.has(row.taskId)) map.set(row.taskId, []);
      map.get(row.taskId)!.push(row);
    }
    return map;
  }

  async getCompletionsBatch(taskIds: number[]): Promise<Map<number, Completion[]>> {
    if (taskIds.length === 0) return new Map();
    const result = await db.select().from(completions)
      .where(inArray(completions.taskId, taskIds))
      .orderBy(desc(completions.completedAt));
    const map = new Map<number, Completion[]>();
    for (const row of result) {
      if (!map.has(row.taskId)) map.set(row.taskId, []);
      map.get(row.taskId)!.push(row);
    }
    return map;
  }

  async getTasksBatch(taskIds: number[]): Promise<Map<number, Task>> {
    if (taskIds.length === 0) return new Map();
    const result = await db.select().from(tasks).where(inArray(tasks.id, taskIds));
    const map = new Map<number, Task>();
    for (const row of result) {
      map.set(row.id, row);
    }
    return map;
  }
  // ============ User Roles ============

  async getUserRole(userId: string): Promise<UserRole | undefined> {
    const [role] = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
    return role;
  }

  async setUserRole(userId: string, role: 'user' | 'admin', grantedBy: string): Promise<UserRole> {
    const existing = await this.getUserRole(userId);
    if (existing) {
      const [updated] = await db.update(userRoles)
        .set({ role, grantedBy })
        .where(eq(userRoles.userId, userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(userRoles)
      .values({ userId, role, grantedBy })
      .returning();
    return created;
  }

  async getAllUserRoles(): Promise<UserRole[]> {
    return await db.select().from(userRoles);
  }

  // ============ Feedback Submissions ============

  async createFeedback(userId: string, data: InsertFeedback, isAnonymous = false): Promise<FeedbackSubmission> {
    const [submission] = await db.insert(feedbackSubmissions)
      .values({ ...data, userId, isAnonymous })
      .returning();
    return submission;
  }

  async getFeedback(id: number): Promise<FeedbackSubmission | undefined> {
    const [submission] = await db.select().from(feedbackSubmissions).where(eq(feedbackSubmissions.id, id));
    return submission;
  }

  async getFeedbackStats(): Promise<{ total: number; unreviewed: number; public: number; byStatus: Record<string, number> }> {
    const all = await db.select({ status: feedbackSubmissions.status, isPublic: feedbackSubmissions.isPublic }).from(feedbackSubmissions);
    const byStatus: Record<string, number> = {};
    let unreviewed = 0;
    let publicCount = 0;
    for (const row of all) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      if (row.status === 'new' && !row.isPublic) unreviewed++;
      if (row.isPublic) publicCount++;
    }
    return { total: all.length, unreviewed, public: publicCount, byStatus };
  }

  async getFeedbackList(userId: string, isAdminUser: boolean, filters?: { type?: string; status?: string }): Promise<(FeedbackSubmission & { voteCount: number; commentCount: number; hasVoted: boolean })[]> {
    const conditions: any[] = [];
    if (!isAdminUser) {
      conditions.push(or(eq(feedbackSubmissions.userId, userId), eq(feedbackSubmissions.isPublic, true))!);
    }
    if (filters?.type) {
      conditions.push(eq(feedbackSubmissions.type, filters.type as any));
    }
    if (filters?.status) {
      conditions.push(eq(feedbackSubmissions.status, filters.status as any));
    }

    const submissions = conditions.length > 0
      ? await db.select().from(feedbackSubmissions).where(and(...conditions)).orderBy(desc(feedbackSubmissions.createdAt))
      : await db.select().from(feedbackSubmissions).orderBy(desc(feedbackSubmissions.createdAt));

    const result = await Promise.all(submissions.map(async (sub) => {
      const [voteResult] = await db.select({ count: drizzleCount() }).from(feedbackVotes).where(eq(feedbackVotes.feedbackId, sub.id));
      const [commentResult] = await db.select({ count: drizzleCount() }).from(feedbackComments).where(eq(feedbackComments.feedbackId, sub.id));
      const [userVote] = await db.select().from(feedbackVotes).where(and(eq(feedbackVotes.feedbackId, sub.id), eq(feedbackVotes.userId, userId)));
      return {
        ...sub,
        voteCount: Number(voteResult?.count ?? 0),
        commentCount: Number(commentResult?.count ?? 0),
        hasVoted: !!userVote,
      };
    }));

    return result;
  }

  async updateFeedback(id: number, updates: Partial<Pick<FeedbackSubmission, 'title' | 'description' | 'status' | 'isPublic' | 'adminResponse'>>): Promise<FeedbackSubmission> {
    const [updated] = await db.update(feedbackSubmissions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(feedbackSubmissions.id, id))
      .returning();
    return updated;
  }

  async deleteFeedback(id: number): Promise<void> {
    await db.delete(feedbackSubmissions).where(eq(feedbackSubmissions.id, id));
  }

  // ============ Feedback Votes ============

  async toggleVote(userId: string, feedbackId: number): Promise<{ voted: boolean }> {
    const [existing] = await db.select().from(feedbackVotes)
      .where(and(eq(feedbackVotes.userId, userId), eq(feedbackVotes.feedbackId, feedbackId)));
    if (existing) {
      await db.delete(feedbackVotes).where(eq(feedbackVotes.id, existing.id));
      return { voted: false };
    }
    await db.insert(feedbackVotes).values({ userId, feedbackId });
    return { voted: true };
  }

  async getVoteCount(feedbackId: number): Promise<number> {
    const [result] = await db.select({ count: drizzleCount() }).from(feedbackVotes).where(eq(feedbackVotes.feedbackId, feedbackId));
    return Number(result?.count ?? 0);
  }

  async hasUserVoted(userId: string, feedbackId: number): Promise<boolean> {
    const [vote] = await db.select().from(feedbackVotes).where(and(eq(feedbackVotes.userId, userId), eq(feedbackVotes.feedbackId, feedbackId)));
    return !!vote;
  }

  // ============ Feedback Comments ============

  async createFeedbackComment(userId: string, feedbackId: number, content: string, isAnonymous = false, isOfficialResponse = false): Promise<FeedbackComment> {
    const [comment] = await db.insert(feedbackComments)
      .values({ userId, feedbackId, content, isAnonymous, isOfficialResponse })
      .returning();
    return comment;
  }

  async getFeedbackComments(feedbackId: number): Promise<FeedbackComment[]> {
    return await db.select().from(feedbackComments)
      .where(eq(feedbackComments.feedbackId, feedbackId))
      .orderBy(feedbackComments.createdAt);
  }

  async deleteFeedbackComment(commentId: number): Promise<void> {
    await db.delete(feedbackComments).where(eq(feedbackComments.id, commentId));
  }

  async setOfficialResponse(commentId: number, isOfficial: boolean): Promise<void> {
    await db.update(feedbackComments).set({ isOfficialResponse: isOfficial }).where(eq(feedbackComments.id, commentId));
  }

  async clearOfficialResponse(feedbackId: number): Promise<void> {
    await db.update(feedbackComments).set({ isOfficialResponse: false }).where(eq(feedbackComments.feedbackId, feedbackId));
  }

  async getFeedbackComment(commentId: number): Promise<FeedbackComment | undefined> {
    const [comment] = await db.select().from(feedbackComments).where(eq(feedbackComments.id, commentId));
    return comment;
  }
}

export const storage = new DatabaseStorage();
