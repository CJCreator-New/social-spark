import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendEvent } from "@/lib/telemetry";

describe("telemetry", () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });

  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "anon-key");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts events to the Supabase telemetry function path", async () => {
    await sendEvent("generate_start", { mode: "week" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string>; body: string }];
    expect(url).toBe("https://example.supabase.co/functions/v1/telemetry");
    expect(init.method).toBe("POST");
    expect(init.headers.apikey).toBe("anon-key");
    expect(JSON.parse(init.body)).toMatchObject({ name: "generate_start", props: { mode: "week" } });
  });
});
