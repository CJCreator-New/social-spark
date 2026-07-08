import { describe, it, expect, beforeEach } from "vitest";
import storageService from "@/lib/storageService";

describe("storageService", () => {
  const key = "test:draft";
  beforeEach(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* jsdom may not expose localStorage in some environments */
    }
  });

  it("saves and loads draft envelope", () => {
    const data = { foo: "bar" };
    storageService.saveDraft(key, { version: 1, createdAt: Date.now(), data }, 10000);
    const got = storageService.loadDraft<{ version: number; createdAt: number; data: typeof data }>(
      key
    );
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

  it("cleans corrupted drafts during load by returning null, leaving raw stored item intact", () => {
    window.localStorage.setItem("ss:draft:bad", "not-json");
    expect(storageService.loadDraft("bad")).toBeNull();
    expect(window.localStorage.getItem("ss:draft:bad")).not.toBeNull();
  });

  it("encrypts draft data and decrypts it with the correct token, failing with a different token", () => {
    const data = { secret: "info" };
    try {
      window.localStorage.removeItem("ss_device_token");
    } catch {
      // ignore
    }

    // Save draft
    storageService.saveDraft(key, data, 10000);

    // Verify it is not stored as plaintext JSON in localStorage
    const rawStored = window.localStorage.getItem("ss:draft:" + key);
    expect(rawStored).not.toBeNull();
    expect(rawStored).not.toContain("secret");
    expect(rawStored).not.toContain("info");

    // Retrieve with correct token
    const got1 = storageService.loadDraft<typeof data>(key);
    expect(got1).not.toBeNull();
    expect(got1?.secret).toBe("info");

    // Change session token (simulating a new session)
    try {
      window.localStorage.setItem("ss_device_token", "different-token");
    } catch {
      return;
    }

    // Load draft should fail and return null, but NOT remove it from localStorage
    const got2 = storageService.loadDraft(key);
    expect(got2).toBeNull();
    expect(window.localStorage.getItem("ss:draft:" + key)).not.toBeNull();
  });
});
