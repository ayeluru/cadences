import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, unauthorized } from '../auth';
import { storage } from '../task-utils';
import { supabaseAdmin } from '../supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyAuth(req);
  if (!user) return unauthorized(res);

  if (req.method === 'GET') {
    return res.status(200).json({ id: user.id, email: user.email });
  } else if (req.method === 'PATCH') {
    return handlePatch(req, res, user.id);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res, user.id);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handlePatch(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const { firstName, lastName } = req.body;
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { firstName, lastName },
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ id: data.user.id, email: data.user.email });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleDelete(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    await storage.deleteAllUserData(userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
