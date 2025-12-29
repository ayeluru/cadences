import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { addDays, addWeeks, addMonths, addYears, differenceInDays, isBefore, isAfter, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

// Get period boundaries for frequency-based tasks
function getPeriodBounds(period: string): { start: Date, end: Date } {
  const now = new Date();
  if (period === 'week') {
    return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
  } else {
    return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

// Helper to calculate task details
async function enrichTask(task: any, userId: string) {
  const category = task.categoryId ? (await storage.getCategories(userId)).find(c => c.id === task.categoryId) : null;
  const taskTags = await storage.getTaskTags(task.id);
  const taskMetrics = await storage.getTaskMetrics(task.id);
  const variations = await storage.getTaskVariations(task.id);
  const routines = await storage.getRoutines(userId);
  const routine = task.routineId ? routines.find(r => r.id === task.routineId) : null;
  
  let nextDue = new Date();
  let completionsThisPeriod = 0;
  let targetProgress = 0;
  
  // Handle frequency-based tasks differently
  if (task.taskType === 'frequency' && task.targetCount && task.targetPeriod) {
    const { start, end } = getPeriodBounds(task.targetPeriod);
    
    // Get completions for this task (and its variations) in the current period
    const taskCompletions = await storage.getCompletionsInPeriod(task.id, start, end);
    let totalCompletions = taskCompletions.length;
    
    // Also count completions from variations
    for (const variation of variations) {
      const varCompletions = await storage.getCompletionsInPeriod(variation.id, start, end);
      totalCompletions += varCompletions.length;
    }
    
    completionsThisPeriod = totalCompletions;
    targetProgress = Math.min(100, (totalCompletions / task.targetCount) * 100);
    
    // Due when we haven't hit target
    if (totalCompletions >= task.targetCount) {
      nextDue = end; // Not due until next period
    } else {
      nextDue = new Date(); // Due now
    }
  } else if (task.intervalValue && task.intervalUnit) {
    // Interval-based task
    if (task.lastCompletedAt) {
      const last = new Date(task.lastCompletedAt);
      const val = task.intervalValue;
      switch (task.intervalUnit) {
        case 'days': nextDue = addDays(last, val); break;
        case 'weeks': nextDue = addWeeks(last, val); break;
        case 'months': nextDue = addMonths(last, val); break;
        case 'years': nextDue = addYears(last, val); break;
        default: nextDue = addDays(last, val);
      }
    } else {
      nextDue = new Date(0); // Never done - definitely overdue
    }
  }

  const now = new Date();
  const daysUntilDue = differenceInDays(nextDue, now);
  
  let status: 'overdue' | 'due_soon' | 'later' | 'never_done' = 'later';
  if (!task.lastCompletedAt && task.taskType !== 'frequency') {
    status = 'never_done';
  } else if (task.taskType === 'frequency') {
    // For frequency tasks, check if target is met
    if (completionsThisPeriod >= (task.targetCount || 0)) {
      status = 'later';
    } else if (completionsThisPeriod === 0) {
      status = 'never_done';
    } else {
      status = 'due_soon'; // In progress but not complete
    }
  } else if (isBefore(nextDue, now)) {
    status = 'overdue';
  } else if (daysUntilDue <= 3) {
    status = 'due_soon';
  }

  // Calculate urgency score
  let urgency = 0;
  if (task.taskType === 'frequency') {
    const remaining = (task.targetCount || 0) - completionsThisPeriod;
    if (remaining > 0) {
      urgency = 200 + remaining * 50; // Higher urgency if more remain
    } else {
      urgency = -100; // Done for this period
    }
  } else if (status === 'never_done') {
    urgency = 1000;
  } else if (status === 'overdue') {
    urgency = 500 + Math.abs(daysUntilDue);
  } else if (status === 'due_soon') {
    urgency = 100 - daysUntilDue;
  } else {
    urgency = -daysUntilDue;
  }

  // Get streak data
  const streak = await storage.getTaskStreak(task.id, userId);

  return {
    ...task,
    category,
    routine,
    tags: taskTags,
    metrics: taskMetrics,
    variations: variations,
    status,
    nextDue: nextDue.toISOString(),
    daysUntilDue,
    urgency,
    completionsThisPeriod,
    targetProgress,
    streak
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth Setup
  await setupAuth(app);
  registerAuthRoutes(app);

  const requireAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: "Unauthorized" });
  };

  // API Routes
  app.get(api.tasks.list.path, requireAuth, async (req: any, res) => {
    const userId = req.user.claims.sub; // Replit Auth user ID
    let tasks = await storage.getTasks(userId);
    
    // Enrich
    const enrichedTasks = await Promise.all(tasks.map(t => enrichTask(t, userId)));
    
    // Sort by urgency desc
    enrichedTasks.sort((a, b) => b.urgency - a.urgency);

    // Filtering
    const { search, categoryId, tagId } = req.query;
    let filtered = enrichedTasks;
    
    if (search) {
      const lower = String(search).toLowerCase();
      filtered = filtered.filter(t => t.title.toLowerCase().includes(lower));
    }
    if (categoryId) {
      filtered = filtered.filter(t => t.categoryId === Number(categoryId));
    }
    if (tagId) {
      filtered = filtered.filter(t => t.tags.some((tag: any) => tag.id === Number(tagId)));
    }

    res.json(filtered);
  });

  app.get(api.tasks.get.path, requireAuth, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const task = await storage.getTask(Number(req.params.id));
    
    if (!task || task.userId !== userId) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    const enriched = await enrichTask(task, userId);
    res.json(enriched);
  });

  app.post(api.tasks.create.path, requireAuth, async (req: any, res) => {
    try {
      const input = api.tasks.create.input.parse(req.body);
      const userId = req.user.claims.sub;
      const { tagIds, ...taskData } = input;
      const task = await storage.createTask(userId, taskData, tagIds);
      const enriched = await enrichTask(task, userId);
      res.status(201).json(enriched);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.tasks.update.path, requireAuth, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const taskId = Number(req.params.id);
    const existing = await storage.getTask(taskId);
    
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ message: "Task not found" });
    }

    const input = api.tasks.update.input.parse(req.body);
    const { tagIds, ...updates } = input;
    const updated = await storage.updateTask(taskId, updates, tagIds);
    const enriched = await enrichTask(updated, userId);
    res.json(enriched);
  });

  app.delete(api.tasks.delete.path, requireAuth, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const taskId = Number(req.params.id);
    const existing = await storage.getTask(taskId);
    
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ message: "Task not found" });
    }

    await storage.deleteTask(taskId);
    res.status(204).send();
  });

  app.post(api.tasks.complete.path, requireAuth, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const taskId = Number(req.params.id);
    const existing = await storage.getTask(taskId);
    
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ message: "Task not found" });
    }

    const input = api.tasks.complete.input.optional().parse(req.body) || {};
    const completedAt = input.completedAt ? new Date(input.completedAt) : new Date();
    
    // Parse metric data if provided
    const metricData = (req.body.metrics || []) as {metricId: number, value: number | string}[];
    
    const { task: updated, completion, streak } = await storage.completeTask(taskId, completedAt, input.notes, metricData, userId);
    const enriched = await enrichTask(updated, userId);
    res.json({ ...enriched, lastCompletion: completion, streak });
  });

  app.get(api.categories.list.path, requireAuth, async (req: any, res) => {
    const categories = await storage.getCategories(req.user.claims.sub);
    res.json(categories);
  });

  app.post(api.categories.create.path, requireAuth, async (req: any, res) => {
    const category = await storage.createCategory(req.user.claims.sub, req.body);
    res.status(201).json(category);
  });

  app.delete("/api/categories/:id", requireAuth, async (req: any, res) => {
    try {
      const categoryId = Number(req.params.id);
      const userId = req.user.claims.sub;
      await storage.deleteCategory(categoryId, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(403).json({ message: error.message });
    }
  });

  app.get(api.tags.list.path, requireAuth, async (req: any, res) => {
    const tags = await storage.getTags(req.user.claims.sub);
    res.json(tags);
  });

  app.post(api.tags.create.path, requireAuth, async (req: any, res) => {
    const tag = await storage.createTag(req.user.claims.sub, req.body);
    res.status(201).json(tag);
  });

  // Routines
  app.get("/api/routines", requireAuth, async (req: any, res) => {
    const routinesList = await storage.getRoutines(req.user.claims.sub);
    res.json(routinesList);
  });

  app.post("/api/routines", requireAuth, async (req: any, res) => {
    const routine = await storage.createRoutine(req.user.claims.sub, req.body);
    res.status(201).json(routine);
  });

  app.delete("/api/routines/:id", requireAuth, async (req: any, res) => {
    try {
      const routineId = Number(req.params.id);
      const userId = req.user.claims.sub;
      await storage.deleteRoutine(routineId, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(403).json({ message: error.message });
    }
  });

  // Task Metrics
  app.get("/api/tasks/:id/metrics", requireAuth, async (req: any, res) => {
    const taskId = Number(req.params.id);
    const metricsData = await storage.getTaskMetrics(taskId);
    res.json(metricsData);
  });

  app.post("/api/tasks/:id/metrics", requireAuth, async (req: any, res) => {
    const taskId = Number(req.params.id);
    const userId = req.user.claims.sub;
    const existing = await storage.getTask(taskId);
    
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    const metric = await storage.createTaskMetric({ ...req.body, taskId });
    res.status(201).json(metric);
  });

  app.delete("/api/metrics/:id", requireAuth, async (req: any, res) => {
    const metricId = Number(req.params.id);
    const userId = req.user.claims.sub;
    
    const metric = await storage.getTaskMetric(metricId);
    if (!metric) {
      return res.status(404).json({ message: "Metric not found" });
    }
    
    const task = await storage.getTask(metric.taskId);
    if (!task || task.userId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    await storage.deleteTaskMetric(metricId);
    res.json({ success: true });
  });

  // Metric History
  app.get("/api/metrics/:id/history", requireAuth, async (req: any, res) => {
    const metricId = Number(req.params.id);
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const history = await storage.getMetricHistory(metricId, limit);
    res.json(history);
  });

  // Task Variations
  app.get("/api/tasks/:id/variations", requireAuth, async (req: any, res) => {
    const parentId = Number(req.params.id);
    const variationsList = await storage.getTaskVariations(parentId);
    res.json(variationsList);
  });

  // Task completions history
  app.get("/api/tasks/:id/completions", requireAuth, async (req: any, res) => {
    const taskId = Number(req.params.id);
    const userId = req.user.claims.sub;
    const task = await storage.getTask(taskId);
    
    if (!task || task.userId !== userId) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    const taskCompletions = await storage.getCompletions(taskId);
    res.json(taskCompletions);
  });

  // Streaks endpoint
  app.get("/api/streaks", requireAuth, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const allStreaks = await storage.getAllStreaks(userId);
    
    // Enrich with task names
    const enrichedStreaks = await Promise.all(allStreaks.map(async (streak) => {
      const task = await storage.getTask(streak.taskId);
      return {
        ...streak,
        taskTitle: task?.title || "Unknown Task"
      };
    }));
    
    res.json(enrichedStreaks);
  });

  app.get(api.stats.get.path, requireAuth, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const completions = await storage.getAllCompletions(userId);
    const tasks = await storage.getTasks(userId);
    const enrichedTasks = await Promise.all(tasks.map(t => enrichTask(t, userId)));
    
    // Calculate stats
    const totalCompletions = completions.length;
    
    // Group by month
    const completionsByMonthMap = new Map<string, number>();
    completions.forEach(c => {
      const month = c.completedAt.toISOString().slice(0, 7); // YYYY-MM
      completionsByMonthMap.set(month, (completionsByMonthMap.get(month) || 0) + 1);
    });
    
    const completionsByMonth = Array.from(completionsByMonthMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Overdue rate
    const overdueCount = enrichedTasks.filter(t => t.status === 'overdue' || t.status === 'never_done').length;
    const overdueRate = tasks.length > 0 ? overdueCount / tasks.length : 0;

    res.json({
      totalCompletions,
      completionsByMonth,
      overdueRate
    });
  });

  // Seed data endpoint
  app.post("/api/seed", requireAuth, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      const result = await storage.seedUserData(userId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Clear all user data endpoint (for resetting before seeding)
  app.delete("/api/clear-data", requireAuth, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      await storage.clearUserData(userId);
      res.json({ success: true, message: "All data cleared" });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return httpServer;
}
