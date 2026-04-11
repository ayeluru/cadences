import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../_lib/auth';
import { storage, enrichTask } from '../_lib/task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  if (req.method === 'GET') {
    return handleGet(req, res, user.id);
  } else if (req.method === 'POST') {
    return handlePost(req, res, user.id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const { profileId, search, categoryId, tagId, excludeDemo } = req.query;

    const profileIdNum = profileId ? parseInt(profileId as string, 10) : undefined;
    const excludeDemoFlag = excludeDemo === 'true';

    let tasks = await storage.getTasks(userId, profileIdNum, excludeDemoFlag);

    // Apply search filter
    if (search) {
      const searchLower = (search as string).toLowerCase();
      tasks = tasks.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        (task.description?.toLowerCase().includes(searchLower))
      );
    }

    // Apply category filter
    if (categoryId) {
      const catId = parseInt(categoryId as string, 10);
      tasks = tasks.filter(task => task.categoryId === catId);
    }

    // Enrich tasks with computed fields
    const enrichedTasks = await Promise.all(
      tasks.map(task => enrichTask(task, userId))
    );

    // Apply tag filter after enrichment (since tags are loaded in enrichTask)
    let filteredTasks = enrichedTasks;
    if (tagId) {
      const tagIdNum = parseInt(tagId as string, 10);
      filteredTasks = enrichedTasks.filter(task =>
        task.tags?.some((t: any) => t.id === tagIdNum)
      );
    }

    // Sort by urgency
    filteredTasks.sort((a, b) => b.urgency - a.urgency);

    return res.status(200).json(filteredTasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handlePost(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const { tagIds, metrics, ...taskData } = req.body;

    const task = await storage.createTask(userId, taskData, tagIds, metrics);
    const enrichedTask = await enrichTask(task, userId);

    return res.status(201).json(enrichedTask);
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
