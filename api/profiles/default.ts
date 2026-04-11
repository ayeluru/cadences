import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../_lib/auth';
import { storage } from '../_lib/task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  try {
    const profile = await storage.getOrCreateDefaultProfile(user.id);
    return res.status(200).json(profile);
  } catch (error) {
    console.error('Error getting default profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
