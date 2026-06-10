import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { getE2EAuthFlag } from "@/lib/e2eFixtures";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import "@/styles/pages.css";

export default function AuthPage() {
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { user } = useAuth();

  const from = (routerLocation.state as { from?: { pathname: string } } | null)?.from?.pathname || "/app";

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (tab === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (err) throw err;
        if (!data.session) {
          // Email confirmation required — user is NOT signed in yet.
          setInfo("Check your inbox to confirm your email, then sign in.");
          setPassword("");
          setTab("signin");
        } else {
          toast.success("Account created — you're signed in");
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        toast.success("Welcome back");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("user already")) {
        setError("This email is already registered. Try signing in instead.");
      } else if (msg.includes("Invalid login")) {
        setError("Invalid email or password.");
      } else if (msg.toLowerCase().includes("email not confirmed")) {
        setError("Please confirm your email first — check your inbox for the link.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) setError(result.error.message || "Google sign-in failed.");
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) return setError(err.message);
    setInfo("Check your email for a password reset link.");
  }

  function switchTab(t: "signin" | "signup" | "forgot") {
    setTab(t); setError(""); setInfo("");
  }

  return (
    <>
      <Helmet>
        <title>Sign in or create an account — ContentForge</title>
        <meta name="description" content="Sign in to ContentForge or create a free account to generate AI-powered weekly content calendars for LinkedIn, X, Instagram, and more." />
        <link rel="canonical" href="https://contentforged.lovable.app/auth" />
        <meta property="og:title" content="Sign in to ContentForge" />
        <meta property="og:description" content="Access your AI-powered content calendar workspace." />
        <meta property="og:url" content="https://contentforged.lovable.app/auth" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <main className="auth-app">
        <div className="auth-shell">
          <section className="auth-marketing" aria-label="Product overview">
            <div>
              <div className="auth-brand">
                <div className="auth-mark">CF</div>
                <div className="auth-brand-text">
                  <div className="auth-eyebrow">AI content studio</div>
                  <h1 className="auth-title">Content<em>Forge</em></h1>
                </div>
              </div>
              <p className="auth-sub">
                Sign in to generate, refine, and schedule a full week of content without losing brand context.
              </p>
              <div className="auth-badges">
                <span className="auth-badge"><strong>Autosave</strong> enabled</span>
                <span className="auth-badge"><strong>Templates</strong> ready</span>
                <span className="auth-badge"><strong>Recovery</strong> built in</span>
              </div>
            </div>

            <div className="auth-points">
              <div className="auth-point">
                <span className="auth-point-bullet" />
                <div>
                  <h2>One brief, one calendar</h2>
                  <p>Turn a single input into a complete weekly plan for LinkedIn, X, Instagram, Facebook, newsletters, and blogs.</p>
                </div>
              </div>
              <div className="auth-point">
                <span className="auth-point-bullet" />
                <div>
                  <h2>Fast, but not loose</h2>
                  <p>Brand defaults, hashtag rules, and draft recovery keep the output steady even when the workflow moves quickly.</p>
                </div>
              </div>
            </div>
          </section>

          <div className="auth-card">
            <p className="auth-inline-note">{tab === "signin" ? "Welcome back. Pick up where you left off." : tab === "signup" ? "Create your workspace and start with a clean first brief." : "We’ll send a reset link to your inbox."}</p>

            {tab !== "forgot" && (
              <div className="auth-tabs" role="tablist" aria-label="Authentication modes">
                <button id="auth-tab-signin" role="tab" aria-selected={tab === "signin"} aria-controls="auth-panel-signin" className={`auth-tab ${tab === "signin" ? "on" : ""}`} onClick={() => switchTab("signin")} type="button" aria-label="Switch to sign in mode">Sign in</button>
                <button id="auth-tab-signup" role="tab" aria-selected={tab === "signup"} aria-controls="auth-panel-signup" className={`auth-tab ${tab === "signup" ? "on" : ""}`} onClick={() => switchTab("signup")} type="button" aria-label="Switch to sign up mode">Sign up</button>
              </div>
            )}

            {tab === "forgot" ? (
              <form onSubmit={handleForgot}>
                <div className="auth-field">
                  <div className="auth-label">Email</div>
                  <input className="auth-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
                </div>
                {error && <div className="auth-err" role="alert" aria-live="assertive">{error}</div>}
                {info && <div className="auth-ok" role="status" aria-live="polite">{info}</div>}
                <button className="auth-btn" type="submit" disabled={loading} aria-busy={loading}>
                  {loading ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                        <circle cx="7" cy="7" r="5.5" stroke="rgba(7,8,13,0.35)" strokeWidth="2" />
                        <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#07080d" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Sending…
                    </span>
                  ) : "Send reset link"}
                </button>
                <button type="button" className="auth-forgot" onClick={() => switchTab("signin")}>← Back to sign in</button>
              </form>
            ) : (
              <form
                onSubmit={handleEmailAuth}
                id={tab === "signin" ? "auth-panel-signin" : "auth-panel-signup"}
                role="tabpanel"
                aria-labelledby={tab === "signin" ? "auth-tab-signin" : "auth-tab-signup"}
              >
                {tab === "signup" && (
                  <div className="auth-field">
                    <div className="auth-label">Display name</div>
                    <input className="auth-input" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
                  </div>
                )}
                <div className="auth-field">
                  <div className="auth-label">Email</div>
                  <input className="auth-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
                </div>
                <div className="auth-field">
                  <div className="auth-label">Password</div>
                  <input className="auth-input" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" aria-describedby={tab === "signup" ? "pw-strength" : undefined} />
                  {tab === "signup" && password.length > 0 && (
                    <div id="pw-strength" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ display: "flex", gap: 3 }}>
                        {[0, 1, 2].map(i => (
                          <div
                            key={i}
                            className={cn(
                              "h-[3px] w-8 rounded-full transition-colors duration-200",
                              password.length >= [6, 10, 14][i]
                                ? (password.length >= 14 ? "bg-primary" : password.length >= 10 ? "bg-yellow-400" : "bg-destructive")
                                : "bg-white/[0.08]"
                            )}
                          />
                        ))}
                      </div>
                      <span className={cn(
                        "text-[10px]",
                        password.length >= 14 ? "text-primary" : password.length >= 10 ? "text-yellow-400" : "text-destructive"
                      )}>
                        {password.length < 6 ? "Too short" : password.length < 10 ? "Weak" : password.length < 14 ? "Good" : "Strong"}
                      </span>
                    </div>
                  )}
                </div>
                {tab === "signup" && <div className="auth-inline-note">Use a password you can keep handy, then save a brief template after your first successful calendar.</div>}
                {error && <div className="auth-err" role="alert" aria-live="assertive">{error}</div>}
                {info && <div className="auth-ok" role="status" aria-live="polite">{info}</div>}
                <button className="auth-btn" type="submit" disabled={loading} aria-busy={loading}>
                  {loading ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                        <circle cx="7" cy="7" r="5.5" stroke="rgba(7,8,13,0.35)" strokeWidth="2" />
                        <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="#07080d" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      {tab === "signin" ? "Signing in…" : "Creating account…"}
                    </span>
                  ) : (tab === "signin" ? "Sign in" : "Create account")}
                </button>
                {tab === "signin" && (
                  <button type="button" className="auth-forgot" onClick={() => switchTab("forgot")}>Forgot password?</button>
                )}
              </form>
            )}

            <div className="auth-divider">or</div>
            <button className="auth-google" onClick={handleGoogle} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
            {import.meta.env.DEV && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: "#7c8294", fontSize: 11 }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                  <span>Developer Sandbox</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                </div>
                <button
                  onClick={() => {
                    window.localStorage.setItem(getE2EAuthFlag(), "true");
                    toast.success("Sandbox session activated");
                    navigate(from, { replace: true });
                    window.location.reload();
                  }}
                  style={{
                    width: "100%",
                    minHeight: 44,
                    padding: 12,
                    borderRadius: 14,
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "var(--font-body)",
                    cursor: "pointer",
                    background: "rgba(200,240,154,0.05)",
                    border: "1px dashed rgba(200,240,154,0.3)",
                    color: "#c8f09a",
                    transition: "all .15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                  type="button"
                >
                  💡 Enter Sandbox Mode (Bypass Auth)
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
