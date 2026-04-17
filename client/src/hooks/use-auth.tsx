import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

export function getDisplayName(user: User | null): string {
  if (!user) return "User";
  const meta = user.user_metadata;
  const first = meta?.firstName?.trim();
  const last = meta?.lastName?.trim();
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  return user.email?.split("@")[0] || "User";
}

export function getInitials(user: User | null): string {
  if (!user) return "U";
  const meta = user.user_metadata;
  const first = meta?.firstName?.trim();
  const last = meta?.lastName?.trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first[0].toUpperCase();
  if (last) return last[0].toUpperCase();
  return user.email?.[0]?.toUpperCase() || "U";
}

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  userRole: 'user' | 'admin';
  logout: () => Promise<void>;
  isLoggingOut: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userRole, setUserRole] = useState<'user' | 'admin'>(() => {
    return (sessionStorage.getItem('userRole') as 'user' | 'admin') || 'user';
  });

  useEffect(() => {
    const fetchRole = async (accessToken: string, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch('/api/auth/role', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            sessionStorage.setItem('userRole', data.role);
            setUserRole(data.role);
            return;
          }
        } catch {
          if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
      }
    };

    const sessionTimeout = setTimeout(() => {
      console.warn('Auth session check timed out — showing login');
      setSession(null);
      setUser(null);
      setIsLoading(false);
    }, 5000);

    supabase.auth.getSession().then(async ({ data: { session: cached } }) => {
      clearTimeout(sessionTimeout);
      if (cached) {
        const now = Math.floor(Date.now() / 1000);
        if (cached.expires_at && now >= cached.expires_at) {
          const refreshTimeout = setTimeout(() => {
            console.warn('Session refresh timed out — forcing re-login');
            supabase.auth.signOut({ scope: 'local' });
            setSession(null);
            setUser(null);
            setIsLoading(false);
          }, 5000);
          const { data } = await supabase.auth.refreshSession();
          clearTimeout(refreshTimeout);
          if (!data.session) {
            await supabase.auth.signOut({ scope: 'local' });
            setSession(null);
            setUser(null);
            setIsLoading(false);
            return;
          }
          setSession(data.session);
          setUser(data.session.user);
          fetchRole(data.session.access_token);
          setIsLoading(false);
          return;
        }
        fetchRole(cached.access_token);
      }
      setSession(cached);
      setUser(cached?.user ?? null);
      setIsLoading(false);
    }).catch(() => {
      clearTimeout(sessionTimeout);
      setSession(null);
      setUser(null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        if (session?.access_token) {
          fetchRole(session.access_token);
        } else {
          sessionStorage.removeItem('userRole');
          setUserRole('user');
          queryClient.clear();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    sessionStorage.removeItem('userRole');
    await supabase.auth.signOut({ scope: 'local' });
    queryClient.clear();
    window.location.replace("/");
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.refreshSession();
    if (session) {
      setSession(session);
      setUser(session.user);
    }
  }, []);

  const value: AuthState = {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: userRole === 'admin',
    userRole,
    logout,
    isLoggingOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Helper to get access token for API calls
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
