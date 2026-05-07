import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Sora:wght@300;400;500;600&display=swap');
.rp-app { min-height:100vh; background:#07080d; color:#edeae3; font-family:'Sora',sans-serif; display:flex; align-items:center; justify-content:center; padding:24px; }
.rp-card { width:100%; max-width:420px; background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:16px; padding:36px 30px; }
.rp-eyebrow { font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:#c8f09a; font-weight:500; margin-bottom:10px; display:flex; align-items:center; gap:8px; }
.rp-eyebrow::before { content:''; display:block; width:22px; height:1px; background:#c8f09a; }
.rp-title { font-family:'Playfair Display',serif; font-size:26px; font-weight:400; margin:0 0 8px; }
.rp-sub { font-size:13px; color:#7a7a8e; font-weight:300; margin-bottom:22px; line-height:1.6; }
.rp-label { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#7a7a8e; margin-bottom:7px; font-weight:500; }
.rp-input { width:100%; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:11px 13px; font-size:13px; color:#edeae3; font-family:'Sora',sans-serif; font-weight:300; outline:none; box-sizing:border-box; margin-bottom:13px; }
.rp-input:focus { border-color:rgba(200,240,154,0.28); }
.rp-btn { width:100%; padding:11px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; border:none; background:#c8f09a; color:#07080d; margin-top:8px; }
.rp-btn:disabled { opacity:.5; cursor:not-allowed; }
.rp-err { background:rgba(240,154,154,0.07); border:1px solid rgba(240,154,154,0.2); border-radius:8px; padding:10px 13px; font-size:12px; color:#f09a9a; margin-top:10px; }
`;

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let resolved = false;
    // Supabase parses the recovery hash and emits PASSWORD_RECOVERY
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        resolved = true;
        setReady(true);
      }
    });
    // Also check if a session already exists (link already processed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { resolved = true; setReady(true); }
    });

    // Timeout: if neither event nor session resolves the link in 6s, treat as invalid/expired.
    const timer = setTimeout(() => {
      if (!resolved) setLinkExpired(true);
    }, 6000);

    return () => { sub.subscription.unsubscribe(); clearTimeout(timer); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) return setError(err.message);
    toast.success("Password updated");
    navigate("/app", { replace: true });
  }

  return (
    <>
      <style>{css}</style>
      <div className="rp-app">
        <div className="rp-card">
          <div className="rp-eyebrow">Reset password</div>
          <h1 className="rp-title">{linkExpired ? "Link expired" : "Set a new password"}</h1>
          <p className="rp-sub">
            {linkExpired
              ? "This password reset link is invalid or has expired. Request a new one to continue."
              : ready
                ? "Enter and confirm your new password below."
                : "Verifying your reset link…"}
          </p>
          {linkExpired && (
            <button className="rp-btn" onClick={() => navigate("/auth")}>Back to sign in</button>
          )}
          {ready && !linkExpired && (
            <form onSubmit={handleSubmit}>
              <div className="rp-label">New password</div>
              <input className="rp-input" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
              <div className="rp-label">Confirm password</div>
              <input className="rp-input" type="password" required minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat it" />
              {error && <div className="rp-err">{error}</div>}
              <button className="rp-btn" type="submit" disabled={loading}>{loading ? "Saving…" : "Update password"}</button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
