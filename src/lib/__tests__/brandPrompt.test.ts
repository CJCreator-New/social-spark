import { beforeEach, describe, expect, it } from "vitest";
import { buildBrandPrompt, mergeBrandSources } from "@/lib/brandPrompt";
import { buildBrandMemoryPrompt } from "@/lib/brandMemory";
import {
  brandCacheKey,
  brandMigrationKey,
  migrateLocalBrandToProfile,
  readBrandCache,
  resetBrandMigration,
  slotToCache,
  writeBrandCache,
} from "@/lib/brandCache";

const USER = "user-1";

beforeEach(() => {
  window.localStorage.clear();
});

describe("buildBrandPrompt", () => {
  it("includes voice, audience, forbidden terms, required terms and hashtag policy", () => {
    const prompt = buildBrandPrompt({
      voice: "Warm and direct",
      style: "Short sentences",
      audiences: ["Startup founders"],
      forbidden_phrases: ["synergy"],
      required_phrases: ["Spark Studio"],
      proof_points: ["10k users"],
      cta_preferences: ["DM me SPARK"],
      preferred_structures: ["Hook -> CTA"],
      banned_hashtags: ["spam"],
      required_hashtags: ["#socialspark"],
    });
    expect(prompt).toContain("Warm and direct");
    expect(prompt).toContain("Short sentences");
    expect(prompt).toContain("Startup founders");
    expect(prompt).toContain('"synergy"');
    expect(prompt).toContain('"Spark Studio"');
    expect(prompt).toContain("10k users");
    expect(prompt).toContain("DM me SPARK");
    expect(prompt).toContain("Hook -> CTA");
    expect(prompt).toContain("#spam");
    expect(prompt).toContain("#socialspark");
    expect(prompt).not.toContain("##socialspark");
  });

  it("omits empty fields and returns an empty string when nothing is set", () => {
    expect(buildBrandPrompt(null)).toBe("");
    expect(buildBrandPrompt({ voice: "  ", audiences: [], banned_hashtags: [""] })).toBe("");
    const prompt = buildBrandPrompt({ voice: "Calm", audiences: [] });
    expect(prompt).toContain("Calm");
    expect(prompt).not.toContain("AUDIENCE");
    expect(prompt).not.toContain("HASHTAGS");
  });

  it("legacy buildBrandMemoryPrompt delegates to the same builder", () => {
    const slot = { forbidden_phrases: ["x"], voice: "Bold" };
    expect(buildBrandMemoryPrompt(slot)).toBe(buildBrandPrompt(slot));
  });

  it("merges: slot wins, cache fills gaps", () => {
    const merged = mergeBrandSources(
      { voice: "Slot voice", audiences: [] },
      { voice: "Cache voice", style: "Cache style", audiences: ["Cache aud"] }
    );
    expect(merged.voice).toBe("Slot voice");
    expect(merged.style).toBe("Cache style");
    expect(merged.audiences).toEqual(["Cache aud"]);
  });
});

describe("migrateLocalBrandToProfile", () => {
  const local = {
    voice: "Local voice",
    style: "Local style",
    audiences: ["Local aud"],
    bannedWords: ["local-banned"],
    bannedHashtags: ["localtag"],
  };

  it("keeps non-empty profile values and fills empty ones", () => {
    const patch = migrateLocalBrandToProfile(
      local,
      { voice: "Profile voice", style: "", audiences: [] },
      USER
    );
    expect(patch.voice).toBeUndefined();
    expect(patch.style).toBe("Local style");
    expect(patch.audiences).toEqual(["Local aud"]);
    expect(patch.forbidden_phrases).toEqual(["local-banned"]);
    expect(patch.banned_hashtags).toEqual(["localtag"]);
  });

  it("runs only once per user under a versioned key", () => {
    const first = migrateLocalBrandToProfile(local, {}, USER);
    expect(Object.keys(first).length).toBeGreaterThan(0);
    expect(window.localStorage.getItem(brandMigrationKey(USER))).toBeTruthy();
    expect(brandMigrationKey(USER)).toContain("v1");
    expect(migrateLocalBrandToProfile(local, {}, USER)).toEqual({});
  });

  it("can retry after resetBrandMigration", () => {
    migrateLocalBrandToProfile(local, {}, USER);
    resetBrandMigration(USER);
    expect(Object.keys(migrateLocalBrandToProfile(local, {}, USER)).length).toBeGreaterThan(0);
  });

  it("does not throw on corrupt localStorage JSON", () => {
    window.localStorage.setItem(brandCacheKey(USER), "{not json");
    expect(() => readBrandCache(USER)).not.toThrow();
    expect(readBrandCache(USER)).toBeNull();
    expect(() => migrateLocalBrandToProfile(readBrandCache(USER), {}, USER)).not.toThrow();
  });
});

describe("brand cache", () => {
  it("writes through from a slot and reads back", () => {
    writeBrandCache(USER, slotToCache({ voice: "Calm", banned_hashtags: ["x"] }));
    const cache = readBrandCache(USER);
    expect(cache?.voice).toBe("Calm");
    expect(cache?.bannedHashtags).toEqual(["x"]);
  });
});
