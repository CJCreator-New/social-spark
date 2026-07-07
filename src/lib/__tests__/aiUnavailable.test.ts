import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveAiClient } from "../aiClientResolver";

describe("aiClientResolver — AI unavailable", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws AI_UNAVAILABLE when platform is unavailable and no user key exists", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    await expect(resolveAiClient(false)).rejects.toThrow("AI_UNAVAILABLE");
  });
});
