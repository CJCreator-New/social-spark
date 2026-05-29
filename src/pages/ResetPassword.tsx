import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const css = `
.rp-app { min-height:100vh; background:
  radial-gradient(circle at 16% 18%, rgba(216,255,121,0.10), transparent 24%),
  radial-gradient(circle at 82% 10%, rgba(130,233,198,0.08), transparent 24%),
  linear-gradient(180deg, #05060a 0%, #0a0d14 100%);
  color:#f2efe7; font-family:var(--font-body); display:flex; align-items:center; justify-content:center; padding:24px; position:relative; overflow:hidden; }
.rp-app::before { content:''; position:absolute; inset:auto -8% -20% auto; width:520px; height:520px; border-radius:50%; background:radial-gradient(circle,rgba(216,255,121,0.08) 0%,transparent 68%); filter:blur(16px); pointer-events:none; }
.rp-card { width:100%; max-width:460px; background:rgba(13,16,25,0.78); border:1px solid rgba(255,255,255,0.08); border-radius:28px; padding:34px 30px; position:relative; z-index:1; box-shadow:0 30px 90px rgba(0,0,0,0.35); }
.rp-eyebrow { font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:#d8ff79; font-weight:800; margin-bottom:10px; display:flex; align-items:center; gap:8px; }
.rp-eyebrow::before { content:''; display:block; width:22px; height:1px; background:#d8ff79; }
.rp-title { font-family:var(--font-display); font-size:clamp(2rem, 4vw, 2.7rem); font-weight:500; margin:0 0 10px; letter-spacing:-.04em; line-height:1.02; }
.rp-sub { font-size:14px; color:#a2a6b6; font-weight:400; margin-bottom:22px; line-height:1.7; }
.rp-state { display:grid; gap:10px; margin-bottom:18px; }
.rp-state-box { padding:12px 14px; border-radius:16px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); }
.rp-state-box strong { display:block; font-size:12px; margin-bottom:4px; color:#f2efe7; }
.rp-state-box span { font-size:12px; color:#a2a6b6; line-height:1.5; }
.rp-label { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#7c8294; margin-bottom:7px; font-weight:800; }
.rp-input { width:100%; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:14px; padding:12px 13px; font-size:13px; color:#f2efe7; font-family:var(--font-body); font-weight:500; outline:none; box-sizing:border-box; margin-bottom:13px; }
.rp-input:focus { border-color:rgba(216,255,121,0.32); box-shadow:0 0 0 3px rgba(216,255,121,0.08); }
.rp-btn { width:100%; padding:12px 14px; border-radius:14px; font-size:13px; font-weight:800; cursor:pointer; border:none; background:linear-gradient(135deg, #d8ff79, #f0ffbf); color:#08100c; margin-top:8px; transition:transform .15s, box-shadow .15s; }
.rp-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 16px 40px rgba(216,255,121,0.12); }
.rp-btn:disabled { opacity:.55; cursor:not-allowed; transform:none; box-shadow:none; }
.rp-err { background:rgba(240,154,154,0.08); border:1px solid rgba(240,154,154,0.22); border-radius:12px; padding:10px 13px; font-size:12px; color:#f09a9a; margin-top:10px; line-height:1.5; }
.rp-link-row { display:flex; gap:10px; margin-top:14px; }
.rp-link { flex:1; display:inline-flex; align-items:center; justify-content:center; padding:11px 14px; border-radius:14px; border:1px solid rgba(255,255,255,0.10); color:#f2efe7; text-decoration:none; font-size:12px; font-weight:700; background:rgba(255,255,255,0.02); }
.rp-link:hover { border-color:rgba(216,255,121,0.28); background:rgba(216,255,121,0.05); }

@media (max-width: 540px) {
  .rp-app { padding:16px; }
  .rp-card { padding:24px 20px; border-radius:22px; }
  .rp-link-row { flex-direction:column; }
}
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
          <div className="rp-state">
            <div className="rp-state-box">
              <strong>{ready ? "Recovery link verified" : linkExpired ? "Recovery link unavailable" : "Checking link"}</strong>
              <span>{ready ? "You're authenticated for recovery. Set a new password and continue into the app." : linkExpired ? "Request a fresh reset email from sign in." : "Please wait while we confirm the recovery session."}</span>
            </div>
          </div>
          {linkExpired && (
            <div className="rp-link-row">
              <button className="rp-btn" onClick={() => navigate("/auth")}>Back to sign in</button>
            </div>
          )}
          {ready && !linkExpired && (
            <form onSubmit={handleSubmit}>
              <div className="rp-label">New password</div>
              <input className="rp-input" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
              <div className="rp-label">Confirm password</div>
              <input className="rp-input" type="password" required minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat it" />
              {error && <div className="rp-err">{error}</div>}
              <button className="rp-btn" type="submit" disabled={loading}>{loading ? "Saving…" : "Update password"}</button>
              <div className="rp-link-row">
                <button type="button" className="rp-link" onClick={() => navigate("/auth")}>Back to sign in</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
