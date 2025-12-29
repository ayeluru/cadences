import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { addDays, addWeeks, addMonths, addYears, differenceInDays, differenceInMinutes, isBefore, isAfter, isSameDay, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, format } from "date-fns";

// Get period boundaries for frequency-based tasks
function getPeriodBounds(period: string): { start: Date, end: Date } {
  const now = new Date();
  if (period === 'week') {
    return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
  } else if (period === 'month') {
    return { start: startOfMonth(now), end: endOfMonth(now) };
  } else {
    return { start: startOfYear(now), end: endOfYear(now) };
  }
}

// Calculate cadence duration in days
function getCadenceDays(task: any): number {
  if (task.taskType === 'frequency' && task.targetPeriod) {
    // For frequency tasks, cadence = period / target
    const periodDays = task.targetPeriod === 'week' ? 7 : task.targetPeriod === 'month' ? 30 : 365;
    return periodDays / (task.targetCount || 1);
  } else if (task.intervalValue && task.intervalUnit) {
    // For interval tasks
    switch (task.intervalUnit) {
      case 'days': return task.intervalValue;
      case 'weeks': return task.intervalValue * 7;
      case 'months': return task.intervalValue * 30;
      case 'years': return task.intervalValue * 365;
      default: return task.intervalValue;
    }
  }
  return 1; // Default to 1 day
}

// Calculate "due soon" threshold as 20% of cadence, clamped between 1 and 14 days
function getDueSoonThreshold(cadenceDays: number): number {
  const threshold = cadenceDays * 0.2;
  return Math.max(1, Math.min(14, Math.ceil(threshold)));
}

