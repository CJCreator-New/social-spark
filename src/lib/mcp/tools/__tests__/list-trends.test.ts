import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolContext } from "@lovable.dev/mcp-js";

// Chainable Supabase query-builder mock: every method returns `this`, and the
// builder resolves like the real supabase-js query builder does (it's
// thenable) once awaited.
function makeQueryBuilder(result: { data: unknown; error: { message: string } | null }) {
  const builder: any = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
  return builder;
}

let currentResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };
const fromSpy = vi.fn(() => makeQueryBuilder(currentResult));
const createClientMock = vi.fn((..._args: unknown[]) => ({ from: fromSpy }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const { default: listTrendsTool } = await import("../list-trends");

function authedCtx(scopes: string[] = ["read:trends"]) {
  return new ToolContext({
    bearer: { token: "verified-jwt" },
    principal: { sub: "user-1", scopes, issuer: "https://project.supabase.co/auth/v1", claims: {} },
  } as any);
}

function unauthedCtx() {
  return new ToolContext(undefined as any);
}

describe("list_trends MCP tool", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.SUPABASE_URL = "https://dummy.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "dummy-anon-key";
    fromSpy.mockClear();
    createClientMock.mockClear();
    currentResult = { data: [], error: null };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("rejects unauthenticated calls without querying Supabase", async () => {
    const res = await listTrendsTool.handler({} as any, unauthedCtx());

    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toMatch(/not authenticated/i);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("rejects calls missing the read:trends scope", async () => {
    const res = await listTrendsTool.handler({} as any, authedCtx([]));

    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toMatch(/missing read:trends scope/i);
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("returns trend rows scoped through the caller's bearer token on success", async () => {
    currentResult = {
      data: [{ keyword: "AI agents", category: "Tech", volume: 1200, source: "google", last_seen: "2026-07-08" }],
      error: null,
    };

    const res = await listTrendsTool.handler({ category: "Tech", limit: 10 } as any, authedCtx());

    expect(res.isError).toBeUndefined();
    expect(res.structuredContent).toEqual({ trends: currentResult.data });
    expect(createClientMock).toHaveBeenCalledWith(
      "https://dummy.supabase.co",
      "dummy-anon-key",
      expect.objectContaining({
        global: { headers: { Authorization: "Bearer verified-jwt" } },
      })
    );
  });

  it("surfaces a Supabase query error as a clear tool error, not a crash", async () => {
    currentResult = { data: null, error: { message: "relation trends does not exist" } };

    const res = await listTrendsTool.handler({} as any, authedCtx());

    expect(res.isError).toBe(true);
    expect((res.content as any)[0].text).toMatch(/relation trends does not exist/i);
  });
});
