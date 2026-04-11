import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage } from '../task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id, sourceId } = req.query;
  const targetProfileId = parseInt(id as string, 10);
  const sourceProfileId = parseInt(sourceId as string, 10);

  if (isNaN(targetProfileId) || isNaN(sourceProfileId)) {
    return res.status(400).json({ error: 'Invalid profile ID' });
  }

  try {
    const sourceProfile = await storage.getProfile(sourceProfileId, user.id);
    if (!sourceProfile) {
      return res.status(404).json({ error: 'Source profile not found' });
    }

    const targetProfile = await storage.getProfile(targetProfileId, user.id);
    if (!targetProfile) {
      return res.status(404).json({ error: 'Target profile not found' });
    }

    const result = await storage.importTasksFromProfile(sourceProfileId, targetProfileId, user.id);
    return res.json(result);
  } catch (error) {
    console.error('Error importing tasks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
