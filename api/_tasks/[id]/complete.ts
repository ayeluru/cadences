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
    // Verify ownership before completing
    const existing = await storage.getTask(taskId);
    if (!existing || existing.userId !== user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { completedAt, notes, metrics, variationId } = req.body;

    const result = await storage.completeTask(
      taskId,
      completedAt ? new Date(completedAt) : undefined,
      notes,
      metrics,
      user.id,
      variationId
    );

    const enrichedTask = await enrichTask(result.task, user.id);

    return res.status(200).json({
      task: enrichedTask,
      completion: result.completion,
      streak: result.streak,
    });
  } catch (error) {
    console.error('Error completing task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
