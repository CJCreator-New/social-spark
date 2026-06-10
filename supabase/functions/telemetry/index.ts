declare const Deno: any;

// Telemetry receiver function for fire-and-forget client events.
// Expects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars and a table `telemetry_events`.

// Restrict CORS to the app's known domains (telemetry is a write/POST endpoint and
// should not accept cross-origin requests from arbitrary sites).
const ALLOWED_ORIGINS = new Set([
  "https://contentforged.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
]);

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin, "Vary": "Origin" } : {}),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

export async function handle(req: Request): Promise<Response> {
  const cors = corsHeadersFor(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    if (req.method !== "POST") return new Response(null, { status: 405, headers: cors });
    const payload = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn("Missing supabase env for telemetry");
      return new Response(JSON.stringify({ ok: false, error: "server not configured" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const row = { event_name: payload.name || payload.event || "unknown", props: payload.props || {}, ts: new Date().toISOString() };
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
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
}

if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve(handle);
}
