import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabase.js';
import { db } from './db.js';
import { userRoles, userActivity } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: string;
  email?: string;
}

export async function verifyAuth(req: VercelRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
    };
  } catch {
    return null;
  }
}

export async function touchLastActive(userId: string): Promise<void> {
  try {
    await db.insert(userActivity)
      .values({ userId, lastActiveAt: new Date() })
      .onConflictDoUpdate({
        target: userActivity.userId,
        set: { lastActiveAt: new Date() },
      });
  } catch {}
}

export async function isAdmin(userId: string): Promise<boolean> {
  const [role] = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  if (role?.role === 'admin') return true;

  const initialAdminId = process.env.INITIAL_ADMIN_USER_ID;
  if (initialAdminId && userId === initialAdminId && !role) {
    await db.insert(userRoles).values({ userId, role: 'admin' }).onConflictDoNothing();
    return true;
  }
  return false;
}

export async function verifyAdmin(req: VercelRequest): Promise<AuthUser | null> {
  const user = await verifyAuth(req);
  if (!user) return null;
  if (!(await isAdmin(user.id))) return null;
  return user;
}

export function unauthorized(res: VercelResponse) {
  return res.status(401).json({ error: 'Unauthorized' });
}

export function forbidden(res: VercelResponse) {
  return res.status(403).json({ error: 'Forbidden' });
}

// Wrapper for protected routes
export function withAuth(
  handler: (req: VercelRequest, res: VercelResponse, user: AuthUser) => Promise<void>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const user = await verifyAuth(req);

    if (!user) {
      return unauthorized(res);
    }

    return handler(req, res, user);
  };
}
