import { addDays, addWeeks, addMonths, addYears, differenceInDays, differenceInMinutes, isBefore, isAfter, isSameDay, startOfDay, endOfDay, getDay, getDate, lastDayOfMonth } from 'date-fns';
import type { Task, Category, Tag, TaskMetric, TaskVariation, TaskStreak, Completion, CadenceMagnitude, TodayBucket } from '../../shared/schema.js';
import { DatabaseStorage } from './storage.js';
import {
  toLocal,
  toUTC,
  parseLocalDateKey,
  formatDateKey,
  getPeriodBounds,
  getPeriodsInRange,
} from './tz.js';

const storage = new DatabaseStorage();

// Re-export period helpers so existing importers keep working. New code
// should import directly from './tz.js'.
export { getPeriodBounds, getPeriodsInRange } from './tz.js';

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

// Advance a date by an interval. Shared by enrichTask and calendarEnhanced.
export function addInterval(date: Date, value: number, unit: string): Date {
  switch (unit) {
    case 'days': return addDays(date, value);
    case 'weeks': return addWeeks(date, value);
    case 'months': return addMonths(date, value);
    case 'years': return addYears(date, value);
    default: return addDays(date, value);
  }
}

function periodToDays(period: string | null | undefined): number {
  switch (period) {
    case 'day': return 1;
    case 'week': return 7;
    case 'month': return 30;
    case 'year': return 365;
    default: return 1;
  }
}

function intervalUnitToDays(unit: string | null | undefined, value: number): number {
  switch (unit) {
    case 'days': return value;
    case 'weeks': return value * 7;
    case 'months': return value * 30;
    case 'years': return value * 365;
    default: return value;
  }
}

// Average days between occurrences. Used for "due soon" thresholds.
export function getCadenceDays(task: any): number {
  if (task.taskType === 'frequency' && task.targetPeriod) {
    return periodToDays(task.targetPeriod) / (task.targetCount || 1);
  }
  if (task.taskType === 'scheduled') {
    if (task.scheduledDaysOfWeek) {
      const days = task.scheduledDaysOfWeek.split(',').filter(Boolean).length;
      return days > 0 ? 7 / days : 7;
    }
    if (task.scheduledDaysOfMonth) {
      const days = task.scheduledDaysOfMonth.split(',').filter(Boolean).length;
      return days > 0 ? 30 / days : 30;
    }
    if (task.scheduledDates) return 365;
    return 1;
  }
  if (task.intervalValue && task.intervalUnit) {
    return intervalUnitToDays(task.intervalUnit, task.intervalValue);
  }
  return 1;
}

// Max gap between consecutive occurrences. Used for streak grace windows.
// For interval/frequency this equals the cadence; for scheduled tasks the
// max gap can exceed the average (e.g. M/W/F: avg 2.3, max gap 3).
export function getMaxGapDays(task: any): number {
  if (task.taskType === 'frequency' && task.targetPeriod) {
    return periodToDays(task.targetPeriod) / (task.targetCount || 1);
  }
  if (task.taskType === 'scheduled') {
    if (task.scheduledDaysOfWeek) {
      const days = task.scheduledDaysOfWeek.split(',')
        .map(Number)
        .filter((d: number) => d >= 0 && d <= 6)
        .sort((a: number, b: number) => a - b);
      if (days.length === 0) return 1;
      if (days.length === 1) return 7;
      let maxGap = 0;
      for (let i = 1; i < days.length; i++) {
        maxGap = Math.max(maxGap, days[i] - days[i - 1]);
      }
      return Math.max(maxGap, 7 - days[days.length - 1] + days[0]);
    }
    if (task.scheduledDaysOfMonth) {
      // Negative day-of-month values are resolved against a nominal 30-day
      // month for gap estimation — exact month length doesn't matter for the
      // grace window heuristic.
      const days = task.scheduledDaysOfMonth.split(',')
        .map((d: string) => parseInt(d.trim()))
        .filter((d: number) => !isNaN(d))
        .map((d: number) => d < 0 ? 31 + d : d)
        .filter((d: number) => d >= 1 && d <= 31)
        .sort((a: number, b: number) => a - b);
      if (days.length === 0) return 1;
      if (days.length === 1) return 30;
      let maxGap = 0;
      for (let i = 1; i < days.length; i++) {
        maxGap = Math.max(maxGap, days[i] - days[i - 1]);
      }
      return Math.max(maxGap, 30 - days[days.length - 1] + days[0]);
    }
    if (task.scheduledDates) return 365;
    return 1;
  }
  if (task.intervalValue && task.intervalUnit) {
    return intervalUnitToDays(task.intervalUnit, task.intervalValue);
  }
  return 1;
}

