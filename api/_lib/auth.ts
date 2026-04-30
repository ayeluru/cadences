import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { supabaseAdmin } from './supabase.js';
import { db } from './db.js';
import { userRoles, userActivity } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

export interface AuthUser {
  id: string;
  email?: string;
}

// Lazy-init the JWKS resolver. jose caches keys internally per resolver,
// so subsequent verifications on the same instance are local-only.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const jwks = supabaseUrl
  ? createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`))
  : null;

export async function verifyAuth(req: VercelRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];

  // Fast path: verify the JWT locally against Supabase's published JWKS.
  // Saves ~150ms per request vs. round-tripping to Supabase Auth. The JWKS
  // is fetched once per cold start and cached; key rotations are picked up
  // automatically by jose on subsequent fetches.
  if (jwks) {
    try {
      const { payload } = await jwtVerify(token, jwks);
      const sub = payload.sub;
      if (typeof sub === 'string' && sub.length > 0) {
        return {
          id: sub,
          email: typeof payload.email === 'string' ? payload.email : undefined,
        };
      }
    } catch {
      // Fall through to HTTP verification — possible during a key rotation
      // window or if the JWKS fetch itself failed.
    }
  }

  // Fallback: HTTP round-trip to Supabase Auth.
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
