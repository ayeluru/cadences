import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../../_lib/auth';
import { storage } from '../../_lib/task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const metricId = parseInt(req.query.id as string, 10);

  if (isNaN(metricId)) {
    return res.status(400).json({ error: 'Invalid metric ID' });
  }

  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const history = await storage.getMetricHistory(metricId, limit);
    return res.status(200).json(history);
  } catch (error) {
    console.error('Error fetching metric history:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
