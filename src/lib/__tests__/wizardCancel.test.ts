import { describe, it, expect, vi, beforeEach } from "vitest";
import storageService from "@/lib/storageService";

describe("storageService — draft cancel / discard", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      // jsdom may not expose localStorage
    }
  });

  it("discarding a draft removes it from localStorage", () => {
    const key = "ss:draft:guest:test123";
    storageService.saveDraft(
      key,
      { version: 1, data: { step: 2 }, createdAt: Date.now(), savedAt: Date.now() },
      10000
    );
    expect(storageService.loadDraft(key)).not.toBeNull();

    storageService.removeDraft(key);
    expect(storageService.loadDraft(key)).toBeNull();
  });

  it("discarding a draft does not affect other drafts", () => {
    const key1 = "ss:draft:guest:a";
    const key2 = "ss:draft:guest:b";
    storageService.saveDraft(
      key1,
      { version: 1, data: { step: 1 }, createdAt: Date.now(), savedAt: Date.now() },
      10000
    );
    storageService.saveDraft(
      key2,
      { version: 1, data: { step: 2 }, createdAt: Date.now(), savedAt: Date.now() },
      10000
    );

    storageService.removeDraft(key1);
    expect(storageService.loadDraft(key1)).toBeNull();
    expect(storageService.loadDraft(key2)).not.toBeNull();
  });

  it("cancel does not persist partial data to localStorage", () => {
    const key = "ss:draft:guest:partial";
    // Simulate partial state that might be left if cancel didn't clean up
    const partial = {
      version: 1,
      data: { step: 3, form: { industry: "tech" } },
      createdAt: Date.now(),
      savedAt: Date.now(),
    };
    storageService.saveDraft(key, partial, 10000);
    storageService.removeDraft(key);

    const keys = storageService.listDraftKeys();
    expect(keys.some((k) => k.includes(key))).toBe(false);
  });

  it("clearing storage removes all draft keys", () => {
    storageService.saveDraft(
      "a",
      { version: 1, data: { step: 1 }, createdAt: Date.now(), savedAt: Date.now() },
      10000
    );
    storageService.saveDraft(
      "b",
      { version: 1, data: { step: 2 }, createdAt: Date.now(), savedAt: Date.now() },
      10000
    );
    expect(storageService.listDraftKeys().length).toBeGreaterThan(0);

    localStorage.clear();
    expect(storageService.listDraftKeys().length).toBe(0);
  });
});
