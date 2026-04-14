import { addDays, addWeeks, addMonths, addYears, differenceInDays, differenceInMinutes, isBefore, isAfter, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import type { Task, Category, Tag, TaskMetric, TaskVariation, TaskStreak, Completion } from '../../shared/schema.js';
import { DatabaseStorage } from './storage.js';

const storage = new DatabaseStorage();

export interface BatchData {
  categories: Category[];
  tagsMap: Map<number, Tag[]>;
  metricsMap: Map<number, TaskMetric[]>;
  variationsMap: Map<number, TaskVariation[]>;
  streaksMap: Map<number, TaskStreak>;
  completionsInPeriodMap: Map<number, Completion[]>;
  completionsMap: Map<number, Completion[]>;
}

// Get period boundaries for frequency-based tasks
export function getPeriodBounds(period: string): { start: Date, end: Date } {
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
export function getCadenceDays(task: any): number {
  if (task.taskType === 'frequency' && task.targetPeriod) {
    const periodDays = task.targetPeriod === 'week' ? 7 : task.targetPeriod === 'month' ? 30 : 365;
    return periodDays / (task.targetCount || 1);
  } else if (task.intervalValue && task.intervalUnit) {
    switch (task.intervalUnit) {
      case 'days': return task.intervalValue;
      case 'weeks': return task.intervalValue * 7;
      case 'months': return task.intervalValue * 30;
      case 'years': return task.intervalValue * 365;
      default: return task.intervalValue;
    }
  }
  return 1;
}

// Calculate "due soon" threshold as 20% of cadence, clamped between 1 and 14 days
export function getDueSoonThreshold(cadenceDays: number): number {
  const threshold = cadenceDays * 0.2;
  return Math.max(1, Math.min(14, Math.ceil(threshold)));
}

// Filter completions respecting refractory period
export function filterCompletionsWithRefractory(completions: any[], refractoryMinutes: number | null): any[] {
  if (!refractoryMinutes || refractoryMinutes <= 0) return completions;

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

// Helper to calculate task details — accepts optional pre-fetched BatchData to avoid N+1 queries
export async function enrichTask(task: any, userId: string, batch?: BatchData) {
  const categoriesList = batch ? batch.categories : await storage.getCategories(userId);
  const category = task.categoryId ? categoriesList.find(c => c.id === task.categoryId) : null;
  const taskTags = batch ? (batch.tagsMap.get(task.id) || []) : await storage.getTaskTags(task.id);
  const taskMetrics = batch ? (batch.metricsMap.get(task.id) || []) : await storage.getTaskMetrics(task.id);
  const variations = batch ? (batch.variationsMap.get(task.id) || []) : await storage.getTaskVariations(task.id);

  let nextDue = new Date();
  let completionsThisPeriod = 0;
  let targetProgress = 0;

  // Handle frequency-based tasks differently
  if (task.taskType === 'frequency' && task.targetCount && task.targetPeriod) {
    const { start, end } = getPeriodBounds(task.targetPeriod);
    const allCompletions = batch
      ? (batch.completionsInPeriodMap.get(task.id) || [])
      : await storage.getCompletionsInPeriod(task.id, start, end);
    const validCompletions = filterCompletionsWithRefractory(allCompletions, task.refractoryMinutes);

    completionsThisPeriod = validCompletions.length;
    targetProgress = Math.min(100, (completionsThisPeriod / task.targetCount) * 100);

    if (completionsThisPeriod >= task.targetCount) {
      nextDue = end;
    } else {
      nextDue = new Date();
    }
  } else if (task.taskType === 'scheduled') {
    // Scheduled task - find next occurrence based on schedule
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let foundNextDue = false;

    let scheduledHour = 0;
    let scheduledMinute = 0;
    if (task.scheduledTime) {
      const [h, m] = task.scheduledTime.split(':').map(Number);
      scheduledHour = h || 0;
      scheduledMinute = m || 0;
    }

    const wasCompletedAfter = (dateTime: Date): boolean => {
      if (!task.lastCompletedAt) return false;
      return new Date(task.lastCompletedAt) >= dateTime;
    };

    // Check specific dates first
    if (task.scheduledDates) {
      const scheduledDates = task.scheduledDates.split(',').map((d: string) => d.trim()).filter(Boolean);
      const dateCandidates = scheduledDates
        .map((dateStr: string) => {
          const date = new Date(dateStr + 'T00:00:00');
          date.setHours(scheduledHour, scheduledMinute, 0, 0);
          return date;
        })
        .filter((d: Date) => !isNaN(d.getTime()))
        .sort((a: Date, b: Date) => a.getTime() - b.getTime());

      for (const candidate of dateCandidates) {
        if (candidate >= now && !wasCompletedAfter(candidate)) {
          nextDue = candidate;
          foundNextDue = true;
          break;
        }
      }
    }

    if (!foundNextDue && task.scheduledDaysOfWeek) {
      const scheduledDays = task.scheduledDaysOfWeek.split(',').map(Number).filter((d: number) => d >= 0 && d <= 6);
      for (let i = 0; i <= 8 && !foundNextDue; i++) {
        const checkDate = addDays(today, i);
        const dayOfWeek = checkDate.getDay();
        if (scheduledDays.includes(dayOfWeek)) {
          const candidate = new Date(checkDate);
          candidate.setHours(scheduledHour, scheduledMinute, 0, 0);
          if (candidate >= now && !wasCompletedAfter(candidate)) {
            nextDue = candidate;
            foundNextDue = true;
          }
        }
      }
    }

    if (!foundNextDue && task.scheduledDaysOfMonth) {
      const rawDays = task.scheduledDaysOfMonth.split(',')
        .map((d: string) => parseInt(d.trim()))
        .filter((d: number) => !isNaN(d) && ((d >= 1 && d <= 31) || (d >= -31 && d <= -1)));

      for (let monthOffset = 0; monthOffset <= 2 && !foundNextDue; monthOffset++) {
        const checkMonth = addMonths(today, monthOffset);
        const daysInMonth = new Date(checkMonth.getFullYear(), checkMonth.getMonth() + 1, 0).getDate();

        // Resolve negative days relative to month end: -1 = last day, -2 = 2nd to last
        const resolvedDays = rawDays
          .map((d: number) => d < 0 ? daysInMonth + 1 + d : d)
          .filter((d: number) => d >= 1 && d <= daysInMonth)
          .sort((a: number, b: number) => a - b);

        for (const day of resolvedDays) {
          const candidate = new Date(checkMonth.getFullYear(), checkMonth.getMonth(), day);
          candidate.setHours(scheduledHour, scheduledMinute, 0, 0);
          if (candidate >= now && !wasCompletedAfter(candidate)) {
            nextDue = candidate;
            foundNextDue = true;
            break;
          }
        }
      }
    }

    if (!foundNextDue) {
      nextDue = new Date();
    }
  } else if (task.intervalValue && task.intervalUnit) {
    if (task.lastCompletedAt) {
      const lastCompleted = new Date(task.lastCompletedAt);
      switch (task.intervalUnit) {
        case 'days':
          nextDue = addDays(lastCompleted, task.intervalValue);
          break;
        case 'weeks':
          nextDue = addWeeks(lastCompleted, task.intervalValue);
          break;
        case 'months':
          nextDue = addMonths(lastCompleted, task.intervalValue);
          break;
        case 'years':
          nextDue = addYears(lastCompleted, task.intervalValue);
          break;
        default:
          nextDue = addDays(lastCompleted, task.intervalValue);
      }
    } else {
      nextDue = new Date(0);
    }
  }

  const now = new Date();
  const daysUntilDue = differenceInDays(nextDue, now);
  const cadenceDays = getCadenceDays(task);
  const dueSoonThreshold = getDueSoonThreshold(cadenceDays);

  let status: 'overdue' | 'due_soon' | 'later' | 'never_done' = 'later';
  if (!task.lastCompletedAt && task.taskType !== 'frequency' && task.taskType !== 'scheduled') {
    status = 'never_done';
  } else if (task.taskType === 'scheduled') {
    let scheduledCadenceDays = 7;
    if (task.scheduledDaysOfWeek) {
      const days = task.scheduledDaysOfWeek.split(',').length;
      scheduledCadenceDays = Math.ceil(7 / Math.max(days, 1));
    } else if (task.scheduledDaysOfMonth) {
      const days = task.scheduledDaysOfMonth.split(',').length;
      scheduledCadenceDays = Math.ceil(30 / Math.max(days, 1));
    }
    const scheduledDueSoonThreshold = getDueSoonThreshold(scheduledCadenceDays);

    if (!task.lastCompletedAt && !task.scheduledDates) {
      status = 'never_done';
    } else if (isBefore(nextDue, now)) {
      status = 'overdue';
    } else if (daysUntilDue <= scheduledDueSoonThreshold) {
      status = 'due_soon';
    }
  } else if (task.taskType === 'frequency') {
    if (completionsThisPeriod >= (task.targetCount || 0)) {
      status = 'later';
    } else if (completionsThisPeriod === 0) {
      status = 'never_done';
    } else {
      status = 'due_soon';
    }
  } else if (isBefore(nextDue, now)) {
    status = 'overdue';
  } else if (daysUntilDue <= dueSoonThreshold) {
    status = 'due_soon';
  }

  let urgency = 0;
  if (task.taskType === 'frequency') {
    const remaining = (task.targetCount || 0) - completionsThisPeriod;
    if (remaining > 0) {
      urgency = 200 + remaining * 50;
    } else {
      urgency = -100;
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
  const streak = batch ? batch.streaksMap.get(task.id) : await storage.getTaskStreak(task.id, userId);

  // Get variation stats if there are variations
  let variationStats: any[] = [];
  if (variations.length > 0) {
    if (batch?.completionsMap) {
      const taskCompletions = batch.completionsMap.get(task.id) || [];
      const totalWithVariation = taskCompletions.filter(c => c.variationId !== null).length;
      variationStats = variations.map(v => {
        const count = taskCompletions.filter(c => c.variationId === v.id).length;
        const percentage = totalWithVariation > 0 ? Math.round((count / totalWithVariation) * 100) : 0;
        return { variationId: v.id, name: v.name, count, percentage };
      }).sort((a, b) => b.count - a.count);
    } else {
      variationStats = await storage.getVariationStats(task.id);
    }
  }

  return {
    ...task,
    category,
    tags: taskTags,
    metrics: taskMetrics,
    variations,
    variationStats,
    nextDue: nextDue.toISOString(),
    status,
    urgency,
    daysUntilDue,
    completionsThisPeriod,
    targetProgress,
    streak: streak ? {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastCompletedAt: streak.lastCompletedAt,
    } : null,
  };
}

// Batch-enrich multiple tasks with ~8 queries total instead of ~6N
export async function enrichTasks(tasks: any[], userId: string): Promise<any[]> {
  if (tasks.length === 0) return [];

  const taskIds = tasks.map(t => t.id);

  const [categories, tagsMap, metricsMap, variationsMap, streaksMap] = await Promise.all([
    storage.getCategories(userId),
    storage.getTaskTagsBatch(taskIds),
    storage.getTaskMetricsBatch(taskIds),
    storage.getTaskVariationsBatch(taskIds),
    storage.getTaskStreaksBatch(taskIds, userId),
  ]);

  // Batch-fetch completions for frequency tasks, grouped by period type
  const completionsInPeriodMap = new Map<number, Completion[]>();
  const periodGroups = new Map<string, number[]>();
  for (const task of tasks) {
    if (task.taskType === 'frequency' && task.targetCount && task.targetPeriod) {
      if (!periodGroups.has(task.targetPeriod)) periodGroups.set(task.targetPeriod, []);
      periodGroups.get(task.targetPeriod)!.push(task.id);
    }
  }
  await Promise.all(
    Array.from(periodGroups.entries()).map(async ([period, ids]) => {
      const { start, end } = getPeriodBounds(period);
      const batchResult = await storage.getCompletionsInPeriodBatch(ids, start, end);
      batchResult.forEach((comps, taskId) => {
        completionsInPeriodMap.set(taskId, comps);
      });
    })
  );

  // Batch-fetch all completions for tasks that have variations (for stats)
  const tasksWithVariationIds = taskIds.filter(id => (variationsMap.get(id) || []).length > 0);
  const completionsMap = tasksWithVariationIds.length > 0
    ? await storage.getCompletionsBatch(tasksWithVariationIds)
    : new Map<number, Completion[]>();

  const batch: BatchData = {
    categories,
    tagsMap,
    metricsMap,
    variationsMap,
    streaksMap,
    completionsInPeriodMap,
    completionsMap,
  };

  return Promise.all(tasks.map(task => enrichTask(task, userId, batch)));
}

export { storage };
