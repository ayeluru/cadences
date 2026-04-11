import type { VercelRequest, VercelResponse } from '@vercel/node';

import authUserHandler from './_auth/user';
import calendarEnhancedHandler from './_calendar/enhanced';
import categoriesIndexHandler from './_categories/index';
import categoriesIdHandler from './_categories/[id]';
import clearDataHandler from './_misc/clear-data';
import completionsIdHandler from './_completions/[id]';
import completionsCalendarHandler from './_completions/calendar';
import metricsIdHandler from './_metrics/[id]';
import metricsIdHistoryHandler from './_metrics/[id]/history';
import profilesIndexHandler from './_profiles/index';
import profilesDefaultHandler from './_profiles/default';
import profilesDemoHandler from './_profiles/demo';
import profilesAllDataHandler from './_profiles/all/data';
import profilesIdHandler from './_profiles/[id]';
import profilesIdDataHandler from './_profiles/[id]/data';
import profilesIdDemoSeedHandler from './_profiles/[id]/demo-seed';
import profilesIdImportSourceHandler from './_profiles/[id]/import/[sourceId]';
import statsIndexHandler from './_stats/index';
import streaksIndexHandler from './_streaks/index';
import tagsIndexHandler from './_tags/index';
import tasksIndexHandler from './_tasks/index';
import tasksMigrateHandler from './_tasks/migrate';
import tasksIdHandler from './_tasks/[id]';
import tasksIdArchiveHandler from './_tasks/[id]/archive';
import tasksIdCascadeHandler from './_tasks/[id]/cascade';
import tasksIdCompleteHandler from './_tasks/[id]/complete';
import tasksIdCompletionsHandler from './_tasks/[id]/completions';
import tasksIdHistoryHandler from './_tasks/[id]/history';
import tasksIdMetricsHandler from './_tasks/[id]/metrics';
import tasksIdReassignHandler from './_tasks/[id]/reassign';
import tasksIdVariationsHandler from './_tasks/[id]/variations';
import variationsIdHandler from './_variations/[id]';

type Handler = (req: VercelRequest, res: VercelResponse) => any;

interface Route {
  pattern: RegExp;
  handler: Handler;
  params: string[];
}

const routes: Route[] = [
  // Auth
  { pattern: /^auth\/user$/, handler: authUserHandler, params: [] },

  // Calendar
  { pattern: /^calendar\/enhanced$/, handler: calendarEnhancedHandler, params: [] },

  // Categories
  { pattern: /^categories$/, handler: categoriesIndexHandler, params: [] },
  { pattern: /^categories\/(\d+)$/, handler: categoriesIdHandler, params: ['id'] },

  // Clear data
  { pattern: /^clear-data$/, handler: clearDataHandler, params: [] },

  // Completions
  { pattern: /^completions\/calendar$/, handler: completionsCalendarHandler, params: [] },
  { pattern: /^completions\/(\d+)$/, handler: completionsIdHandler, params: ['id'] },

  // Metrics
  { pattern: /^metrics\/(\d+)\/history$/, handler: metricsIdHistoryHandler, params: ['id'] },
  { pattern: /^metrics\/(\d+)$/, handler: metricsIdHandler, params: ['id'] },

  // Profiles (specific routes before parameterized)
  { pattern: /^profiles\/default$/, handler: profilesDefaultHandler, params: [] },
  { pattern: /^profiles\/demo$/, handler: profilesDemoHandler, params: [] },
  { pattern: /^profiles\/all\/data$/, handler: profilesAllDataHandler, params: [] },
  { pattern: /^profiles\/(\d+)\/demo-seed$/, handler: profilesIdDemoSeedHandler, params: ['id'] },
  { pattern: /^profiles\/(\d+)\/import\/(\d+)$/, handler: profilesIdImportSourceHandler, params: ['id', 'sourceId'] },
  { pattern: /^profiles\/(\d+)\/data$/, handler: profilesIdDataHandler, params: ['id'] },
  { pattern: /^profiles\/(\d+)$/, handler: profilesIdHandler, params: ['id'] },
  { pattern: /^profiles$/, handler: profilesIndexHandler, params: [] },

  // Stats
  { pattern: /^stats$/, handler: statsIndexHandler, params: [] },

  // Streaks
  { pattern: /^streaks$/, handler: streaksIndexHandler, params: [] },

  // Tags
  { pattern: /^tags$/, handler: tagsIndexHandler, params: [] },

  // Tasks (specific routes before parameterized)
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

  // Variations
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
