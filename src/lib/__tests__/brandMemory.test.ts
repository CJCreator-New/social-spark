import { describe, it, expect } from "vitest";
import { hasBrandMemory, buildBrandMemoryPrompt } from "../brandMemory";

describe("brandMemory library helpers", () => {
  it("should detect if a user has configured brand memory", () => {
    expect(hasBrandMemory(null)).toBe(false);
    expect(hasBrandMemory({})).toBe(false);
    expect(hasBrandMemory({ forbidden_phrases: [] })).toBe(false);
    
    expect(hasBrandMemory({ forbidden_phrases: ["delight"] })).toBe(true);
    expect(hasBrandMemory({ proof_points: ["10k users"] })).toBe(true);
  });

  it("should assemble prompts based on profile brand memory fields", () => {
    const profile = {
      forbidden_phrases: ["synergy", "delight"],
      proof_points: ["Over 99.9% uptime", "Bootstraped to $1M ARR"],
      cta_preferences: ["DM me the word SPARK", "Reply below"],
      preferred_structures: ["Hook -> Pain Point -> Solution -> CTA"],
    };

    const prompt = buildBrandMemoryPrompt(profile);
    
    expect(prompt).toContain("BRAND MEMORY & IDENTITY CONSTRAINTS");
    expect(prompt).toContain('"synergy"');
    expect(prompt).toContain("Over 99.9% uptime");
    expect(prompt).toContain("DM me the word SPARK");
    expect(prompt).toContain("Hook -> Pain Point -> Solution -> CTA");
  });
});
