import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../../_lib/auth';
import { storage } from '../../_lib/task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const taskId = parseInt(id as string, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    if (req.method === 'GET') {
      const metricsData = await storage.getTaskMetrics(taskId);
      return res.json(metricsData);
    }

    if (req.method === 'POST') {
      const existing = await storage.getTask(taskId);
      if (!existing || existing.userId !== user.id) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const metric = await storage.createTaskMetric({ ...req.body, taskId });
      return res.status(201).json(metric);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error handling task metrics:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
