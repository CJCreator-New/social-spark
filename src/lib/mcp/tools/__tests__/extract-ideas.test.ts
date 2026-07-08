import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { ToolContext } from "@lovable.dev/mcp-js";
import extractIdeasTool from "../extract-ideas";

const LONG_SOURCE = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6); // > 200 chars

function authedCtx(scopes: string[] = ["generate:ideas"]) {
  return new ToolContext({
    bearer: { token: "verified-jwt" },
    principal: { sub: "user-1", scopes, issuer: "https://project.supabase.co/auth/v1", claims: {} },
  } as any);
}

function unauthedCtx() {
  return new ToolContext(undefined as any);
}

describe("extract_ideas MCP tool", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SUPABASE_URL = "https://dummy.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "dummy-anon-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("rejects malformed input (source too short) via the zod schema before any network call", () => {
    const schema = z.object(extractIdeasTool.inputSchema as any);
    const result = schema.safeParse({ source: "too short" });
    expect(result.success).toBe(false);
  });

  it("rejects unauthenticated calls without touching the network", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;

    const res = await extractIdeasTool.handler(
      { source: LONG_SOURCE, count: 5 } as any,
      unauthedCtx()
    );

    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toMatch(/not authenticated/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects calls missing the generate:ideas scope", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;

    const res = await extractIdeasTool.handler(
      { source: LONG_SOURCE, count: 5 } as any,
      authedCtx([])
    );

    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toMatch(/missing generate:ideas scope/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("forwards the caller's bearer token and returns the extracted ideas on success", async () => {
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => ({
      status: 200,
      json: async () => ({ ideas: [{ title: "Idea 1", format: "Listicle" }], requested: 5 }),
    }));
    global.fetch = fetchSpy as any;

    const res = await extractIdeasTool.handler(
      { source: LONG_SOURCE, count: 5, platform: "LinkedIn" } as any,
      authedCtx()
    );

    expect(res.isError).toBeUndefined();
    expect(res.structuredContent).toEqual({
      ideas: [{ title: "Idea 1", format: "Listicle" }],
      requested: 5,
      partial: false,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://dummy.supabase.co/functions/v1/extract-ideas");
    expect((init as any)?.headers.Authorization).toBe("Bearer verified-jwt");
  });

  it("surfaces an edge-function error response as a clear tool error, not a crash", async () => {
    global.fetch = vi.fn(async () => ({
      status: 402,
      json: async () => ({ error: "QUOTA_EXCEEDED", message: "Monthly generation limit reached." }),
    })) as any;

    const res = await extractIdeasTool.handler(
      { source: LONG_SOURCE, count: 5 } as any,
      authedCtx()
    );

    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toMatch(/monthly generation limit reached/i);
  });

  it("catches a thrown/network fetch failure gracefully instead of throwing", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as any;

    const res = await extractIdeasTool.handler(
      { source: LONG_SOURCE, count: 5 } as any,
      authedCtx()
    );

    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toMatch(/network down/i);
  });
});
