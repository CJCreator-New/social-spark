// Telemetry receiver function for fire-and-forget client events.
// Expects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars and a table `telemetry_events`.

export async function handle(req: Request) {
  try {
    if (req.method !== "POST") return new Response(null, { status: 405 });
    const payload = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.warn("Missing supabase env for telemetry");
      return new Response(JSON.stringify({ ok: false, error: "server not configured" }), { status: 500 });
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
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error("Telemetry handler error", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
