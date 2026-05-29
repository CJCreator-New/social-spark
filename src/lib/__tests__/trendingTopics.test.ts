import { describe, expect, it } from "vitest";
import { getTrendingTopicsForIndustry, getTrendingTopicsCount } from "@/lib/trendingTopics";

describe("trendingTopics", () => {
  it("ranks platform-fit topics higher for LinkedIn", () => {
    const topics = getTrendingTopicsForIndustry("marketing", "LinkedIn");

    expect(topics[0]?.topic).toBe("Brand authenticity");
    expect(topics[0]?.trending).toBe(true);
  });

  it("normalizes platform aliases before ranking", () => {
    const aliasTopics = getTrendingTopicsForIndustry("tech", "twitter");
    const canonicalTopics = getTrendingTopicsForIndustry("tech", "Twitter/X");

    expect(aliasTopics[0]?.topic).toBe(canonicalTopics[0]?.topic);
  });

  it("keeps trending counts stable when platform filtering is applied", () => {
    const { trending, total } = getTrendingTopicsCount("creator", "Instagram");

    expect(total).toBeGreaterThan(0);
    expect(trending).toBeLessThanOrEqual(total);
  });
});