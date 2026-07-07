declare const Deno: any;
import { checkRateLimit } from "../_shared/promptHelpers.ts";

// Telemetry receiver function for fire-and-forget client events.
// Expects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars and a table `telemetry_events`.

// verify_jwt is disabled for this function (anonymous, pre-login events must be
// accepted), so it is its own only gate. Keep the accepted surface tiny: a fixed
// allow-list of event names, a hard size cap on props, and per-IP rate limiting.
const ALLOWED_EVENT_NAMES = new Set([
  "admin_dashboard_loaded",
  "admin_dashboard_refresh_clicked",
  "generate_start",
  "generate_fallback",
  "generate_infer_topics",
  "generate_success",
  "generate_error",
  "enhance_clicked",
]);
const MAX_PROPS_BYTES = 2000;
const MAX_BODY_BYTES = 8000;

// Restrict CORS to the app's known domains (telemetry is a write/POST endpoint and
// should not accept cross-origin requests from arbitrary sites).
const ALLOWED_ORIGINS = new Set([
  "https://contentforged.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
]);

// Also allow any *.lovable.app and *.lovableproject.com subdomain (preview URLs).
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
];

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = isAllowedOrigin(origin) ? origin : "";
  return {
    ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, Vary: "Origin" } : {}),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export async function handle(req: Request): Promise<Response> {
  const cors = corsHeadersFor(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    if (req.method !== "POST") return new Response(null, { status: 405, headers: cors });

    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ ok: false, error: "payload too large" }), {
        status: 413,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    let payload: { name?: string; event?: string; props?: unknown };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "invalid json" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const eventName = String(payload.name || payload.event || "unknown");
    if (!ALLOWED_EVENT_NAMES.has(eventName)) {
      // F-019: a typo'd event name should be visible to the developer who
      // introduced it. In deployed environments, keep swallowing unknown
      // events with a low-noise 202 so a fire-and-forget caller never errors.
      const isDeployed = typeof Deno !== "undefined" && !!Deno.env.get("DENO_DEPLOYMENT_ID");
      if (!isDeployed) {
        return new Response(JSON.stringify({ ok: false, error: `unknown event: ${eventName}` }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 202,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const props = payload.props && typeof payload.props === "object" ? payload.props : {};
    if (JSON.stringify(props).length > MAX_PROPS_BYTES) {
      return new Response(JSON.stringify({ ok: false, error: "props too large" }), {
        status: 413,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Per-IP rate limit: anonymous/pre-login events have no user id to key on.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const rateLimitCheck = await checkRateLimit(ip, "telemetry", {
      maxRequests: 30,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return new Response(JSON.stringify({ ok: false, error: "rate limited" }), {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn("Missing supabase env for telemetry");
      return new Response(JSON.stringify({ ok: false, error: "server not configured" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const row = { event_name: eventName, props, ts: new Date().toISOString() };
    // Insert via REST
    const res = await fetch(`${SUPABASE_URL}/rest/v1/telemetry_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });
    if (!res.ok) {
      console.warn("Telemetry insert failed", await res.text());
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Telemetry handler error", e);
    return new Response(JSON.stringify({ ok: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}

if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve(handle);
}
