// Timezone boundary module.
//
// Two value types cross the wire and the database:
//   - UTC instant: a `Date` whose `.getTime()` is an absolute moment.
//     Everything in Postgres `timestamp` columns, every `lastCompletedAt`,
//     every `Date` returned from these helpers.
//   - Local date key: a `"yyyy-MM-dd"` string naming a calendar day in the
//     user's timezone. Examples: `plannedDate`, `originalDate`, the
//     `start`/`end` query params accepted by range endpoints.
//
// Anything in-between (e.g. a Date returned by `parseISO("yyyy-MM-dd")`,
// whose components reflect the *server's* tz at midnight) is a footgun and
// should not exist outside this module.
//
// Server handlers MUST cross the boundary through these helpers. The lint
// guard in `scripts/check-tz-boundary.sh` bans direct use of `parseISO`,
// `eachDayOfInterval`, `formatInTimeZone`, `toZonedTime`, and `fromZonedTime`
// outside this file.

import {
  addDays, addMonths, addYears,
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
} from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

// --- Crossing the boundary ---------------------------------------------------

// Interpret a local date key as the UTC instant of midnight on that day in `tz`.
export function parseLocalDateKey(key: string, tz: string): Date {
  return fromZonedTime(new Date(`${key}T00:00:00.000`), tz);
}

// Interpret a local date key as the UTC instant of 23:59:59.999 on that day in `tz`.
export function endOfLocalDateKey(key: string, tz: string): Date {
  return fromZonedTime(new Date(`${key}T23:59:59.999`), tz);
}

// Render a UTC instant as the local date key for its day in `tz`.
export function formatDateKey(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}

// `new Date()` localized to `tz`. Components reflect the wall clock in `tz`;
// the returned Date's `.getTime()` is NOT a meaningful absolute moment.
// Treat it as a "naive zoned date" for use with date-fns calendar ops.
export function nowLocal(tz: string): Date {
  return toZonedTime(new Date(), tz);
}

// UTC instant → "naive zoned date" in `tz`. Same semantics as `nowLocal`.
export function toLocal(date: Date, tz: string): Date {
  return toZonedTime(date, tz);
}

// "Naive zoned date" → UTC instant. Inverse of `toLocal`.
export function toUTC(localDate: Date, tz: string): Date {
  return fromZonedTime(localDate, tz);
}

// UTC instant of local midnight for the day containing `date` in `tz`.
export function startOfLocalDay(date: Date, tz: string): Date {
  return fromZonedTime(startOfDay(toZonedTime(date, tz)), tz);
}

// UTC instant of local 23:59:59.999 for the day containing `date` in `tz`.
export function endOfLocalDay(date: Date, tz: string): Date {
  return fromZonedTime(endOfDay(toZonedTime(date, tz)), tz);
}

// --- Calendar iteration ------------------------------------------------------

// Inclusive list of local date keys spanning `[startKey, endKey]`. Pure
// calendar walking — no tz needed because date keys are already tz-anchored.
export function localDaysInRange(startKey: string, endKey: string): string[] {
  const parse = (k: string): [number, number, number] => {
    const [y, m, d] = k.split('-').map(Number);
    return [y, m, d];
  };
  const [sy, sm, sd] = parse(startKey);
  const [ey, em, ed] = parse(endKey);
  // Use UTC-component math so DST never shifts the walk.
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  const out: string[] = [];
  for (let ms = startMs; ms <= endMs; ms += 24 * 3600 * 1000) {
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

// --- Period bounds (frequency-task scheduling) -------------------------------

// Bounds of the current period containing "now", aligned to the user's local
// week/month/year. Returned as UTC instants.
export function getPeriodBounds(period: string, tz: string = 'UTC'): { start: Date, end: Date } {
  const local = toZonedTime(new Date(), tz);
  let localStart: Date, localEnd: Date;
  if (period === 'day') {
    localStart = startOfDay(local);
    localEnd = endOfDay(local);
  } else if (period === 'week') {
    localStart = startOfWeek(local, { weekStartsOn: 0 });
    localEnd = endOfWeek(local, { weekStartsOn: 0 });
  } else if (period === 'month') {
    localStart = startOfMonth(local);
    localEnd = endOfMonth(local);
  } else {
    localStart = startOfYear(local);
    localEnd = endOfYear(local);
  }
  return {
    start: fromZonedTime(localStart, tz),
    end: fromZonedTime(localEnd, tz),
  };
}

// Every period of length `period` that overlaps `[viewStart, viewEnd]`,
// aligned to the user's local timezone. Used for end-of-period miss accounting.
export function getPeriodsInRange(
  period: string,
  viewStart: Date,
  viewEnd: Date,
  tz: string = 'UTC',
): Array<{ periodStart: Date; periodEnd: Date }> {
  const localStart = toZonedTime(viewStart, tz);
  const localEnd = toZonedTime(viewEnd, tz);

  const startOfPeriod = (d: Date): Date => {
    if (period === 'day') return startOfDay(d);
    if (period === 'week') return startOfWeek(d, { weekStartsOn: 0 });
    if (period === 'month') return startOfMonth(d);
    return startOfYear(d);
  };
  const endOfPeriod = (d: Date): Date => {
    if (period === 'day') return endOfDay(d);
    if (period === 'week') return endOfWeek(d, { weekStartsOn: 0 });
    if (period === 'month') return endOfMonth(d);
    return endOfYear(d);
  };
  const advance = (d: Date): Date => {
    if (period === 'day') return addDays(d, 1);
    if (period === 'week') return addDays(d, 7);
    if (period === 'month') return addMonths(d, 1);
    return addYears(d, 1);
  };

  const periods: Array<{ periodStart: Date; periodEnd: Date }> = [];
  let cursor = startOfPeriod(localStart);
  while (cursor <= localEnd) {
    periods.push({
      periodStart: fromZonedTime(cursor, tz),
      periodEnd: fromZonedTime(endOfPeriod(cursor), tz),
    });
    cursor = advance(cursor);
  }
  return periods;
}
