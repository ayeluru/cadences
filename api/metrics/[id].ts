import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../_lib/auth';
import { storage } from '../_lib/task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const metricId = parseInt(req.query.id as string, 10);

  if (isNaN(metricId)) {
    return res.status(400).json({ error: 'Invalid metric ID' });
  }

  try {
    const metric = await storage.getTaskMetric(metricId);
    if (!metric) {
      return res.status(404).json({ message: 'Metric not found' });
    }

    const task = await storage.getTask(metric.taskId);
    if (!task || task.userId !== user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await storage.deleteTaskMetric(metricId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting metric:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
