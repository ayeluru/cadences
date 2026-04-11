import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage } from '../task-utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  const { id } = req.query;
  const profileId = parseInt(id as string, 10);

  if (isNaN(profileId)) {
    return res.status(400).json({ error: 'Invalid profile ID' });
  }

  if (req.method === 'PATCH') {
    return handlePatch(req, res, user.id, profileId);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res, user.id, profileId);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handlePatch(req: VercelRequest, res: VercelResponse, userId: string, profileId: number) {
  try {
    const profile = await storage.updateProfile(profileId, userId, req.body);
    return res.status(200).json(profile);
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse, userId: string, profileId: number) {
  try {
    const allProfiles = await storage.getProfiles(userId);
    if (allProfiles.length <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last profile' });
    }

    await storage.deleteProfile(profileId, userId);
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
