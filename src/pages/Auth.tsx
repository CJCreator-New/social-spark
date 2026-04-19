import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Sora:wght@300;400;500;600&display=swap');
.auth-app { min-height:100vh; background:#07080d; color:#edeae3; font-family:'Sora',sans-serif; display:flex; align-items:center; justify-content:center; padding:24px; position:relative; overflow:hidden; }
.auth-app::before { content:''; position:absolute; width:700px; height:700px; border-radius:50%; background:radial-gradient(circle,rgba(200,240,154,0.05) 0%,transparent 65%); top:-300px; left:50%; transform:translateX(-50%); pointer-events:none; }
.auth-card { width:100%; max-width:420px; background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:16px; padding:36px 30px; position:relative; z-index:1; }
.auth-eyebrow { font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:#c8f09a; font-weight:500; margin-bottom:10px; display:flex; align-items:center; gap:8px; }
.auth-eyebrow::before { content:''; display:block; width:22px; height:1px; background:#c8f09a; }
.auth-title { font-family:'Playfair Display',serif; font-size:30px; font-weight:400; line-height:1.1; margin:0 0 8px; }
.auth-title em { font-style:italic; color:#c8f09a; }
.auth-sub { font-size:13px; color:#7a7a8e; font-weight:300; margin-bottom:26px; line-height:1.6; }
.auth-tabs { display:flex; gap:4px; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:3px; margin-bottom:22px; }
.auth-tab { flex:1; padding:8px; font-size:12px; border:none; background:transparent; color:#7a7a8e; cursor:pointer; border-radius:6px; font-family:'Sora',sans-serif; font-weight:400; transition:all .15s; }
.auth-tab.on { background:rgba(200,240,154,0.12); color:#c8f09a; }
.auth-field { margin-bottom:13px; }
.auth-label { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#7a7a8e; margin-bottom:7px; font-weight:500; }
.auth-input { width:100%; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:11px 13px; font-size:13px; color:#edeae3; font-family:'Sora',sans-serif; font-weight:300; outline:none; transition:border-color .2s; box-sizing:border-box; }
.auth-input:focus { border-color:rgba(200,240,154,0.28); }
.auth-btn { width:100%; padding:11px; border-radius:8px; font-size:13px; font-weight:500; font-family:'Sora',sans-serif; cursor:pointer; border:none; background:#c8f09a; color:#07080d; transition:all .15s; margin-top:8px; }
.auth-btn:hover:not(:disabled) { background:#d4f7aa; }
.auth-btn:disabled { opacity:.5; cursor:not-allowed; }
.auth-divider { display:flex; align-items:center; gap:10px; margin:20px 0; color:#3a3a50; font-size:11px; }
.auth-divider::before, .auth-divider::after { content:''; flex:1; height:1px; background:rgba(255,255,255,0.055); }
.auth-google { width:100%; padding:11px; border-radius:8px; font-size:13px; font-weight:400; font-family:'Sora',sans-serif; cursor:pointer; background:transparent; border:1px solid rgba(255,255,255,0.1); color:#edeae3; transition:all .15s; display:flex; align-items:center; justify-content:center; gap:8px; }
.auth-google:hover { border-color:rgba(200,240,154,0.28); }
.auth-err { background:rgba(240,154,154,0.07); border:1px solid rgba(240,154,154,0.2); border-radius:8px; padding:10px 13px; font-size:12px; color:#f09a9a; margin-top:10px; font-weight:300; }
.auth-ok { background:rgba(200,240,154,0.06); border:1px solid rgba(200,240,154,0.2); border-radius:8px; padding:10px 13px; font-size:12px; color:#c8f09a; margin-top:10px; font-weight:300; }
.auth-forgot { background:none; border:none; color:#7a7a8e; font-size:11px; font-family:'Sora',sans-serif; cursor:pointer; padding:0; margin-top:8px; text-align:right; display:block; margin-left:auto; }
.auth-forgot:hover { color:#c8f09a; }
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
  const location = useLocation();
  const { user } = useAuth();

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || "/";

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (tab === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (err) throw err;
        toast.success("Account created — signing you in…");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        toast.success("Welcome back");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg.includes("Invalid login") ? "Invalid email or password." : msg);
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
      <style>{css}</style>
      <div className="auth-app">
        <div className="auth-card">
          <div className="auth-eyebrow">AI content studio</div>
          <h1 className="auth-title">Content<em>Forge</em></h1>
          <p className="auth-sub">{tab === "signin" ? "Sign in to generate and save your weekly calendars." : tab === "signup" ? "Create your account to start writing your content week." : "Enter your email and we'll send you a reset link."}</p>

          {tab !== "forgot" && (
            <div className="auth-tabs">
              <button className={`auth-tab ${tab === "signin" ? "on" : ""}`} onClick={() => switchTab("signin")}>Sign in</button>
              <button className={`auth-tab ${tab === "signup" ? "on" : ""}`} onClick={() => switchTab("signup")}>Sign up</button>
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
              {error && <div className="auth-err">{error}</div>}
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
    </>
  );
}
