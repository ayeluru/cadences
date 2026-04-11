import type { VercelRequest, VercelResponse } from '@vercel/node';

import authUserHandler from './_lib/handlers/auth-user';
import calendarEnhancedHandler from './_lib/handlers/calendar-enhanced';
import categoriesIndexHandler from './_lib/handlers/categories-index';
import categoriesIdHandler from './_lib/handlers/categories-id';
import clearDataHandler from './_lib/handlers/clear-data';
import completionsIdHandler from './_lib/handlers/completions-id';
import completionsCalendarHandler from './_lib/handlers/completions-calendar';
import metricsIdHandler from './_lib/handlers/metrics-id';
import metricsIdHistoryHandler from './_lib/handlers/metrics-id-history';
import profilesIndexHandler from './_lib/handlers/profiles-index';
import profilesDefaultHandler from './_lib/handlers/profiles-default';
import profilesDemoHandler from './_lib/handlers/profiles-demo';
import profilesAllDataHandler from './_lib/handlers/profiles-all-data';
import profilesIdHandler from './_lib/handlers/profiles-id';
import profilesIdDataHandler from './_lib/handlers/profiles-id-data';
import profilesIdDemoSeedHandler from './_lib/handlers/profiles-id-demo-seed';
import profilesIdImportSourceHandler from './_lib/handlers/profiles-id-import-sourceId';
import statsIndexHandler from './_lib/handlers/stats-index';
import streaksIndexHandler from './_lib/handlers/streaks-index';
import tagsIndexHandler from './_lib/handlers/tags-index';
import tasksIndexHandler from './_lib/handlers/tasks-index';
import tasksMigrateHandler from './_lib/handlers/tasks-migrate';
import tasksIdHandler from './_lib/handlers/tasks-id';
import tasksIdArchiveHandler from './_lib/handlers/tasks-id-archive';
import tasksIdCascadeHandler from './_lib/handlers/tasks-id-cascade';
import tasksIdCompleteHandler from './_lib/handlers/tasks-id-complete';
import tasksIdCompletionsHandler from './_lib/handlers/tasks-id-completions';
import tasksIdHistoryHandler from './_lib/handlers/tasks-id-history';
import tasksIdMetricsHandler from './_lib/handlers/tasks-id-metrics';
import tasksIdReassignHandler from './_lib/handlers/tasks-id-reassign';
import tasksIdVariationsHandler from './_lib/handlers/tasks-id-variations';
import variationsIdHandler from './_lib/handlers/variations-id';

type Handler = (req: VercelRequest, res: VercelResponse) => any;

interface Route {
  pattern: RegExp;
  handler: Handler;
  params: string[];
}

const routes: Route[] = [
  { pattern: /^auth\/user$/, handler: authUserHandler, params: [] },
  { pattern: /^calendar\/enhanced$/, handler: calendarEnhancedHandler, params: [] },
  { pattern: /^categories$/, handler: categoriesIndexHandler, params: [] },
  { pattern: /^categories\/(\d+)$/, handler: categoriesIdHandler, params: ['id'] },
  { pattern: /^clear-data$/, handler: clearDataHandler, params: [] },
  { pattern: /^completions\/calendar$/, handler: completionsCalendarHandler, params: [] },
  { pattern: /^completions\/(\d+)$/, handler: completionsIdHandler, params: ['id'] },
  { pattern: /^metrics\/(\d+)\/history$/, handler: metricsIdHistoryHandler, params: ['id'] },
  { pattern: /^metrics\/(\d+)$/, handler: metricsIdHandler, params: ['id'] },
  { pattern: /^profiles\/default$/, handler: profilesDefaultHandler, params: [] },
  { pattern: /^profiles\/demo$/, handler: profilesDemoHandler, params: [] },
  { pattern: /^profiles\/all\/data$/, handler: profilesAllDataHandler, params: [] },
  { pattern: /^profiles\/(\d+)\/demo-seed$/, handler: profilesIdDemoSeedHandler, params: ['id'] },
  { pattern: /^profiles\/(\d+)\/import\/(\d+)$/, handler: profilesIdImportSourceHandler, params: ['id', 'sourceId'] },
  { pattern: /^profiles\/(\d+)\/data$/, handler: profilesIdDataHandler, params: ['id'] },
  { pattern: /^profiles\/(\d+)$/, handler: profilesIdHandler, params: ['id'] },
  { pattern: /^profiles$/, handler: profilesIndexHandler, params: [] },
  { pattern: /^stats$/, handler: statsIndexHandler, params: [] },
  { pattern: /^streaks$/, handler: streaksIndexHandler, params: [] },
  { pattern: /^tags$/, handler: tagsIndexHandler, params: [] },
  { pattern: /^tasks\/migrate$/, handler: tasksMigrateHandler, params: [] },
  { pattern: /^tasks\/(\d+)\/archive$/, handler: tasksIdArchiveHandler, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/cascade$/, handler: tasksIdCascadeHandler, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/complete$/, handler: tasksIdCompleteHandler, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/completions$/, handler: tasksIdCompletionsHandler, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/history$/, handler: tasksIdHistoryHandler, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/metrics$/, handler: tasksIdMetricsHandler, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/reassign$/, handler: tasksIdReassignHandler, params: ['id'] },
  { pattern: /^tasks\/(\d+)\/variations$/, handler: tasksIdVariationsHandler, params: ['id'] },
  { pattern: /^tasks\/(\d+)$/, handler: tasksIdHandler, params: ['id'] },
  { pattern: /^tasks$/, handler: tasksIndexHandler, params: [] },
  { pattern: /^variations\/(\d+)$/, handler: variationsIdHandler, params: ['id'] },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathSegments = req.query.path;
  const path = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments || '';

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
