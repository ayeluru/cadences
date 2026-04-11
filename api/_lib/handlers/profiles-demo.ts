import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage } from '../task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  try {
    const existingProfiles = await storage.getProfiles(user.id);
    const demoProfile = existingProfiles.find(p => p.isDemo);
    if (demoProfile) {
      return res.status(400).json({ success: false, message: 'Demo profile already exists.', profile: demoProfile });
    }

    const profile = await storage.createProfile(user.id, { name: 'Demo', slug: 'demo', isDemo: true });
    await storage.seedDemoProfile(user.id, profile.id);
    return res.status(201).json({ success: true, message: 'Demo profile created with sample data', profile });
  } catch (error) {
    console.error('Error creating demo profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
