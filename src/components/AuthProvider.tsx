"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface CurrentUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  /** Re-fetches /api/auth/me — call after a successful login/signup or logout. */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Single client-side source of truth for "is this a guest or a signed-in user" — the journey
 * search and safety-tools pages are guest-accessible, but specific actions (saving a contact,
 * triggering SOS) still require an account, so several unrelated components need this same
 * answer without each re-implementing its own session check. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = res.ok ? await res.json() : { user: null };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial session check on mount
    refresh();
  }, [refresh]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, refresh, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
