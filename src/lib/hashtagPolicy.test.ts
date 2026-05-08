import { describe, expect, it } from "vitest";
import { normalizeTag, parsePolicyList } from "./hashtagPolicy";

describe("hashtagPolicy helpers", () => {
  it("normalizes tags into lowercase tokens without hashes", () => {
    expect(normalizeTag("  ##AI-India!  ")).toBe("aiindia");
  });

  it("deduplicates parsed tag lists", () => {
    expect(parsePolicyList("#AI, ai  #Health")).toEqual(["ai", "health"]);
  });
});