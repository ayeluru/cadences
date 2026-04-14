import { useEffect, useState, useCallback } from "react";
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

export function useAuth() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        if (!session) {
          queryClient.clear();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const logout = async () => {
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      queryClient.clear();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.refreshSession();
    if (session) {
      setSession(session);
      setUser(session.user);
    }
  }, []);

  return {
    user,
    session,
    isLoading,
    isAuthenticated: !!user,
    logout,
    isLoggingOut,
    refreshUser,
  };
}

// Helper to get access token for API calls
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
