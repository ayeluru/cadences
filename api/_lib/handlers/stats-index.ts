import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage, enrichTask } from '../task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  if (req.method === 'GET') {
    return handleGet(req, res, user.id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;
    const excludeDemo = profileId === undefined;

    const completions = await storage.getAllCompletions(userId, profileId, excludeDemo);
    const tasks = await storage.getTasks(userId, profileId, excludeDemo);
    const enrichedTasks = await Promise.all(tasks.map(t => enrichTask(t, userId)));

    const totalCompletions = completions.length;

    const completionsByMonthMap = new Map<string, number>();
    completions.forEach(c => {
      const month = c.completedAt.toISOString().slice(0, 7);
      completionsByMonthMap.set(month, (completionsByMonthMap.get(month) || 0) + 1);
    });

    const completionsByMonth = Array.from(completionsByMonthMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const overdueCount = enrichedTasks.filter(t => t.status === 'overdue' || t.status === 'never_done').length;
    const overdueRate = tasks.length > 0 ? overdueCount / tasks.length : 0;

    return res.status(200).json({ totalCompletions, completionsByMonth, overdueRate });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
