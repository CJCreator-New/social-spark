import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hasBrandMemory, buildBrandMemoryPrompt, generateWithFallback } from "../brandMemory";
import type { BrandSlotRow } from "@/hooks/queries/shared";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    },
  },
}));

vi.mock("@/lib/aiClientResolver", () => ({
  resolveAiClient: vi.fn(() => Promise.reject(new Error("no user key configured"))),
}));

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

describe("generateWithFallback error message fidelity", () => {
  const OLD_FETCH = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    global.fetch = OLD_FETCH;
  });

  it("preserves the real server error message on a 500 and does not attempt a BYOK fallback", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "AI is not configured." }),
    });

    await expect(
      generateWithFallback("generate-calendar", { coreIdea: "test" })
    ).rejects.toThrow("AI is not configured.");

    // Only the initial platform call should have fired — no BYOK fallback attempt,
    // since "AI is not configured." matches NON_FALLBACK_ERRORS.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("preserves the real server error message on a 503 (platform unavailable)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: "All platform AI providers are currently unavailable." }),
    });

    await expect(
      generateWithFallback("generate-calendar", { coreIdea: "test" })
    ).rejects.toThrow("All platform AI providers are currently unavailable.");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("still attempts the BYOK fallback path for a genuine unclassified 500 error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal server error" }),
    });

    await expect(
      generateWithFallback("generate-calendar", { coreIdea: "test" })
    ).rejects.toThrow("AI_UNAVAILABLE");

    // Platform call, then the fallback path tries to resolve a user key (which
    // rejects in this mock, short-circuiting before a second fetch happens).
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
