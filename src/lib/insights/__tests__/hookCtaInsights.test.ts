import { describe, expect, it, vi, beforeEach } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { fetchHookCtaInsights, emptyHookCtaInsights } from "../hookCtaInsights";

describe("hookCtaInsights", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("maps a successful RPC response to the typed shape", async () => {
    rpcMock.mockResolvedValue({
      data: {
        hookRegenerateClicked: 4,
        ctaRegenerateClicked: 2,
        ctaSuggestionApplied: 1,
        postKept: 5,
        postRegeneratedAgain: 3,
        byPlatform: { LinkedIn: 4, "X": 2 },
      },
      error: null,
    });

    const result = await fetchHookCtaInsights(30);

    expect(rpcMock).toHaveBeenCalledWith("user_hook_cta_insights", { days_back: 30 });
    expect(result).toEqual({
      hookRegenerateCount: 4,
      ctaRegenerateCount: 2,
      ctaSuggestionAppliedCount: 1,
      postsKept: 5,
      postsRegeneratedAgain: 3,
      byPlatform: { LinkedIn: 4, X: 2 },
    });
  });

  it("returns the zeroed fallback shape on RPC error without throwing", async () => {
    rpcMock.mockResolvedValue({ data: null, error: new Error("Not authorized") });

    await expect(fetchHookCtaInsights()).resolves.toEqual(emptyHookCtaInsights());
  });

  it("returns the zeroed fallback shape when the RPC call throws", async () => {
    rpcMock.mockRejectedValue(new Error("network down"));

    await expect(fetchHookCtaInsights()).resolves.toEqual(emptyHookCtaInsights());
  });

  it("defaults missing fields on a partial RPC response", async () => {
    rpcMock.mockResolvedValue({ data: {}, error: null });

    const result = await fetchHookCtaInsights();

    expect(result).toEqual(emptyHookCtaInsights());
  });
});
