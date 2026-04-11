import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage } from '../task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  try {
    const { taskIds, targetProfileId } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'taskIds must be a non-empty array' });
    }
    if (!targetProfileId) {
      return res.status(400).json({ error: 'targetProfileId is required' });
    }

    const updatedTasks = await storage.migrateTasksToProfile(taskIds.map(Number), Number(targetProfileId), user.id);
    res.json({ success: true, tasks: updatedTasks });
  } catch (error) {
    console.error('Error migrating tasks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
