import { describe, it, expect } from "vitest";
import { hasBrandMemory, buildBrandMemoryPrompt } from "../brandMemory";
import type { BrandSlotRow } from "@/hooks/queries/shared";

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

  it("works identically when the source is a BrandSlotRow instead of a profile", () => {
    const brandSlot: BrandSlotRow = {
      id: "slot-1",
      user_id: "user-1",
      name: "Default",
      is_default: true,
      forbidden_phrases: ["synergy", "delight"],
      proof_points: ["Over 99.9% uptime", "Bootstraped to $1M ARR"],
      cta_preferences: ["DM me the word SPARK", "Reply below"],
      preferred_structures: ["Hook -> Pain Point -> Solution -> CTA"],
      brand_examples: null,
      default_framework: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    expect(hasBrandMemory(brandSlot)).toBe(true);

    const prompt = buildBrandMemoryPrompt(brandSlot);
    expect(prompt).toContain("BRAND MEMORY & IDENTITY CONSTRAINTS");
    expect(prompt).toContain('"synergy"');
    expect(prompt).toContain("Over 99.9% uptime");
    expect(prompt).toContain("DM me the word SPARK");
    expect(prompt).toContain("Hook -> Pain Point -> Solution -> CTA");

    const emptySlot: BrandSlotRow = {
      ...brandSlot,
      forbidden_phrases: [],
      proof_points: [],
      cta_preferences: [],
      preferred_structures: [],
    };
    expect(hasBrandMemory(emptySlot)).toBe(false);
  });
});
