import { describe, it, expect } from "vitest";
import { countPlatformChars, platformLimitStatus, sanitizeCopy } from "@/lib/copyLimits";
import { normalizeHashtags } from "@/lib/platformCopy";

describe("countPlatformChars", () => {
  it("counts a URL as 23 on X", () => {
    const url = "https://example.com/a/very/long/path/that/is/over/twenty-three/chars";
    expect(countPlatformChars(`Hi ${url}`, "twitter")).toBe(3 + 23);
  });
  it("counts URLs by length elsewhere", () => {
    const t = "Hi https://example.com/long/path/here/ok";
    expect(countPlatformChars(t, "linkedin")).toBe(Array.from(t).length);
  });
  it("counts code points, not UTF-16 units", () => {
    expect(countPlatformChars("a😀b", "instagram")).toBe(3);
  });
  it("resolves free-form platform names", () => {
    expect(countPlatformChars("https://a.co/x", "X")).toBe(23);
  });
});

describe("platformLimitStatus", () => {
  it("reports ok, near and over", () => {
    expect(platformLimitStatus("a".repeat(100), "twitter").state).toBe("ok");
    expect(platformLimitStatus("a".repeat(252), "twitter").state).toBe("near");
    expect(platformLimitStatus("a".repeat(280), "twitter").state).toBe("near");
    const over = platformLimitStatus("a".repeat(281), "twitter");
    expect(over.state).toBe("over");
    expect(over.limit).toBe(280);
    expect(over.count).toBe(281);
  });
});

describe("sanitizeCopy", () => {
  it("strips **bold**, __bold__ and *italic*", () => {
    expect(sanitizeCopy("This is **bold** text")).toBe("This is bold text");
    expect(sanitizeCopy("This is __bold__ text")).toBe("This is bold text");
    expect(sanitizeCopy("This is *italic* text")).toBe("This is italic text");
    expect(sanitizeCopy("*Starts italic* here")).toBe("Starts italic here");
  });
  it("keeps a leading '* ' bullet", () => {
    expect(sanitizeCopy("* first\n* second")).toBe("* first\n* second");
  });
  it("keeps hashtags and snake_case words", () => {
    expect(sanitizeCopy("Go #launch_day #AI now")).toBe("Go #launch_day #AI now");
    expect(sanitizeCopy("use my_var_name here")).toBe("use my_var_name here");
  });
  it("is idempotent and handles empty input", () => {
    const once = sanitizeCopy("**a** and *b*");
    expect(sanitizeCopy(once)).toBe(once);
    expect(sanitizeCopy("")).toBe("");
  });
});

describe("normalizeHashtags unicode", () => {
  it("keeps Hindi and Tamil hashtags", () => {
    expect(normalizeHashtags("#भारत #தமிழ் #plain!", 5)).toEqual(["#भारत", "#தமிழ்", "#plain"]);
  });
});
