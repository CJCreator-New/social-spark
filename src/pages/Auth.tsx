import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Manrope:wght@400;500;600;700;800&display=swap');
.auth-app { min-height:100vh; background:
  radial-gradient(circle at 16% 18%, rgba(216,255,121,0.12), transparent 24%),
  radial-gradient(circle at 84% 8%, rgba(130,233,198,0.08), transparent 22%),
  linear-gradient(180deg, #05060a 0%, #0a0d14 100%);
  color:#f2efe7; font-family:'Manrope',sans-serif; display:flex; align-items:center; justify-content:center; padding:24px; position:relative; overflow:hidden; }
.auth-app::before { content:''; position:absolute; inset:auto -8% -18% auto; width:520px; height:520px; border-radius:50%; background:radial-gradient(circle,rgba(216,255,121,0.08) 0%,transparent 68%); pointer-events:none; filter:blur(16px); }
.auth-shell { width:100%; max-width:1040px; display:grid; grid-template-columns:minmax(0,1fr) 430px; gap:18px; align-items:stretch; position:relative; z-index:1; }
.auth-marketing, .auth-card { border:1px solid rgba(255,255,255,0.08); border-radius:28px; background:rgba(13,16,25,0.72); box-shadow:0 30px 90px rgba(0,0,0,0.35); overflow:hidden; }
.auth-marketing { padding:34px; display:flex; flex-direction:column; justify-content:space-between; gap:22px; position:relative; }
.auth-marketing::before { content:''; position:absolute; inset:-2px; background:radial-gradient(circle at 18% 0%, rgba(216,255,121,0.10), transparent 30%), radial-gradient(circle at 96% 0%, rgba(130,233,198,0.08), transparent 24%); pointer-events:none; }
.auth-marketing > * { position:relative; z-index:1; }
.auth-brand { display:flex; align-items:center; gap:12px; }
.auth-mark { width:42px; height:42px; border-radius:14px; display:grid; place-items:center; background:linear-gradient(135deg, rgba(216,255,121,0.96), rgba(130,233,198,0.85)); color:#08100c; font-weight:900; letter-spacing:-.03em; }
.auth-brand-text { display:flex; flex-direction:column; line-height:1.05; }
.auth-eyebrow { font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:#d8ff79; font-weight:800; margin-bottom:10px; display:flex; align-items:center; gap:8px; }
.auth-eyebrow::before { content:''; display:block; width:22px; height:1px; background:#d8ff79; }
.auth-title { font-family:'Fraunces',serif; font-size:clamp(2.4rem, 4vw, 4rem); font-weight:500; line-height:.96; margin:0 0 12px; letter-spacing:-.05em; }
.auth-title em { font-style:italic; color:#d8ff79; }
.auth-sub { font-size:15px; color:#a2a6b6; font-weight:400; margin:0; line-height:1.7; max-width:48ch; }
.auth-points { display:grid; gap:10px; margin-top:auto; }
.auth-point { display:flex; gap:12px; align-items:flex-start; padding:14px 16px; border-radius:18px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); }
.auth-point-bullet { width:10px; height:10px; border-radius:50%; margin-top:5px; background:linear-gradient(135deg, #d8ff79, #82e9c6); flex:0 0 auto; box-shadow:0 0 20px rgba(216,255,121,0.14); }
.auth-point h2 { margin:0 0 4px; font-size:13px; font-weight:800; }
.auth-point p { margin:0; font-size:12px; line-height:1.6; color:#a2a6b6; }
.auth-card { padding:30px; }
.auth-tabs { display:flex; gap:4px; background:rgba(7,8,13,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:999px; padding:4px; margin:18px 0 22px; }
.auth-tab { flex:1; padding:10px 12px; font-size:12px; border:none; background:transparent; color:#7c8294; cursor:pointer; border-radius:999px; font-family:'Manrope',sans-serif; font-weight:700; transition:all .15s; }
.auth-tab.on { background:rgba(216,255,121,0.12); color:#d8ff79; }
.auth-field { margin-bottom:13px; }
.auth-label { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#7c8294; margin-bottom:7px; font-weight:800; }
.auth-input { width:100%; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:12px 13px; font-size:13px; color:#f2efe7; font-family:'Manrope',sans-serif; font-weight:500; outline:none; transition:border-color .2s, box-shadow .2s; box-sizing:border-box; }
.auth-input:focus { border-color:rgba(216,255,121,0.32); box-shadow:0 0 0 3px rgba(216,255,121,0.08); }
.auth-btn { width:100%; padding:12px 14px; border-radius:14px; font-size:13px; font-weight:800; font-family:'Manrope',sans-serif; cursor:pointer; border:none; background:linear-gradient(135deg, #d8ff79, #f0ffbf); color:#08100c; transition:transform .15s, box-shadow .15s; margin-top:8px; }
.auth-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 16px 40px rgba(216,255,121,0.12); }
.auth-btn:disabled { opacity:.55; cursor:not-allowed; transform:none; box-shadow:none; }
.auth-divider { display:flex; align-items:center; gap:10px; margin:20px 0; color:#7c8294; font-size:11px; }
.auth-divider::before, .auth-divider::after { content:''; flex:1; height:1px; background:rgba(255,255,255,0.08); }
.auth-google { width:100%; padding:12px; border-radius:14px; font-size:13px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.10); color:#f2efe7; transition:all .15s; display:flex; align-items:center; justify-content:center; gap:8px; }
.auth-google:hover { border-color:rgba(216,255,121,0.28); background:rgba(216,255,121,0.05); }
.auth-err { background:rgba(240,154,154,0.08); border:1px solid rgba(240,154,154,0.22); border-radius:12px; padding:10px 13px; font-size:12px; color:#f09a9a; margin-top:10px; font-weight:500; line-height:1.5; }
.auth-ok { background:rgba(216,255,121,0.07); border:1px solid rgba(216,255,121,0.22); border-radius:12px; padding:10px 13px; font-size:12px; color:#d8ff79; margin-top:10px; font-weight:500; line-height:1.5; }
.auth-forgot { background:none; border:none; color:#7c8294; font-size:11px; font-family:'Manrope',sans-serif; cursor:pointer; padding:0; margin-top:8px; text-align:right; display:block; margin-left:auto; }
.auth-forgot:hover { color:#d8ff79; }
.auth-inline-note { margin-top:10px; font-size:11px; color:#7c8294; line-height:1.6; }
.auth-badges { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
.auth-badge { padding:8px 10px; border-radius:999px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); color:#a2a6b6; font-size:11px; }
.auth-badge strong { color:#f2efe7; }

@media (max-width: 960px) {
  .auth-shell { grid-template-columns:1fr; }
  .auth-marketing { min-height:auto; }
}

@media (max-width: 640px) {
  .auth-app { padding:16px; }
  .auth-marketing, .auth-card { border-radius:22px; }
  .auth-marketing, .auth-card { padding:22px; }
  .auth-title { font-size:2.3rem; }
  .auth-badges { flex-direction:column; }
}
`;

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
      <style>{css}</style>
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
                <button className={`auth-tab ${tab === "signin" ? "on" : ""}`} onClick={() => switchTab("signin")} type="button">Sign in</button>
                <button className={`auth-tab ${tab === "signup" ? "on" : ""}`} onClick={() => switchTab("signup")} type="button">Sign up</button>
              </div>
            )}

            {tab === "forgot" ? (
              <form onSubmit={handleForgot}>
                <div className="auth-field">
                  <div className="auth-label">Email</div>
                  <input className="auth-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" />
                </div>
                {error && <div className="auth-err">{error}</div>}
                {info && <div className="auth-ok">{info}</div>}
                <button className="auth-btn" type="submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
                <button type="button" className="auth-forgot" onClick={() => switchTab("signin")}>← Back to sign in</button>
              </form>
            ) : (
              <form onSubmit={handleEmailAuth}>
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
                  <input className="auth-input" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
                </div>
                {tab === "signup" && <div className="auth-inline-note">Use a password you can keep handy, then save a brief template after your first successful calendar.</div>}
                {error && <div className="auth-err">{error}</div>}
                {info && <div className="auth-ok">{info}</div>}
                <button className="auth-btn" type="submit" disabled={loading}>
                  {loading ? "Please wait…" : tab === "signin" ? "Sign in" : "Create account"}
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
          </div>
        </div>
      </main>
    </>
  );
}
