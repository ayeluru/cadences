import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from './supabase.js';
import { db } from './db.js';
import { userRoles } from '../../shared/schema.js';
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

export async function isAdmin(userId: string): Promise<boolean> {
  const initialAdminId = process.env.INITIAL_ADMIN_USER_ID;
  if (initialAdminId && userId === initialAdminId) {
    const adminRows = await db.select().from(userRoles).where(eq(userRoles.role, 'admin'));
    if (adminRows.length === 0) {
      await db.insert(userRoles).values({ userId, role: 'admin' }).onConflictDoNothing();
      return true;
    }
  }
  const [role] = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return role?.role === 'admin';
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
