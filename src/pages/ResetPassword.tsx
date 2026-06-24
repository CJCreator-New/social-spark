import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "@/styles/pages.css";

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

    // Timeout: if neither event nor session resolves the link in 20s, treat as invalid/expired.
    const timer = setTimeout(() => {
      if (!resolved) setLinkExpired(true);
    }, 20000);

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
      <Helmet>
        <title>Reset your password — ContentForge</title>
        <meta name="description" content="Set a new password for your ContentForge account to recover your workspace access." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
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
              <label className="rp-label" htmlFor="rp-password">New password</label>
              <input id="rp-password" className="rp-input" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
              <label className="rp-label" htmlFor="rp-confirm">Confirm password</label>
              <input id="rp-confirm" className="rp-input" type="password" required minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat it" />
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
