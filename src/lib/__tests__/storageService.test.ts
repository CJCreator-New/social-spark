import { describe, it, expect, beforeEach } from "vitest";
import storageService from "@/lib/storageService";

describe("storageService", () => {
  const key = "test:draft";
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* jsdom may not expose localStorage in some environments */
    }
  });

  it("saves and loads draft envelope", () => {
    const data = { foo: "bar" };
    storageService.saveDraft(key, { version: 1, createdAt: Date.now(), data }, 10000);
    const got = storageService.loadDraft<{ version: number; createdAt: number; data: typeof data }>(key);
    expect(got).not.toBeNull();
    expect(got?.data.foo).toBe("bar");
  });

  it("removes expired drafts on cleanup", () => {
    const data = { foo: "old" };
    storageService.saveDraft(key, { version: 1, createdAt: Date.now() - 100000, data }, -1);
    storageService.cleanupExpiredDrafts();
    const got = storageService.loadDraft(key);
    expect(got).toBeNull();
  });
});
