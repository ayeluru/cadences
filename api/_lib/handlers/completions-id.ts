import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage } from '../task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const completionId = parseInt(req.query.id as string, 10);

  if (isNaN(completionId)) {
    return res.status(400).json({ error: 'Invalid completion ID' });
  }

  try {
    await storage.deleteCompletion(completionId, user.id);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error deleting completion:', error);
    if (error.message === 'Completion not found') {
      return res.status(404).json({ message: 'Completion not found' });
    }
    if (error.message === 'Access denied') {
      return res.status(403).json({ message: 'Access denied' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
