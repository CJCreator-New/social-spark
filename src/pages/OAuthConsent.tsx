import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark } from "@/components/brand/Logo";
import { APP_NAME } from "@/constants/branding";
import "@/styles/pages.css";

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

// F-014: the authorization server is trusted to return a same-registered-client
// redirect, but this is a defensive backstop in case a bug or compromised
// config ever returns something other than a normal http(s) URL — refuse to
// navigate to javascript:/data:/malformed targets.
function isSafeRedirectTarget(target: unknown): target is string {
  if (typeof target !== "string" || !target) return false;
  try {
    const url = new URL(target, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

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
        if (!isSafeRedirectTarget(immediate)) {
          return setError("Invalid redirect target returned by the authorization server.");
        }
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
    if (!isSafeRedirectTarget(target)) {
      setBusy(false);
      return setError("No valid redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  return (
    <>
      <Helmet>
        <title>Authorize app — {APP_NAME}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="oauth-consent-page">
        <div className="oauth-consent-card">
          <div className="oauth-consent-brand">
            <LogoMark />
            <span className="oauth-consent-brand-name">{APP_NAME}</span>
          </div>

          {error && (
            <div role="alert" className="oauth-consent-error">
              {error}
            </div>
          )}

          {!details && !error && (
            <p className="oauth-consent-loading" aria-busy="true">
              Loading authorization request…
            </p>
          )}

          {details && (
            <>
              <h1 className="oauth-consent-title">
                Connect {details.client?.name ?? "an app"} to your account
              </h1>
              <p className="oauth-consent-desc">
                {details.client?.name ?? "This client"} is requesting access to use ContentForge as
                you. It will be able to:
              </p>
              <ul className="oauth-consent-scopes">
                {details.scopes && details.scopes.length > 0 ? (
                  details.scopes.map((scope) => <li key={scope}>{scope}</li>)
                ) : (
                  <li>This app is requesting access to your account.</li>
                )}
              </ul>

              <div className="oauth-consent-actions">
                <button
                  type="button"
                  disabled={busy}
                  aria-busy={busy}
                  onClick={() => decide(false)}
                  className="oauth-consent-btn oauth-consent-btn-deny"
                >
                  Deny
                </button>
                <button
                  type="button"
                  disabled={busy}
                  aria-busy={busy}
                  onClick={() => decide(true)}
                  className="oauth-consent-btn oauth-consent-btn-approve"
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
