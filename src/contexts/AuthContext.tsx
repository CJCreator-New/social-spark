import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getE2EAuthFlag, E2E_USER_EMAIL, E2E_USER_ID } from "@/lib/e2eFixtures";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const e2eEnabled = import.meta.env.DEV && window.localStorage.getItem(getE2EAuthFlag()) === "true";
    if (e2eEnabled) {
      const mockUser = {
        id: E2E_USER_ID,
        email: E2E_USER_EMAIL,
        role: "authenticated",
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as User;
      const mockSession = {
        access_token: "e2e-access-token",
        refresh_token: "e2e-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: mockUser,
      } as Session;

      setSession(mockSession);
      setUser(mockUser);
      setLoading(false);
      return;
    }

    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (import.meta.env.DEV && window.localStorage.getItem(getE2EAuthFlag()) === "true") {
      window.localStorage.removeItem(getE2EAuthFlag());
      setSession(null);
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
