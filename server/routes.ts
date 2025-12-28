import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { addDays, addWeeks, addMonths, addYears, differenceInDays, isBefore, isAfter, parseISO } from "date-fns";

// Helper to calculate task details
async function enrichTask(task: any, userId: string) {
  const category = task.categoryId ? (await storage.getCategories(userId)).find(c => c.id === task.categoryId) : null;
  const taskTags = await storage.getTaskTags(task.id);
  
  let nextDue = new Date();
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
    // Never done - due immediately (or in past to show urgency)
    // We can set it to a past date to ensure it shows as overdue
    nextDue = new Date(0); // 1970 - definitely overdue
  }

  const now = new Date();
  const daysUntilDue = differenceInDays(nextDue, now);
  
  let status: 'overdue' | 'due_soon' | 'later' | 'never_done' = 'later';
  if (!task.lastCompletedAt) {
    status = 'never_done';
  } else if (isBefore(nextDue, now)) {
    status = 'overdue';
  } else if (daysUntilDue <= 3) {
    status = 'due_soon';
  }

  // Calculate urgency score (higher = more urgent)
  // Overdue by many days = high score.
  // Due soon = medium score.
  // Later = low score.
  let urgency = 0;
  if (status === 'never_done') urgency = 1000;
  else if (status === 'overdue') urgency = 500 + Math.abs(daysUntilDue);
  else if (status === 'due_soon') urgency = 100 - daysUntilDue;
  else urgency = -daysUntilDue; // Further away = lower score

  return {
    ...task,
    category,
    tags: taskTags,
    status,
    nextDue: nextDue.toISOString(),
    daysUntilDue,
    urgency
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
      filtered = filtered.filter(t => t.tags.some(tag => tag.id === Number(tagId)));
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
    
    const updated = await storage.completeTask(taskId, completedAt, input.notes);
    const enriched = await enrichTask(updated, userId);
    res.json(enriched);
  });

  app.get(api.categories.list.path, requireAuth, async (req: any, res) => {
    const categories = await storage.getCategories(req.user.claims.sub);
    res.json(categories);
  });

  app.post(api.categories.create.path, requireAuth, async (req: any, res) => {
    const category = await storage.createCategory(req.user.claims.sub, req.body);
    res.status(201).json(category);
  });

  app.get(api.tags.list.path, requireAuth, async (req: any, res) => {
    const tags = await storage.getTags(req.user.claims.sub);
    res.json(tags);
  });

  app.post(api.tags.create.path, requireAuth, async (req: any, res) => {
    const tag = await storage.createTag(req.user.claims.sub, req.body);
    res.status(201).json(tag);
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

  // SEED DATA (for demo)
  // We can't easily seed for a user we don't know the ID of until they log in.
  // But we can add a check: IF user has 0 tasks, add some sample ones.
  // I'll add this to the list endpoint.
  
  // NOTE: Modifying the list endpoint above to auto-seed.
  const originalListHandler = app._router.stack.find((r: any) => r.route && r.route.path === api.tasks.list.path)?.route.stack[0].handle;
  
  // Actually, re-writing the handler is cleaner.
  // I'll just rely on the user manually creating tasks, OR I can inject a seeding step.
  // Let's add a "seed" query param or just check on list.
  
  // Adding seeding logic to list endpoint:
  app.get(api.tasks.list.path, requireAuth, async (req: any, res) => {
      const userId = req.user.claims.sub;
      let tasks = await storage.getTasks(userId);

      if (tasks.length === 0) {
        // Seed
        const defaultCategory = await storage.createCategory(userId, { name: "General" });
        await storage.createTask(userId, { title: "Change Toothbrush", intervalValue: 3, intervalUnit: "months", categoryId: defaultCategory.id, isArchived: false });
        await storage.createTask(userId, { title: "Water Plants", intervalValue: 1, intervalUnit: "weeks", categoryId: defaultCategory.id, isArchived: false });
        await storage.createTask(userId, { title: "Check Tire Pressure", intervalValue: 1, intervalUnit: "months", categoryId: defaultCategory.id, isArchived: false });
        
        // Refresh
        tasks = await storage.getTasks(userId);
      }

      const enrichedTasks = await Promise.all(tasks.map(t => enrichTask(t, userId)));
      enrichedTasks.sort((a, b) => b.urgency - a.urgency);

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
        filtered = filtered.filter(t => t.tags.some(tag => tag.id === Number(tagId)));
      }

      res.json(filtered);
  });

  return httpServer;
}
