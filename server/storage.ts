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
  getTaskMetric(metricId: number): Promise<TaskMetric | undefined>;
  createTaskMetric(metric: InsertTaskMetric): Promise<TaskMetric>;
  deleteTaskMetric(metricId: number): Promise<void>;
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

    // Create routines
    const morningRoutine = await this.createRoutine(userId, { name: "Morning Routine", description: "Start the day right" });
    const legDayRoutine = await this.createRoutine(userId, { name: "Leg Day", description: "Lower body workout" });
    const weeklyChoresRoutine = await this.createRoutine(userId, { name: "Weekly Chores", description: "Keep the house clean" });

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
      routineId: morningRoutine.id,
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
      routineId: morningRoutine.id,
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
      routineId: morningRoutine.id,
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
      routineId: morningRoutine.id,
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
      routineId: weeklyChoresRoutine.id,
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
      routineId: weeklyChoresRoutine.id,
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

    // Squats - Leg Day routine, frequency target 3x/week
    const squats = await this.createTask(userId, {
      title: "Squats",
      taskType: "frequency",
      targetCount: 3,
      targetPeriod: "week",
      categoryId: exerciseCat.id,
      routineId: legDayRoutine.id,
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
      routineId: legDayRoutine.id,
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
      routineId: legDayRoutine.id,
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
      routineId: legDayRoutine.id,
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
      message: "Created 25+ tasks with 90+ days of history, multiple routines, and metric tracking!" 
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
        sql`${completions.taskId} = ANY(${taskIds})`
      );
      const completionIds = taskCompletions.map(c => c.id);
      
      if (completionIds.length > 0) {
        await db.delete(metricValues).where(
          sql`${metricValues.completionId} = ANY(${completionIds})`
        );
      }

      // Delete completions
      await db.delete(completions).where(
        sql`${completions.taskId} = ANY(${taskIds})`
      );

      // Delete task metrics
      await db.delete(taskMetrics).where(
        sql`${taskMetrics.taskId} = ANY(${taskIds})`
      );

      // Delete task tags
      await db.delete(taskTags).where(
        sql`${taskTags.taskId} = ANY(${taskIds})`
      );

      // Delete streaks
      await db.delete(taskStreaks).where(eq(taskStreaks.userId, userId));

      // Delete tasks (hard delete for reset)
      await db.delete(tasks).where(eq(tasks.userId, userId));
    }

    // Delete routines
    await db.delete(routines).where(eq(routines.userId, userId));

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
