import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark } from "@/components/brand/Logo";
import { APP_NAME } from "@/constants/branding";

// Supabase's OAuth 2.1 namespace is beta; type it locally so TS is happy.
type AuthorizationDetails = {
  client?: { name?: string; logo_uri?: string; client_uri?: string };
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthNs = {
  getAuthorizationDetails: (
    id: string
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const oauth = (supabase.auth as unknown as { oauth: OAuthNs }).oauth;
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const oauth = (supabase.auth as unknown as { oauth: OAuthNs }).oauth;
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  return (
    <>
      <Helmet>
        <title>Authorize app — {APP_NAME}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "hsl(var(--background))",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 460,
            padding: 32,
            borderRadius: 16,
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            boxShadow: "0 12px 40px hsl(var(--foreground) / 0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <LogoMark />
            <span style={{ fontWeight: 600, color: "hsl(var(--foreground))" }}>{APP_NAME}</span>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: 12,
                borderRadius: 10,
                background: "hsl(var(--destructive) / 0.08)",
                color: "hsl(var(--destructive))",
                marginBottom: 16,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          {!details && !error && (
            <p style={{ color: "hsl(var(--muted-foreground))" }}>Loading authorization request…</p>
          )}

          {details && (
            <>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  margin: "0 0 8px",
                  color: "hsl(var(--foreground))",
                }}
              >
                Connect {details.client?.name ?? "an app"} to your account
              </h1>
              <p
                style={{
                  color: "hsl(var(--muted-foreground))",
                  fontSize: 14,
                  lineHeight: 1.6,
                  marginBottom: 20,
                }}
              >
                {details.client?.name ?? "This client"} is requesting access to use ContentForge as
                you. It will be able to read your saved calendars and scheduled posts.
              </p>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => decide(false)}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid hsl(var(--border))",
                    background: "transparent",
                    color: "hsl(var(--foreground))",
                    cursor: busy ? "not-allowed" : "pointer",
                    fontWeight: 500,
                  }}
                >
                  Deny
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => decide(true)}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                    cursor: busy ? "not-allowed" : "pointer",
                    fontWeight: 600,
                  }}
                >
                  {busy ? "Working…" : "Approve"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
