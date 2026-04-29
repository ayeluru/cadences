import { addDays, addWeeks, addMonths, addYears, differenceInDays, differenceInMinutes, isBefore, isAfter, isSameDay, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
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
  assignmentsMap: Map<number, { plannedDate: string }[]>;
  assignedTodaySet: Set<number>;
  movedFromTodaySet: Set<number>;
  vacationMode?: boolean;
}

// Convert a UTC date to the user's local timezone for date-fns operations
function toLocal(date: Date, timezone: string): Date {
  return toZonedTime(date, timezone);
}

// Convert a "local" date (from date-fns ops on a zoned time) back to UTC
function toUTC(localDate: Date, timezone: string): Date {
  return fromZonedTime(localDate, timezone);
}

// Get period boundaries for frequency-based tasks, in UTC, aligned to user's local timezone
export function getPeriodBounds(period: string, timezone: string = 'UTC'): { start: Date, end: Date } {
  const nowLocal = toLocal(new Date(), timezone);
  let localStart: Date, localEnd: Date;
  if (period === 'day') {
    localStart = startOfDay(nowLocal);
    localEnd = endOfDay(nowLocal);
  } else if (period === 'week') {
    localStart = startOfWeek(nowLocal, { weekStartsOn: 0 });
    localEnd = endOfWeek(nowLocal, { weekStartsOn: 0 });
  } else if (period === 'month') {
    localStart = startOfMonth(nowLocal);
    localEnd = endOfMonth(nowLocal);
  } else {
    localStart = startOfYear(nowLocal);
    localEnd = endOfYear(nowLocal);
  }
  return { start: toUTC(localStart, timezone), end: toUTC(localEnd, timezone) };
}

