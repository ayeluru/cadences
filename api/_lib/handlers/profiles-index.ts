import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage } from '../task-utils';

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
    const profiles = await storage.getProfiles(userId);
    return res.status(200).json(profiles);
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handlePost(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const profile = await storage.createProfile(userId, req.body);
    return res.status(201).json(profile);
  } catch (error) {
    console.error('Error creating profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
