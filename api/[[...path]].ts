import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  authUser,
  calendarEnhanced,
  categoriesIndex,
  categoriesId,
  clearData,
  completionsId,
  completionsCalendar,
  metricsId,
  metricsIdHistory,
  profilesIndex,
  profilesDefault,
  profilesDemo,
  profilesAllData,
  profilesId,
  profilesIdData,
  profilesIdDemoSeed,
  profilesIdImportSource,
  statsIndex,
  streaksIndex,
  tagsIndex,
  tasksIndex,
  tasksMigrate,
  tasksId,
  tasksIdArchive,
  tasksIdCascade,
  tasksIdComplete,
  tasksIdCompletions,
  tasksIdHistory,
  tasksIdMetrics,
  tasksIdReassign,
  tasksIdVariations,
  variationsId,
} from './_lib/all-handlers.js';

type Handler = (req: VercelRequest, res: VercelResponse) => any;

interface Route {
  pattern: RegExp;
  handler: Handler;
  params: string[];
}

const routes: Route[] = [
  { pattern: /^auth\/user$/, handler: authUser, params: [] },
  { pattern: /^calendar\/enhanced$/, handler: calendarEnhanced, params: [] },
  { pattern: /^categories$/, handler: categoriesIndex, params: [] },
  { pattern: /^categories\/(\d+)$/, handler: categoriesId, params: ['id'] },
  { pattern: /^clear-data$/, handler: clearData, params: [] },
  { pattern: /^completions\/calendar$/, handler: completionsCalendar, params: [] },
  { pattern: /^completions\/(\d+)$/, handler: completionsId, params: ['id'] },
  { pattern: /^metrics\/(\d+)\/history$/, handler: metricsIdHistory, params: ['id'] },
  { pattern: /^metrics\/(\d+)$/, handler: metricsId, params: ['id'] },
  { pattern: /^profiles\/default$/, handler: profilesDefault, params: [] },
  { pattern: /^profiles\/demo$/, handler: profilesDemo, params: [] },
  { pattern: /^profiles\/all\/data$/, handler: profilesAllData, params: [] },
  { pattern: /^profiles\/(\d+)\/demo-seed$/, handler: profilesIdDemoSeed, params: ['id'] },
  { pattern: /^profiles\/(\d+)\/import\/(\d+)$/, handler: profilesIdImportSource, params: ['id', 'sourceId'] },
  { pattern: /^profiles\/(\d+)\/data$/, handler: profilesIdData, params: ['id'] },
  { pattern: /^profiles\/(\d+)$/, handler: profilesId, params: ['id'] },
  { pattern: /^profiles$/, handler: profilesIndex, params: [] },
  { pattern: /^stats$/, handler: statsIndex, params: [] },
  { pattern: /^streaks$/, handler: streaksIndex, params: [] },
  { pattern: /^tags$/, handler: tagsIndex, params: [] },
  { pattern: /^tasks\/migrate$/, handler: tasksMigrate, params: [] },
  { pattern: /^tasks\/(\d+)\/archive$/, handler: tasksIdArchive, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/cascade$/, handler: tasksIdCascade, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/complete$/, handler: tasksIdComplete, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/completions$/, handler: tasksIdCompletions, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/history$/, handler: tasksIdHistory, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/metrics$/, handler: tasksIdMetrics, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/reassign$/, handler: tasksIdReassign, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/variations$/, handler: tasksIdVariations, params: ['id'] },
  { pattern: /^tasks\/(\d+)$/, handler: tasksId, params: ['id'] },
  { pattern: /^tasks$/, handler: tasksIndex, params: [] },
  { pattern: /^variations\/(\d+)$/, handler: variationsId, params: ['id'] },
];

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Parse path from URL, stripping /api/ prefix
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const path = url.pathname.replace(/^\/api\//, '');

  for (const route of routes) {
    const match = path.match(route.pattern);
    if (match) {
      route.params.forEach((name, i) => {
        req.query[name] = match[i + 1];
      });
      return route.handler(req, res);
    }
  }

  return res.status(404).json({ error: 'Not found' });
}
