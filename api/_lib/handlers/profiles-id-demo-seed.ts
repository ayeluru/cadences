import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage } from '../task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const profileId = parseInt(id as string, 10);

  if (isNaN(profileId)) {
    return res.status(400).json({ error: 'Invalid profile ID' });
  }

  try {
    const profiles = await storage.getProfiles(user.id);
    const profile = profiles.find(p => p.id === profileId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (!profile.isDemo) {
      return res.status(400).json({ error: 'Profile is not a demo profile' });
    }

    await storage.deleteProfileData(profileId, user.id);
    await storage.seedDemoProfile(user.id, profileId);
    return res.json({ success: true, message: 'Demo data regenerated successfully', profile });
  } catch (error) {
    console.error('Error regenerating demo data:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
