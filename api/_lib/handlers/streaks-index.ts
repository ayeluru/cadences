import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage } from '../task-utils';

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
    const allStreaks = await storage.getAllStreaks(userId, profileId, excludeDemo);

    const enrichedStreaks = await Promise.all(allStreaks.map(async (streak) => {
      const task = await storage.getTask(streak.taskId);
      return {
        ...streak,
        taskTitle: task?.title || "Unknown Task"
      };
    }));

    return res.status(200).json(enrichedStreaks);
  } catch (error) {
    console.error('Error fetching streaks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
