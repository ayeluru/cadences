import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../../_lib/auth';
import { storage } from '../../_lib/task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  try {
    await storage.deleteAllProfilesData(user.id);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting all profiles data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
