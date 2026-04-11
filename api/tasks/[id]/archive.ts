import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../../_lib/auth';
import { storage, enrichTask } from '../../_lib/task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
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
    const archived = await storage.archiveTask(taskId, user.id);
    const enriched = await enrichTask(archived, user.id);
    res.json(enriched);
  } catch (error) {
    console.error('Error archiving task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
