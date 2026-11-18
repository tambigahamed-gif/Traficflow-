import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";

export type TrafficAuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: "user";
};

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

function toTrafficUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
} | null | undefined): TrafficAuthUser | null {
  if (!user?.id) return null;
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name;
  return {
    id: user.id,
    email: user.email ?? null,
    name: typeof name === "string" ? name : null,
    role: "user",
  };
}

export function useAuth(options?: UseAuthOptions) {
  const [user, setUser] = useState<TrafficAuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};

  const refresh = useCallback(async () => {
    if (!supabaseConfigured) {
      setUser(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    const { data, error: sessionError } = await supabase.auth.getUser();
    if (sessionError && sessionError.name !== "AuthSessionMissingError") {
      setError(sessionError);
      setUser(null);
    } else {
      setError(null);
      setUser(toTrafficUser(data.user));
    }
    setLoading(false);
    return data.user;
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!supabaseConfigured) {
      setLoading(false);
      setError(new Error("Supabase n’est pas configuré pour ce projet."));
      return;
    }
    void supabase.auth.getUser().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      setUser(toTrafficUser(data.user));
      setError(sessionError?.name === "AuthSessionMissingError" ? null : sessionError ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(toTrafficUser(session?.user));
      setError(null);
      setLoading(false);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    setUser(null);
  }, []);

  useEffect(() => {
    if (!redirectOnUnauthenticated || loading || user || typeof window === "undefined") return;
    if (redirectPath && window.location.pathname !== redirectPath) window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, loading, user]);

  return useMemo(() => ({
    user,
    loading,
    error,
    isAuthenticated: Boolean(user),
    refresh,
    logout,
  }), [user, loading, error, refresh, logout]);
}
