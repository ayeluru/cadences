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
    const { profileId } = req.query;
    const profileIdNum = profileId ? parseInt(profileId as string, 10) : undefined;

    const tags = await storage.getTags(userId, profileIdNum);
    return res.status(200).json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handlePost(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const tag = await storage.createTag(userId, req.body);
    return res.status(201).json(tag);
  } catch (error) {
    console.error('Error creating tag:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
