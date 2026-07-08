import { supabase } from "@/integrations/supabase/client";

type TelemetryEvent = {
  name: string;
  props?: Record<string, unknown>;
  timestamp?: number;
};

function getTelemetryEndpoint(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl) return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/telemetry`;
  return "/api/telemetry";
}

/**
 * Builds the request headers for the telemetry endpoint. The `apikey` header is
 * always the anon/publishable key (required by PostgREST/Edge Functions gateway),
 * but the `Authorization` bearer should be the *user's* access token when a
 * session exists so the server can attribute events via getVerifiedUserId().
 * Falls back to the anon key for anonymous/pre-login events. Never throws —
 * telemetry must remain fire-and-forget.
 */
async function getTelemetryHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (key) {
    headers.apikey = key;
    headers.Authorization = `Bearer ${key}`;
  }
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch {
    // Ignore — fall back to the anon key already set above.
  }
  return headers;
}

function shouldSendTelemetry(): boolean {
  if (import.meta.env.MODE === "test") return true;
  if (typeof window !== "undefined" && window.location.hostname === "localhost") return false;
  return true;
}

export async function sendEvent(name: string, props: Record<string, unknown> = {}) {
  const ev: TelemetryEvent = { name, props, timestamp: Date.now() };
  try {
    if (!shouldSendTelemetry()) return;
    // Best-effort: fire-and-forget
    const headers = await getTelemetryHeaders();
    void fetch(getTelemetryEndpoint(), {
      method: "POST",
      headers,
      body: JSON.stringify(ev),
    }).catch(() => {
      // Ignore telemetry transport failures.
    });
  } catch (e) {
    // ignore
    console.warn("telemetry send failed", e);
  }
  // also log locally for dev
  console.debug("telemetry:", ev);
}

export default { sendEvent };