// Enumerate scheduled occurrences in [startDate, endDate] in the user's
// local timezone. Handles scheduledDaysOfWeek, scheduledDaysOfMonth, and
// scheduledDates. scheduledDaysOfMonth supports both negative indices
// (-1 = last day of month) and clamping out-of-range positives to the
// last day (e.g. "31" matches Feb 28).
export function getScheduledOccurrences(
  task: any,
  startDate: Date,
  endDate: Date,
  timezone: string = 'UTC',
): Date[] {
  if (task.taskType !== 'scheduled') return [];

  const daysOfWeek: number[] = task.scheduledDaysOfWeek
    ? task.scheduledDaysOfWeek.split(',').map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6)
    : [];
  const rawDaysOfMonth: number[] = task.scheduledDaysOfMonth
    ? task.scheduledDaysOfMonth.split(',').map(Number).filter((n: number) => Number.isInteger(n) && ((n >= 1 && n <= 31) || (n >= -31 && n <= -1)))
    : [];
  const specificDates: string[] = task.scheduledDates
    ? task.scheduledDates.split(',').map((d: string) => d.trim()).filter(Boolean)
    : [];

  const occurrences: Date[] = [];
  const seen = new Set<string>();

  const cursor = new Date(startDate.getTime());
  while (cursor <= endDate) {
    const dayLocal = toLocal(cursor, timezone);
    const dow = getDay(dayLocal);
    const dom = getDate(dayLocal);
    const lastDom = getDate(lastDayOfMonth(dayLocal));

    const matchesDow = daysOfWeek.length > 0 && daysOfWeek.includes(dow);
    const matchesDom = rawDaysOfMonth.length > 0 && rawDaysOfMonth.some((d: number) => {
      if (d < 0) return lastDom + 1 + d === dom;
      // Positive values clamp to last day when the month is shorter
      return d === dom || (d > lastDom && dom === lastDom);
    });

    if (matchesDow || matchesDom) {
      const key = formatDateKey(cursor, timezone);
      if (!seen.has(key)) {
        seen.add(key);
        occurrences.push(new Date(cursor.getTime()));
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const dateStr of specificDates) {
    // Specific dates are stored as local date keys ("yyyy-MM-dd").
    const parsed = parseLocalDateKey(dateStr, timezone);
    if (isNaN(parsed.getTime())) continue;
    if (parsed < startDate || parsed > endDate) continue;
    const key = formatDateKey(parsed, timezone);
    if (!seen.has(key)) {
      seen.add(key);
      occurrences.push(parsed);
    }
  }

  occurrences.sort((a, b) => a.getTime() - b.getTime());
  return occurrences;
}

// Calculate "due soon" threshold as 20% of cadence, clamped between 1 and 14 days
export function getDueSoonThreshold(cadenceDays: number): number {
  const threshold = cadenceDays * 0.2;
  return Math.max(1, Math.min(14, Math.ceil(threshold)));
}

// Bucket a task by its average cadence so UI pages (Daily/Weekly/Monthly/Yearly)
// can group consistently across all three task types.
export function getCadenceMagnitude(task: any): CadenceMagnitude {
  const cadence = getCadenceDays(task);
  if (cadence <= 6) return 'daily';
  if (cadence <= 13) return 'weekly';
  if (cadence <= 89) return 'monthly';
  return 'yearly';
}

// Place an enriched task into one of the Dashboard "Today" buckets.
// Operates on already-enriched fields. Returns null when the task should
// not appear in the Today view at all.
//
// Order of checks matters; each rule is documented in place.
export function getTodayBucket(enriched: any): {
  bucket: TodayBucket | null;
  isSuggested: boolean;
} {
  // 1. Pause / never_done are terminal.
  if (enriched.effectivelyPaused || enriched.status === 'paused') {
    return { bucket: 'paused', isSuggested: false };
  }
  if (enriched.status === 'never_done') {
    return { bucket: 'never_done', isSuggested: false };
  }

  const isFrequency = enriched.taskType === 'frequency';
  const isDailyFreqUnmet = isFrequency
    && enriched.targetPeriod === 'day'
    && !!enriched.targetCount
    && (enriched.completionsThisPeriod ?? 0) < enriched.targetCount;

  // 2. Completed today wins — the user took action and deserves to see it.
  //    Exception: a daily-frequency task with unmet target falls through to
  //    due_today so the user is nudged about the remaining reps.
  if (enriched.completedToday && !isDailyFreqUnmet) {
    return { bucket: 'completed_today', isSuggested: false };
  }

  // 3. Overdue — a hard miss.
  //    - Interval / scheduled: status === 'overdue' means past due date.
  //    - Frequency: pacing === 'behind' means the user is more than 10 pts
  //      below the expected progress through the current period. This is
  //      the cue to act now, not later.
  if (enriched.status === 'overdue' && !isFrequency) {
    return { bucket: 'overdue', isSuggested: false };
  }
  if (isFrequency && enriched.pacing === 'behind') {
    return { bucket: 'overdue', isSuggested: false };
  }

  // 4. Due today — action required today to stay on track.
  //    - daily-freq with unmet target (today is the day)
  //    - interval / scheduled task whose next due lands on today
  //    - frequency task on-pace today that will fall behind tomorrow if no
  //      action is taken (the soft nudge)
  const willFallBehindTomorrow = isFrequency && (enriched.willBeBehindTomorrow ?? false);
  const wouldBeDueToday = isDailyFreqUnmet
    || (enriched.effectiveDueToday ?? false)
    || willFallBehindTomorrow;

  if (wouldBeDueToday) {
    // "Suggested" tasks are soft due-today (frequency pacing or weekly/monthly
    // unmet target), not hard interval/scheduled due dates. Used by the UI to
    // dim or label these slightly differently.
    const isSuggested = isFrequency && (
      willFallBehindTomorrow
      || (enriched.targetPeriod !== 'day' && !isDailyFreqUnmet)
    );
    return { bucket: 'due_today', isSuggested };
  }

  // 5. Could do — optional reps for frequency tasks with target unmet.
  //    Interval / scheduled tasks deliberately don't appear here: their hard
  //    due dates already place them in overdue / due_today / due_soon. A
  //    "later" interval task is just not actionable today, period.
  const wouldBeCouldDo = isFrequency
    && enriched.targetPeriod !== 'day'  // daily-freq lives in due_today via isDailyFreqUnmet
    && (enriched.targetProgress ?? 0) < 100;

  if (wouldBeCouldDo) return { bucket: 'could_do', isSuggested: false };

  // 6. Due soon — interval / scheduled task approaching its due date.
  if (enriched.status === 'due_soon'
    && enriched.daysUntilDue !== undefined
    && enriched.daysUntilDue > 0) {
    return { bucket: 'due_soon', isSuggested: false };
  }

  return { bucket: null, isSuggested: false };
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
      cadenceMagnitude: getCadenceMagnitude(task),
      todayBucket: 'paused' as const,
      isSuggestedToday: false,
      pacing: null,
      willBeBehindTomorrow: false,
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
  let pacing: 'ahead' | 'on_pace' | 'behind' | null = null;
  let willBeBehindTomorrow = false;

  // Handle frequency-based tasks differently
  if (task.taskType === 'frequency' && task.targetCount && task.targetPeriod) {
    const { start, end } = getPeriodBounds(task.targetPeriod, timezone);
    const allCompletions = batch
      ? (batch.completionsInPeriodMap.get(task.id) || [])
      : await storage.getCompletionsInPeriod(task.id, start, end);

    completionsThisPeriod = allCompletions.length;
    recentCompletionDates = allCompletions.map(c => formatDateKey(c.completedAt, timezone));
    targetProgress = Math.min(100, (completionsThisPeriod / task.targetCount) * 100);

    // Pacing: compare actual progress against how much of the period has
    // elapsed. Computed only while target is unmet; once met, the task is
    // hidden from Today regardless.
    if (completionsThisPeriod < task.targetCount) {
      const totalMs = end.getTime() - start.getTime();
      const elapsedFrac = totalMs > 0
        ? Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / totalMs))
        : 0;
      const expectedPct = elapsedFrac * 100;
      const delta = targetProgress - expectedPct;
      if (delta >= 10) pacing = 'ahead';
      else if (delta <= -10) pacing = 'behind';
      else pacing = 'on_pace';

      // willBeBehindTomorrow: would the user be behind by tomorrow if they
      // do nothing today? Only meaningful for weekly/monthly — daily-period
      // tasks reset every day and use isDailyFreqUnmet for the same nudge.
      if (task.targetPeriod !== 'day' && pacing !== 'behind') {
        const periodDays = task.targetPeriod === 'week' ? 7 : 30;
        const elapsedTomorrow = Math.min(1, elapsedFrac + 1 / periodDays);
        const expectedTomorrowPct = elapsedTomorrow * 100;
        if (targetProgress - expectedTomorrowPct <= -10) {
          willBeBehindTomorrow = true;
        }
      }
    }

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
      nextDue = addInterval(lastCompleted, task.intervalValue, task.intervalUnit);
      // Snap to end-of-day in user's timezone so tasks stay "due today" until the day ends
      const nextDueLocal = toLocal(nextDue, timezone);
      nextDue = toUTC(endOfDay(nextDueLocal), timezone);
    } else {
      nextDue = new Date(0);
    }
  }

  // Capture pre-assignment nextDue for effectiveDueToday calculation
  const naturalNextDue = new Date(nextDue.getTime());

  // Apply assignments: if active assignments exist, they define the real due date.
  // plannedDate is a local date key, so interpret it in the user's timezone.
  const activeAssignments = batch?.assignmentsMap.get(task.id) || [];
  if (activeAssignments.length > 0) {
    const isFrequencyGoalMet = task.taskType === 'frequency' && completionsThisPeriod >= (task.targetCount || 0);
    if (!isFrequencyGoalMet) {
      nextDue = parseLocalDateKey(activeAssignments[0].plannedDate, timezone);
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
    const intervalDays = getMaxGapDays(task);
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

  const { bucket: todayBucket, isSuggested: isSuggestedToday } = getTodayBucket({
    taskType: task.taskType,
    targetPeriod: task.targetPeriod,
    targetCount: task.targetCount,
    status,
    effectivelyPaused: false,
    effectiveDueToday,
    completedToday,
    completionsThisPeriod,
    targetProgress,
    daysUntilDue,
    pacing,
    willBeBehindTomorrow,
  });

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
    cadenceMagnitude: getCadenceMagnitude(task),
    todayBucket,
    isSuggestedToday,
    pacing,
    willBeBehindTomorrow,
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
  const todayStr = formatDateKey(new Date(), timezone);
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
