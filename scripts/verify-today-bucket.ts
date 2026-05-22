// Table-driven test for `getTodayBucket`. Enumerates representative enriched
// task shapes and asserts the expected bucket. The asymmetry that hid 2-week
// interval tasks completed today (#56) would have failed instantly here.
//
// Run with: node --import tsx/esm scripts/verify-today-bucket.ts
// Wired into `npm run check`.
//
// Note: task-utils transitively imports the storage layer (which checks for
// DATABASE_URL at module load). Load .env.local first so the import succeeds.
// A future refactor should split pure helpers like `getTodayBucket` into a
// module that doesn't drag DB initialization with it.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envContent = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    if (!process.env[key]) process.env[key] = trimmed.slice(eqIdx + 1);
  }
} catch {
  // If .env.local is missing, fall back to a dummy value — the test never
  // actually touches the DB.
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = 'postgres://dummy';
}

const { getTodayBucket } = await import('../api/_lib/task-utils.js');
import type { TodayBucket } from '../shared/schema.js';

interface Case {
  name: string;
  input: Record<string, any>;
  expected: TodayBucket | null;
  expectedSuggested?: boolean;
}

const cases: Case[] = [
  // --- Pause / never_done short-circuits ---
  {
    name: 'effectivelyPaused → paused',
    input: { effectivelyPaused: true, status: 'later' },
    expected: 'paused',
  },
  {
    name: 'status paused → paused',
    input: { effectivelyPaused: false, status: 'paused' },
    expected: 'paused',
  },
  {
    name: 'never_done → never_done',
    input: { effectivelyPaused: false, status: 'never_done' },
    expected: 'never_done',
  },

  // --- Completed today (the bucket that #56 fixed) ---
  {
    name: 'interval completed today, next due in 14d → completed_today',
    input: {
      effectivelyPaused: false, status: 'later', taskType: 'interval',
      completedToday: true, daysUntilDue: 14, effectiveDueToday: false,
    },
    expected: 'completed_today',
  },
  {
    name: 'interval completed today, next due in 3d → completed_today',
    input: {
      effectivelyPaused: false, status: 'later', taskType: 'interval',
      completedToday: true, daysUntilDue: 3, effectiveDueToday: false,
    },
    expected: 'completed_today',
  },
  {
    name: 'yearly interval completed today → completed_today',
    input: {
      effectivelyPaused: false, status: 'later', taskType: 'interval',
      completedToday: true, daysUntilDue: 365, effectiveDueToday: false,
    },
    expected: 'completed_today',
  },
  {
    name: 'scheduled completed today → completed_today',
    input: {
      effectivelyPaused: false, status: 'later', taskType: 'scheduled',
      completedToday: true, daysUntilDue: 7, effectiveDueToday: false,
    },
    expected: 'completed_today',
  },
  {
    name: 'weekly-freq completed once today (of 3) → completed_today',
    input: {
      effectivelyPaused: false, status: 'later', taskType: 'frequency',
      targetPeriod: 'week', targetCount: 3, completionsThisPeriod: 1,
      completedToday: true, daysUntilDue: 2, targetProgress: 33,
    },
    expected: 'completed_today',
  },

  // --- Daily-frequency unmet (still pushes to do more) ---
  {
    name: 'daily-freq 1 of 3 (completed today) → due_today (not done yet)',
    input: {
      effectivelyPaused: false, status: 'later', taskType: 'frequency',
      targetPeriod: 'day', targetCount: 3, completionsThisPeriod: 1,
      completedToday: true, daysUntilDue: 0, targetProgress: 33,
    },
    expected: 'due_today',
  },
  {
    name: 'daily-freq 3 of 3 (completed today) → completed_today',
    input: {
      effectivelyPaused: false, status: 'later', taskType: 'frequency',
      targetPeriod: 'day', targetCount: 3, completionsThisPeriod: 3,
      completedToday: true, daysUntilDue: 0, targetProgress: 100,
    },
    expected: 'completed_today',
  },

  // --- Overdue (separate bucket for interval/scheduled hard misses) ---
  {
    name: 'interval overdue, not completed → overdue',
    input: {
      effectivelyPaused: false, status: 'overdue', taskType: 'interval',
      completedToday: false, effectiveDueToday: true, daysUntilDue: -3,
    },
    expected: 'overdue',
  },
  {
    name: 'scheduled overdue, not completed → overdue',
    input: {
      effectivelyPaused: false, status: 'overdue', taskType: 'scheduled',
      completedToday: false, effectiveDueToday: true, daysUntilDue: -1,
    },
    expected: 'overdue',
  },
  {
    name: 'overdue + completed today → completed_today (completed wins)',
    input: {
      effectivelyPaused: false, status: 'overdue', taskType: 'interval',
      completedToday: true, effectiveDueToday: false, daysUntilDue: 14,
    },
    expected: 'completed_today',
  },
  {
    name: 'weekly-freq behind pace (status=overdue) → could_do, not overdue',
    input: {
      effectivelyPaused: false, status: 'overdue', taskType: 'frequency',
      targetPeriod: 'week', targetCount: 3, completionsThisPeriod: 0,
      completedToday: false, effectiveDueToday: false,
      targetProgress: 0, daysUntilDue: 0,
    },
    expected: 'could_do',
  },

  // --- Due today (not completed, not overdue) ---
  {
    name: 'interval due today (effective only, status not overdue) → due_today',
    input: {
      effectivelyPaused: false, status: 'due_soon', taskType: 'interval',
      completedToday: false, effectiveDueToday: true, daysUntilDue: 0,
    },
    expected: 'due_today',
  },
  {
    name: 'weekly-freq with target unmet & due today → due_today (suggested)',
    input: {
      effectivelyPaused: false, status: 'later', taskType: 'frequency',
      targetPeriod: 'week', targetCount: 3, completionsThisPeriod: 0,
      completedToday: false, effectiveDueToday: true,
      targetProgress: 0, daysUntilDue: 0,
    },
    expected: 'due_today',
    expectedSuggested: true,
  },

  // --- Could-do bucket (≤ 7 days out OR weekly/monthly freq with room) ---
  {
    name: 'interval status later, 5d out → could_do',
    input: {
      effectivelyPaused: false, status: 'later', taskType: 'interval',
      completedToday: false, effectiveDueToday: false, daysUntilDue: 5,
    },
    expected: 'could_do',
  },
  {
    name: 'weekly-freq goal not met, no due-today → could_do',
    input: {
      effectivelyPaused: false, status: 'later', taskType: 'frequency',
      targetPeriod: 'week', targetCount: 3, completionsThisPeriod: 1,
      completedToday: false, effectiveDueToday: false,
      targetProgress: 33, daysUntilDue: 2,
    },
    expected: 'could_do',
  },

  // --- Due-soon bucket ---
  {
    name: 'interval status due_soon, 2d out → due_soon',
    input: {
      effectivelyPaused: false, status: 'due_soon', taskType: 'interval',
      completedToday: false, effectiveDueToday: false, daysUntilDue: 2,
    },
    // due_soon AND daysUntilDue<=7 means could_do branch fires first
    // (could_do gates on `status === 'later'`), so this lands in due_soon.
    expected: 'due_soon',
  },

  // --- Not relevant to today ---
  {
    name: 'interval far in future → null (not relevant)',
    input: {
      effectivelyPaused: false, status: 'later', taskType: 'interval',
      completedToday: false, effectiveDueToday: false, daysUntilDue: 14,
    },
    expected: null,
  },
  {
    name: 'weekly-freq goal met → null',
    input: {
      effectivelyPaused: false, status: 'later', taskType: 'frequency',
      targetPeriod: 'week', targetCount: 3, completionsThisPeriod: 3,
      completedToday: false, effectiveDueToday: false,
      targetProgress: 100, daysUntilDue: 2,
    },
    expected: null,
  },
];

let failures = 0;
for (const c of cases) {
  const { bucket, isSuggested } = getTodayBucket(c.input);
  const bucketPass = bucket === c.expected;
  const suggestedPass = c.expectedSuggested === undefined
    ? true
    : isSuggested === c.expectedSuggested;
  const pass = bucketPass && suggestedPass;
  console.log(`${pass ? '✓' : '✘'} ${c.name}`);
  if (!pass) {
    if (!bucketPass) console.log(`    bucket: expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(bucket)}`);
    if (!suggestedPass) console.log(`    isSuggested: expected ${c.expectedSuggested}, got ${isSuggested}`);
    failures++;
  }
}

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} today-bucket cases pass.`);
