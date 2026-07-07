import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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
  const [bootError, setBootError] = useState<Error | null>(null);
  const navigate = useNavigate();

  if (bootError) {
    throw bootError;
  }

  useEffect(() => {
    const e2eEnabled =
      import.meta.env.DEV && window.localStorage.getItem(getE2EAuthFlag()) === "true";
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

    let active = true;
    let unsubscribe = () => {};

    const convertAuthError = (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return new Error(
        message.includes("SUPABASE_NOT_CONFIGURED") ? message : `AUTH_SESSION_ERROR: ${message}`
      );
    };

    try {
      const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
        if (!active) return;
        if (event === "PASSWORD_RECOVERY") {
          navigate("/reset-password", { replace: true });
        }
        setSession(s);
        setUser(s?.user ?? null);
        setLoading(false);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    } catch (error) {
      setLoading(false);
      setBootError(convertAuthError(error));
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!active) return;
        setSession(s);
        setUser(s?.user ?? null);
        setLoading(false);
      })
      .catch((error) => {
        if (!active) return;
        setLoading(false);
        setBootError(convertAuthError(error));
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

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
