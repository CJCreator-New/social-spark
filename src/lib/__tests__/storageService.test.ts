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

  it("lists and removes draft keys", () => {
    storageService.saveDraft("one", { value: 1 }, 10000);
    storageService.saveDraft("two", { value: 2 }, 10000);

    expect(storageService.listDraftKeys().sort()).toEqual(["one", "two"]);

    storageService.removeDraft("one");
    expect(storageService.listDraftKeys()).toEqual(["two"]);
  });

  it("cleans corrupted drafts during load", () => {
    localStorage.setItem("ss:draft:bad", "not-json");
    expect(storageService.loadDraft("bad")).toBeNull();
    expect(localStorage.getItem("ss:draft:bad")).toBeNull();
  });
});
