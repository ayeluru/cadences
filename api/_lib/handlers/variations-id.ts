import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage } from '../task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const variationId = parseInt(req.query.id as string, 10);

  if (isNaN(variationId)) {
    return res.status(400).json({ error: 'Invalid variation ID' });
  }

  try {
    const allTasks = await storage.getTasks(user.id);
    let foundTask = null;
    for (const task of allTasks) {
      const variations = await storage.getTaskVariations(task.id);
      if (variations.some(v => v.id === variationId)) {
        foundTask = task;
        break;
      }
    }

    if (!foundTask || foundTask.userId !== user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await storage.deleteTaskVariation(variationId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting variation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