// Filter completions respecting refractory period
function filterCompletionsWithRefractory(completions: any[], refractoryMinutes: number | null): any[] {
  if (!refractoryMinutes || refractoryMinutes <= 0) return completions;
  
  // Sort by date ascending
  const sorted = [...completions].sort((a, b) => 
    new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime()
  );
  
  const filtered: any[] = [];
  let lastValid: Date | null = null;
  
  for (const completion of sorted) {
    const completedAt = new Date(completion.completedAt);
    if (!lastValid || differenceInMinutes(completedAt, lastValid) >= refractoryMinutes) {
      filtered.push(completion);
      lastValid = completedAt;
    }
  }
  
  return filtered;
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
    let allCompletions = await storage.getCompletionsInPeriod(task.id, start, end);
    
    // Also count completions from variations
    for (const variation of variations) {
      const varCompletions = await storage.getCompletionsInPeriod(variation.id, start, end);
      allCompletions = [...allCompletions, ...varCompletions];
    }
    
    // Apply refractory period filter if set
    const validCompletions = filterCompletionsWithRefractory(allCompletions, task.refractoryMinutes);
    
    completionsThisPeriod = validCompletions.length;
    targetProgress = Math.min(100, (completionsThisPeriod / task.targetCount) * 100);
    
    // Due when we haven't hit target
    if (completionsThisPeriod >= task.targetCount) {
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
  
  // Calculate dynamic "due soon" threshold based on cadence (20% of cadence, clamped 1-14 days)
  const cadenceDays = getCadenceDays(task);
  const dueSoonThreshold = getDueSoonThreshold(cadenceDays);
  
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
  } else if (daysUntilDue <= dueSoonThreshold) {
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

  // Delete task with full cascade (removes all associated data)
  app.delete("/api/tasks/:id/cascade", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = Number(req.params.id);
      await storage.deleteTaskWithCascade(taskId, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(403).json({ message: error.message });
    }
  });

  // Archive task (stop recurring but keep history)
  app.post("/api/tasks/:id/archive", requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = Number(req.params.id);
      const archived = await storage.archiveTask(taskId, userId);
      const enriched = await enrichTask(archived, userId);
      res.json(enriched);
    } catch (error: any) {
      res.status(403).json({ message: error.message });
    }
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

  // Profiles
  app.get("/api/profiles", requireAuth, async (req: any, res) => {
    const profilesList = await storage.getProfiles(req.user.claims.sub);
    res.json(profilesList);
  });

  app.get("/api/profiles/default", requireAuth, async (req: any, res) => {
    const profile = await storage.getOrCreateDefaultProfile(req.user.claims.sub);
    res.json(profile);
  });

  app.post("/api/profiles", requireAuth, async (req: any, res) => {
    const { name, slug, isDemo } = req.body;
    const profile = await storage.createProfile(req.user.claims.sub, { 
      name, 
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
      isDemo: isDemo || false 
    });
    res.status(201).json(profile);
  });

  app.patch("/api/profiles/:id", requireAuth, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const userId = req.user.claims.sub;
      const profile = await storage.updateProfile(profileId, userId, req.body);
      res.json(profile);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });

  app.delete("/api/profiles/:id", requireAuth, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const userId = req.user.claims.sub;
      
      // Don't allow deleting the last profile
      const allProfiles = await storage.getProfiles(userId);
      if (allProfiles.length <= 1) {
        return res.status(400).json({ error: "Cannot delete the last profile" });
      }
      
      await storage.deleteProfile(profileId, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
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

  // Task history with metrics for each completion
  app.get("/api/tasks/:id/history", requireAuth, async (req: any, res) => {
    const taskId = Number(req.params.id);
    const userId = req.user.claims.sub;
    const task = await storage.getTask(taskId);
    
    if (!task || task.userId !== userId) {
      return res.status(404).json({ message: "Task not found" });
    }
    
    const taskCompletions = await storage.getCompletions(taskId);
    const taskMetrics = await storage.getTaskMetrics(taskId);
    
    // Get metric values for each completion
    const completionsWithMetrics = await Promise.all(taskCompletions.map(async (completion) => {
      const metricValuesData = await storage.getMetricValues(completion.id);
      return {
        ...completion,
        metricValues: metricValuesData,
      };
    }));
    
    res.json({
      task: await enrichTask(task, userId),
      completions: completionsWithMetrics,
      metrics: taskMetrics,
    });
  });

  // Calendar aggregation endpoint
  app.get("/api/completions/calendar", requireAuth, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const startStr = req.query.start as string;
    const endStr = req.query.end as string;
    
    if (!startStr || !endStr) {
      return res.status(400).json({ message: "Start and end dates required" });
    }
    
    const startDate = parseISO(startStr);
    const endDate = parseISO(endStr);
    
    const calendarData = await storage.getCompletionsForCalendar(userId, startDate, endDate);
    res.json(calendarData);
  });

  // Enhanced calendar API with completions, missed tasks, and future due dates
  app.get("/api/calendar/enhanced", requireAuth, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const startStr = req.query.start as string;
    const endStr = req.query.end as string;
    
    if (!startStr || !endStr) {
      return res.status(400).json({ message: "Start and end dates required" });
    }
    
    const startDate = parseISO(startStr);
    const endDate = parseISO(endStr);
    const today = new Date();
    
    // Get all completions in range
    const completionsData = await storage.getCompletionsForCalendar(userId, startDate, endDate);
    
    // Get all tasks to calculate missed and future due
    const allTasks = await storage.getTasks(userId);
    const enrichedTasks = await Promise.all(allTasks.map(t => enrichTask(t, userId)));
    
    // Build day-by-day data
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const calendarMap = new Map<string, {
      date: string;
      completions: Array<{ id: number; title: string; completedAt: string; taskId: number }>;
      missed: Array<{ id: number; title: string; dueDate: string }>;
      dueSoon: Array<{ id: number; title: string; dueDate: string }>;
    }>();
    
    // Initialize all days
    days.forEach(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      calendarMap.set(dateStr, {
        date: dateStr,
        completions: [],
        missed: [],
        dueSoon: [],
      });
    });
    
    // Add completions
    completionsData.forEach((dayData: any) => {
      const existing = calendarMap.get(dayData.date);
      if (existing) {
        existing.completions = dayData.tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          completedAt: t.completedAt,
          taskId: t.taskId || t.id,
        }));
      }
    });
    
    // Calculate missed tasks (overdue before today) and upcoming due dates
    for (const task of enrichedTasks) {
      if (task.isArchived || task.parentTaskId) continue; // Skip archived and variations
      
      const nextDueDate = new Date(task.nextDue);
      const nextDueDateStr = format(nextDueDate, "yyyy-MM-dd");
      
      // If task is overdue and due date is in range and before today
      if (task.status === 'overdue' && isBefore(nextDueDate, today) && !isSameDay(nextDueDate, today)) {
        const entry = calendarMap.get(nextDueDateStr);
        if (entry) {
          entry.missed.push({
            id: task.id,
            title: task.title,
            dueDate: task.nextDue,
          });
        }
      }
      
      // Future due dates - show tasks scheduled for future days (or today if not yet complete)
      // Only show tasks that aren't completed for the current period
      if ((isAfter(nextDueDate, today) || isSameDay(nextDueDate, today)) && task.status !== 'later') {
        const entry = calendarMap.get(nextDueDateStr);
        if (entry) {
          entry.dueSoon.push({
            id: task.id,
            title: task.title,
            dueDate: task.nextDue,
          });
        }
      }
    }
    
    res.json(Array.from(calendarMap.values()));
  });

  // Delete a completion
  app.delete("/api/completions/:id", requireAuth, async (req: any, res) => {
    const completionId = Number(req.params.id);
    const userId = req.user.claims.sub;
    
    try {
      await storage.deleteCompletion(completionId, userId);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message === "Completion not found") {
        return res.status(404).json({ message: error.message });
      }
      if (error.message === "Access denied") {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: error.message });
    }
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

  // Create demo profile with sample data
  app.post("/api/profiles/demo", requireAuth, async (req: any, res) => {
    const userId = req.user.claims.sub;
    try {
      // Check if demo profile already exists
      const existingProfiles = await storage.getProfiles(userId);
      const demoProfile = existingProfiles.find(p => p.isDemo);
      
      if (demoProfile) {
        return res.status(400).json({ 
          success: false, 
          message: "Demo profile already exists. Delete it first to create a new one.",
          profile: demoProfile
        });
      }
      
      // Create demo profile
      const profile = await storage.createProfile(userId, {
        name: "Demo",
        slug: "demo",
        isDemo: true
      });
      
      // Seed the demo profile with sample data
      const result = await storage.seedDemoProfile(userId, profile.id);
      
      res.status(201).json({ 
        success: true, 
        message: "Demo profile created with sample data",
        profile 
      });
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
