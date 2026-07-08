// F-002 regression: quota gating on generate-post-image.
// Covers quota-exceeded (402, no provider call, no increment) and successful
// shared-key usage (increments once). generate-post-image has no BYOK
// userApiKey concept (image gen is platform-key-only), so usingSharedKey is
// driven entirely by quota.useOwnKey/keyMode — covered by the "always" case.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCheckQuota = vi.fn();
const mockIncrement = vi.fn(async () => {});

vi.mock("../_shared/promptHelpers.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_shared/promptHelpers.ts")>();
  return {
    ...actual,
    getVerifiedUserId: vi.fn(async () => "a0000000-0000-0000-0000-000000000001"),
    checkRateLimit: vi.fn(async () => ({ allowed: true })),
    getCorsHeaders: vi.fn(() => ({})),
    checkQuota: mockCheckQuota,
    incrementGenerationCount: mockIncrement,
  };
});

const ENV: Record<string, string> = {
  SUPABASE_URL: "https://dummy.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "dummy-service-key",
  LOVABLE_API_KEY: "dummy-lovable-key",
};
vi.stubGlobal("Deno", { env: { get: (key: string) => ENV[key] } });

const { handleGeneratePostImage } = await import("./index.ts");

const FREE_QUOTA_OK = {
  allowed: true,
  used: 3,
  limit: 50,
  useOwnKey: false,
  keyMode: "fallback",
  tier: "free" as const,
};

const FREE_QUOTA_EXCEEDED = { ...FREE_QUOTA_OK, allowed: false, used: 50 };

const BYOK_ALWAYS = { ...FREE_QUOTA_OK, useOwnKey: true, keyMode: "always" };

const CALENDAR_ID = "11111111-1111-4111-8111-111111111111";
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function mockFetchRoutes(opts: { ownsCalendar: boolean; providerOk: boolean }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const href = String(url);

      if (href.includes("/rest/v1/saved_calendars")) {
        return {
          ok: true,
          status: 200,
          json: async () => (opts.ownsCalendar ? [{ id: CALENDAR_ID }] : []),
          text: async () => "[]",
        } as Response;
      }

      if (href.includes("ai.gateway.lovable.dev/v1/images/generations")) {
        if (!opts.providerOk) {
          return { ok: false, status: 500, text: async () => "provider error" } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ b64_json: TINY_PNG_B64 }] }),
          text: async () => "",
        } as Response;
      }

      if (href.includes("/rest/v1/media_references") && init?.method === "PATCH") {
        return { ok: true, status: 200, text: async () => "" } as Response;
      }

      if (href.includes("/storage/v1/object/")) {
        return { ok: true, status: 200, text: async () => "" } as Response;
      }

      if (href.includes("/rest/v1/media_references")) {
        return { ok: true, status: 201, text: async () => "" } as Response;
      }

      throw new Error(`Unhandled fetch in test: ${href}`);
    })
  );
}

function buildRequest(extra: Record<string, unknown> = {}): Request {
  return new Request("https://dummy.supabase.co/functions/v1/generate-post-image", {
    method: "POST",
    headers: { Authorization: "Bearer dummy-jwt", "Content-Type": "application/json" },
    body: JSON.stringify({
      calendarId: CALENDAR_ID,
      postDay: 1,
      prompt: "A clean editorial illustration.",
      platform: "LinkedIn",
      aspectRatio: "1:1",
      ...extra,
    }),
  });
}

describe("generate-post-image quota gating (F-002)", () => {
  beforeEach(() => {
    mockCheckQuota.mockReset();
    mockIncrement.mockClear();
  });

  it("returns 402 QUOTA_EXCEEDED before any provider call when shared-key quota is exhausted", async () => {
    mockCheckQuota.mockResolvedValue(FREE_QUOTA_EXCEEDED);
    mockFetchRoutes({ ownsCalendar: true, providerOk: true });

    const res = await handleGeneratePostImage(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.error).toBe("QUOTA_EXCEEDED");
    expect(body.quota).toEqual({ used: 50, limit: 50 });
    expect(mockIncrement).not.toHaveBeenCalled();
    // Only the ownership-check fetch should have fired — no image provider call.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("increments the generation count exactly once after a successful shared-key image generation", async () => {
    mockCheckQuota.mockResolvedValue(FREE_QUOTA_OK);
    mockFetchRoutes({ ownsCalendar: true, providerOk: true });

    const res = await handleGeneratePostImage(buildRequest());

    expect(res.status).toBe(200);
    expect(mockIncrement).toHaveBeenCalledTimes(1);
    expect(mockIncrement).toHaveBeenCalledWith("a0000000-0000-0000-0000-000000000001");
  });

  it("BYOK always-mode bypasses the quota gate and never increments platform usage", async () => {
    mockCheckQuota.mockResolvedValue(BYOK_ALWAYS);
    mockFetchRoutes({ ownsCalendar: true, providerOk: true });

    const res = await handleGeneratePostImage(buildRequest());

    expect(res.status).toBe(200);
    expect(mockIncrement).not.toHaveBeenCalled();
  });

  it("does not increment when every image provider fails", async () => {
    mockCheckQuota.mockResolvedValue(FREE_QUOTA_OK);
    mockFetchRoutes({ ownsCalendar: true, providerOk: false });

    const res = await handleGeneratePostImage(buildRequest());

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(mockIncrement).not.toHaveBeenCalled();
  });
});
