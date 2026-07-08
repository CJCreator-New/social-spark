import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { ToolContext } from "@lovable.dev/mcp-js";
import repurposePostTool from "../repurpose-post";

function authedCtx(scopes: string[] = ["generate:repurpose"]) {
  return new ToolContext({
    bearer: { token: "verified-jwt" },
    principal: { sub: "user-1", scopes, issuer: "https://project.supabase.co/auth/v1", claims: {} },
  } as any);
}

function unauthedCtx() {
  return new ToolContext(undefined as any);
}

const SOURCE_POST = { title: "Src", hook: "A hook", body: "A body", cta: "Do it", hashtags: "#x" };

describe("repurpose_post MCP tool", () => {
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

  it("rejects malformed input (missing targetPlatform) via the zod schema before any network call", () => {
    const schema = z.object(repurposePostTool.inputSchema as any);
    const result = schema.safeParse({ post: SOURCE_POST });
    expect(result.success).toBe(false);
  });

  it("rejects a post with no title/hook/body at the handler level", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;

    const res = await repurposePostTool.handler(
      { post: { hashtags: "#x" }, targetPlatform: "X" } as any,
      authedCtx()
    );

    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toMatch(/malformed input/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated calls without touching the network", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;

    const res = await repurposePostTool.handler(
      { post: SOURCE_POST, targetPlatform: "X" } as any,
      unauthedCtx()
    );

    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toMatch(/not authenticated/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects calls missing the generate:repurpose scope", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as any;

    const res = await repurposePostTool.handler(
      { post: SOURCE_POST, targetPlatform: "X" } as any,
      authedCtx([])
    );

    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toMatch(/missing generate:repurpose scope/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("forwards the caller's bearer token and returns the repurposed post on success", async () => {
    const repurposed = { title: "New title", body: "New body for X", cta: "Do it" };
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => ({
      status: 200,
      json: async () => ({ post: repurposed }),
    }));
    global.fetch = fetchSpy as any;

    const res = await repurposePostTool.handler(
      { post: SOURCE_POST, targetPlatform: "X", platform: "LinkedIn" } as any,
      authedCtx()
    );

    expect(res.isError).toBeUndefined();
    expect(res.structuredContent).toEqual({ post: repurposed });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://dummy.supabase.co/functions/v1/repurpose-post");
    expect((init as any)?.headers.Authorization).toBe("Bearer verified-jwt");
    expect(JSON.parse((init as any).body)).toEqual({
      post: SOURCE_POST,
      targetPlatform: "X",
      platform: "LinkedIn",
    });
  });

  it("surfaces an edge-function error response as a clear tool error, not a crash", async () => {
    global.fetch = vi.fn(async () => ({
      status: 429,
      json: async () => ({ error: "Rate limit exceeded." }),
    })) as any;

    const res = await repurposePostTool.handler(
      { post: SOURCE_POST, targetPlatform: "X" } as any,
      authedCtx()
    );

    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toMatch(/rate limit exceeded/i);
  });

  it("catches a thrown/network fetch failure gracefully instead of throwing", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as any;

    const res = await repurposePostTool.handler(
      { post: SOURCE_POST, targetPlatform: "X" } as any,
      authedCtx()
    );

    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toMatch(/network down/i);
  });
});
