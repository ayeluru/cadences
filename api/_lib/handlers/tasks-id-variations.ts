import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage } from '../task-utils';

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
      const variationsList = await storage.getTaskVariations(taskId);
      return res.json(variationsList);
    }

    if (req.method === 'POST') {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Variation name is required' });
      }

      const task = await storage.getTask(taskId);
      if (!task || task.userId !== user.id) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const variation = await storage.createTaskVariation(taskId, name.trim());
      return res.status(201).json(variation);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error handling task variations:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
