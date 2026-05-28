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

function getTelemetryHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (key) {
    headers.apikey = key;
    headers.Authorization = `Bearer ${key}`;
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
    void fetch(getTelemetryEndpoint(), {
      method: "POST",
      headers: getTelemetryHeaders(),
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