// Calculate cadence duration in days
export function getCadenceDays(task: any): number {
  if (task.taskType === 'frequency' && task.targetPeriod) {
    const periodDays = task.targetPeriod === 'day' ? 1 : task.targetPeriod === 'week' ? 7 : task.targetPeriod === 'month' ? 30 : 365;
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
export async function enrichTask(task: any, userId: string, batch?: BatchData, timezone: string = 'UTC') {
  const categoriesList = batch ? batch.categories : await storage.getCategories(userId);
  const category = task.categoryId ? categoriesList.find(c => c.id === task.categoryId) : null;
  const taskTags = batch ? (batch.tagsMap.get(task.id) || []) : await storage.getTaskTags(task.id);
  const taskMetrics = batch ? (batch.metricsMap.get(task.id) || []) : await storage.getTaskMetrics(task.id);
  const variations = batch ? (batch.variationsMap.get(task.id) || []) : await storage.getTaskVariations(task.id);

  // --- Pause logic ---
  const now = new Date();
  const isIndividuallyPaused = task.isPaused && (!task.pausedUntil || new Date(task.pausedUntil) > now);
  const vacationActive = batch?.vacationMode ?? false;
  const effectivelyPaused = isIndividuallyPaused || vacationActive;
  const pausedUntilDate = task.isPaused && task.pausedUntil ? new Date(task.pausedUntil).toISOString() : null;

  if (effectivelyPaused) {
    const rawStreak = batch ? batch.streaksMap.get(task.id) : await storage.getTaskStreak(task.id, userId);
    return {
      ...task,
      category,
      tags: taskTags,
      metrics: taskMetrics,
      variations,
      variationStats: [],
      nextDue: null,
      status: 'paused' as const,
      urgency: -9999,
      daysUntilDue: undefined,
      completionsThisPeriod: 0,
      targetProgress: 0,
      completedToday: false,
      effectiveDueToday: false,
      effectivelyPaused: true,
      pausedUntilDate,
      streak: rawStreak ? {
        currentStreak: rawStreak.currentStreak,
        longestStreak: rawStreak.longestStreak,
        lastCompletedAt: rawStreak.lastCompletedAt,
      } : null,
    };
  }

  // resumedAt is only used for streak grace window checks (below), not for scheduling.
  // This way tasks that were due during a pause show as due/overdue when resumed.
  const taskForCalc = task;

  let nextDue = new Date();
  let completionsThisPeriod = 0;
  let targetProgress = 0;
  let recentCompletionDates: string[] = [];

  // Handle frequency-based tasks differently
  if (task.taskType === 'frequency' && task.targetCount && task.targetPeriod) {
    const { start, end } = getPeriodBounds(task.targetPeriod, timezone);
    const allCompletions = batch
      ? (batch.completionsInPeriodMap.get(task.id) || [])
      : await storage.getCompletionsInPeriod(task.id, start, end);

    completionsThisPeriod = allCompletions.length;
    recentCompletionDates = allCompletions.map(c => {
      const d = toLocal(c.completedAt, timezone);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    targetProgress = Math.min(100, (completionsThisPeriod / task.targetCount) * 100);

    const periodDays = task.targetPeriod === 'day' ? 1 : task.targetPeriod === 'week' ? 7 : 30;
    const spacing = periodDays / task.targetCount;

    if (completionsThisPeriod >= task.targetCount) {
      nextDue = end;
    } else {
      const evenlySpaced = addDays(start, (completionsThisPeriod + 0.5) * spacing);
      nextDue = isBefore(evenlySpaced, end) ? evenlySpaced : end;
    }
  } else if (task.taskType === 'scheduled') {
    const nowLocal = toLocal(now, timezone);
    const today = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
    let foundNextDue = false;

    let scheduledHour = 0;
    let scheduledMinute = 0;
    if (task.scheduledTime) {
      const [h, m] = task.scheduledTime.split(':').map(Number);
      scheduledHour = h || 0;
      scheduledMinute = m || 0;
    }

    const wasCompletedAfter = (dateTime: Date): boolean => {
      if (!taskForCalc.lastCompletedAt) return false;
      return new Date(taskForCalc.lastCompletedAt) >= dateTime;
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
    if (taskForCalc.lastCompletedAt) {
      const lastCompleted = new Date(taskForCalc.lastCompletedAt);
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
      // Snap to end-of-day in user's timezone so tasks stay "due today" until the day ends
      const nextDueLocal = toLocal(nextDue, timezone);
      nextDue = toUTC(endOfDay(nextDueLocal), timezone);
    } else {
      nextDue = new Date(0);
    }
  }

  // Capture pre-assignment nextDue for effectiveDueToday calculation
  const naturalNextDue = new Date(nextDue.getTime());

  // Apply assignments: if active assignments exist, they define the real due date
  const activeAssignments = batch?.assignmentsMap.get(task.id) || [];
  if (activeAssignments.length > 0) {
    const isFrequencyGoalMet = task.taskType === 'frequency' && completionsThisPeriod >= (task.targetCount || 0);
    if (!isFrequencyGoalMet) {
      nextDue = parseISO(activeAssignments[0].plannedDate);
    }
  }

  const nowLocalDay = startOfDay(toLocal(now, timezone));
  const nextDueLocalDay = startOfDay(toLocal(nextDue, timezone));
  const daysUntilDue = differenceInDays(nextDueLocalDay, nowLocalDay);
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
    } else if (isBefore(nextDue, now)) {
      status = 'overdue';
    } else {
      const frequencySpacing = (task.targetPeriod === 'day' ? 1 : task.targetPeriod === 'week' ? 7 : 30) / (task.targetCount || 1);
      const frequencyThreshold = getDueSoonThreshold(frequencySpacing);
      if (daysUntilDue <= frequencyThreshold) {
        status = 'due_soon';
      }
    }
  } else if (isBefore(nextDue, now)) {
    status = 'overdue';
  } else if (daysUntilDue <= dueSoonThreshold) {
    status = 'due_soon';
  }

  let urgency = 0;
  if (status === 'never_done') {
    urgency = 1000;
  } else if (status === 'overdue') {
    urgency = 500 + Math.abs(daysUntilDue);
  } else if (status === 'due_soon') {
    urgency = 100 - daysUntilDue;
  } else {
    urgency = -daysUntilDue;
  }

  // Get streak data and check if it's still active (hasn't expired)
  // Use max(streak.lastCompletedAt, task.resumedAt) so pauses don't break streaks
  const rawStreak = batch ? batch.streaksMap.get(task.id) : await storage.getTaskStreak(task.id, userId);
  let streak = rawStreak;
  if (streak && streak.currentStreak > 0 && streak.lastCompletedAt) {
    const intervalDays = storage.getIntervalInDays(task);
    const graceWindow = Math.max(Math.ceil(intervalDays * 1.5), Math.ceil(intervalDays) + 1);
    const nowLocalForStreak = toLocal(now, timezone);
    const effectiveStreakBase = task.resumedAt && new Date(task.resumedAt) > streak.lastCompletedAt
      ? new Date(task.resumedAt)
      : streak.lastCompletedAt;
    const lastStreakLocal = toLocal(effectiveStreakBase, timezone);
    const daysSinceLast = differenceInDays(startOfDay(nowLocalForStreak), startOfDay(lastStreakLocal));
    if (daysSinceLast > graceWindow) {
      streak = { ...streak, currentStreak: 0 };
    }
  }

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

  const nowLocal = toLocal(now, timezone);
  const today = startOfDay(nowLocal);
  let completedToday = false;
  if (task.lastCompletedAt) {
    const lastCompletedLocal = toLocal(new Date(task.lastCompletedAt), timezone);
    completedToday = isSameDay(lastCompletedLocal, today);
  }

  // Compute effectiveDueToday: was this task due today (before completion may have shifted nextDue)?
  const isAssignedToday = batch?.assignedTodaySet.has(task.id) ?? false;
  const isMovedFromToday = batch?.movedFromTodaySet.has(task.id) ?? false;
  const naturalNextDueLocal = toLocal(naturalNextDue, timezone);
  const isFrequencyType = task.taskType === 'frequency';
  const naturallyDueToday =
    isSameDay(naturalNextDueLocal, today) ||
    (!isFrequencyType && isBefore(naturalNextDueLocal, today)) ||
    (task.taskType === 'scheduled' && task.scheduledDaysOfWeek?.split(',').map(Number).includes(today.getDay()));
  const effectiveDueToday = isAssignedToday || (!isMovedFromToday && naturallyDueToday);

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
    completedToday,
    effectiveDueToday,
    effectivelyPaused: false,
    pausedUntilDate: null,
    recentCompletionDates: recentCompletionDates.length > 0 ? recentCompletionDates : undefined,
    streak: streak ? {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastCompletedAt: streak.lastCompletedAt,
    } : null,
  };
}

// Batch-enrich multiple tasks with ~8 queries total instead of ~6N
// Accepts optional pre-fetched userSettings to avoid duplicate DB calls
export async function enrichTasks(tasks: any[], userId: string, timezone: string = 'UTC', preloadedSettings?: any): Promise<any[]> {
  if (tasks.length === 0) return [];

  const taskIds = tasks.map(t => t.id);

  const queries: Promise<any>[] = [
    storage.getCategories(userId),
    storage.getTaskTagsBatch(taskIds),
    storage.getTaskMetricsBatch(taskIds),
    storage.getTaskVariationsBatch(taskIds),
    storage.getTaskStreaksBatch(taskIds, userId),
    storage.getActiveAssignments(userId),
  ];
  if (!preloadedSettings) {
    queries.push(storage.getUserSettings(userId));
  }

  const results = await Promise.all(queries);
  const [categories, tagsMap, metricsMap, variationsMap, streaksMap, activeAssignments] = results;
  const userSettingsData = preloadedSettings ?? results[6];

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
      const { start, end } = getPeriodBounds(period, timezone);
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

  // Build per-task assignment map (sorted by plannedDate from the query)
  const assignmentsMap = new Map<number, { plannedDate: string }[]>();
  const nowLocalBatch = toLocal(new Date(), timezone);
  const todayStr = `${nowLocalBatch.getFullYear()}-${String(nowLocalBatch.getMonth() + 1).padStart(2, '0')}-${String(nowLocalBatch.getDate()).padStart(2, '0')}`;
  const assignedTodaySet = new Set<number>();
  const movedFromTodaySet = new Set<number>();
  for (const a of activeAssignments) {
    if (!assignmentsMap.has(a.taskId)) assignmentsMap.set(a.taskId, []);
    assignmentsMap.get(a.taskId)!.push({ plannedDate: a.plannedDate });
    if (a.plannedDate === todayStr) {
      assignedTodaySet.add(a.taskId);
    }
    if (a.originalDate === todayStr && a.plannedDate !== todayStr) {
      movedFromTodaySet.add(a.taskId);
    }
  }

  const vacationMode = userSettingsData?.vacationMode === true
    && (!userSettingsData.vacationUntil || new Date(userSettingsData.vacationUntil) > new Date());

  const batch: BatchData = {
    categories,
    tagsMap,
    metricsMap,
    variationsMap,
    streaksMap,
    completionsInPeriodMap,
    completionsMap,
    assignmentsMap,
    assignedTodaySet,
    movedFromTodaySet,
    vacationMode,
  };

  return Promise.all(tasks.map(task => enrichTask(task, userId, batch, timezone)));
}

export { storage };
