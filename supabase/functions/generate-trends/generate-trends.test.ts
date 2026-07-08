// F-002 regression: quota gating on generate-trends.
// Covers quota-exceeded (402, no provider call, no increment), successful
// shared-key usage (increments once), and BYOK "always" mode (no increment).
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCheckQuota = vi.fn();
const mockIncrement = vi.fn(async () => {});
const mockCallAIGateway = vi.fn();

vi.mock("../_shared/promptHelpers.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_shared/promptHelpers.ts")>();
  return {
    ...actual,
    getVerifiedUserId: vi.fn(async () => "a0000000-0000-0000-0000-000000000001"),
    checkRateLimit: vi.fn(async () => ({ allowed: true })),
    getCorsHeaders: vi.fn(() => ({})),
    checkQuota: mockCheckQuota,
    incrementGenerationCount: mockIncrement,
    callAIGateway: mockCallAIGateway,
  };
});

const ENV: Record<string, string> = {
  LOVABLE_API_KEY: "dummy-lovable-key",
};
vi.stubGlobal("Deno", { env: { get: (key: string) => ENV[key] } });

const { handleGenerateTrends } = await import("./index.ts");

const FREE_QUOTA_OK = {
  allowed: true,
  used: 3,
  limit: 50,
  useOwnKey: false,
  keyMode: "fallback",
  tier: "free" as const,
};

const FREE_QUOTA_EXCEEDED = { ...FREE_QUOTA_OK, allowed: false, used: 50 };

const BYOK_ALWAYS_EXCEEDED = {
  ...FREE_QUOTA_EXCEEDED,
  useOwnKey: true,
  keyMode: "always",
};

function aiSuccess(toolName: string, args: Record<string, unknown>) {
  return {
    status: 200,
    data: {
      choices: [
        {
          message: {
            tool_calls: [{ function: { name: toolName, arguments: JSON.stringify(args) } }],
          },
        },
      ],
    },
  };
}

const TRENDS_ARGS = {
  trends: [{ topic: "AI Agents", category: "Artificial Intelligence", trending: true, posts: 1200 }],
};

function buildRequest(extra: Record<string, unknown> = {}): Request {
  return new Request("https://dummy.supabase.co/functions/v1/generate-trends", {
    method: "POST",
    headers: { Authorization: "Bearer dummy-jwt", "Content-Type": "application/json" },
    body: JSON.stringify({ industry: "SaaS", platform: "LinkedIn", ...extra }),
  });
}

describe("generate-trends quota gating (F-002)", () => {
  beforeEach(() => {
    mockCheckQuota.mockReset();
    mockIncrement.mockClear();
    mockCallAIGateway.mockReset();
    mockCallAIGateway.mockResolvedValue(aiSuccess("return_trends", TRENDS_ARGS));
  });

  it("returns 402 QUOTA_EXCEEDED before any provider call when shared-key quota is exhausted", async () => {
    mockCheckQuota.mockResolvedValue(FREE_QUOTA_EXCEEDED);

    const res = await handleGenerateTrends(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.error).toBe("QUOTA_EXCEEDED");
    expect(body.quota).toEqual({ used: 50, limit: 50 });
    expect(mockCallAIGateway).not.toHaveBeenCalled();
    expect(mockIncrement).not.toHaveBeenCalled();
  });

  it("increments the generation count exactly once after a successful shared-key generation", async () => {
    mockCheckQuota.mockResolvedValue(FREE_QUOTA_OK);

    const res = await handleGenerateTrends(buildRequest());

    expect(res.status).toBe(200);
    expect(mockCallAIGateway).toHaveBeenCalledTimes(1);
    expect(mockIncrement).toHaveBeenCalledTimes(1);
    expect(mockIncrement).toHaveBeenCalledWith("a0000000-0000-0000-0000-000000000001");
  });

  it("BYOK always-mode bypasses the quota gate and never increments platform usage", async () => {
    mockCheckQuota.mockResolvedValue(BYOK_ALWAYS_EXCEEDED);

    const res = await handleGenerateTrends(buildRequest());

    expect(res.status).toBe(200);
    expect(mockCallAIGateway).toHaveBeenCalledTimes(1);
    expect(mockIncrement).not.toHaveBeenCalled();
  });

  it("does not increment when the provider call fails", async () => {
    mockCheckQuota.mockResolvedValue(FREE_QUOTA_OK);
    mockCallAIGateway.mockResolvedValue({ status: 500, error: "upstream error" });

    const res = await handleGenerateTrends(buildRequest());

    expect(res.status).toBe(500);
    expect(mockIncrement).not.toHaveBeenCalled();
  });
});
