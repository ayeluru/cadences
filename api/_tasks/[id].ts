import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../_lib/auth';
import { storage, enrichTask } from '../_lib/task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const taskId = parseInt(id as string, 10);

  if (isNaN(taskId)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  if (req.method === 'GET') {
    return handleGet(req, res, user.id, taskId);
  } else if (req.method === 'PUT') {
    return handlePut(req, res, user.id, taskId);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res, user.id, taskId);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse, userId: string, taskId: number) {
  try {
    const task = await storage.getTask(taskId);

    if (!task || task.userId !== userId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const enrichedTask = await enrichTask(task, userId);
    return res.status(200).json(enrichedTask);
  } catch (error) {
    console.error('Error fetching task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handlePut(req: VercelRequest, res: VercelResponse, userId: string, taskId: number) {
  try {
    // Verify ownership before update
    const existing = await storage.getTask(taskId);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { tagIds, metrics, ...updates } = req.body;

    const task = await storage.updateTask(taskId, updates, tagIds, metrics);
    const enrichedTask = await enrichTask(task, userId);

    return res.status(200).json(enrichedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse, userId: string, taskId: number) {
  try {
    // Verify ownership before delete
    const existing = await storage.getTask(taskId);
    if (!existing || existing.userId !== userId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await storage.deleteTask(taskId);
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
