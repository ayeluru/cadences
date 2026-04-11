import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage } from '../task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const taskId = parseInt(id as string, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    const task = await storage.getTask(taskId);
    if (!task || task.userId !== user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const taskCompletions = await storage.getCompletions(taskId);
    res.json(taskCompletions);
  } catch (error) {
    console.error('Error fetching completions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
