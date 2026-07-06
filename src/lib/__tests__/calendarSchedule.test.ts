import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseLocalDate,
  toDateInputValue,
  nextMonday,
  dateForDow,
  shortDateLabel,
  fullDateLabel,
  parseTime,
  postDateTime,
  downloadIcs,
  type IcsPost,
} from "../calendarSchedule";

describe("calendarSchedule helper tests", () => {
  describe("parseLocalDate", () => {
    it("should parse valid local date strings", () => {
      const d = parseLocalDate("2026-06-03");
      expect(d).not.toBeNull();
      expect(d!.getFullYear()).toBe(2026);
      expect(d!.getMonth()).toBe(5); // June is index 5
      expect(d!.getDate()).toBe(3);
    });

    it("should return null for invalid date patterns", () => {
      expect(parseLocalDate("")).toBeNull();
      expect(parseLocalDate(null)).toBeNull();
      expect(parseLocalDate("invalid-date")).toBeNull();
      expect(parseLocalDate("2026/06/03")).toBeNull();
    });
  });

  describe("toDateInputValue", () => {
    it("should format Date object to YYYY-MM-DD", () => {
      const d = new Date(2026, 5, 3);
      expect(toDateInputValue(d)).toBe("2026-06-03");
    });
  });

  describe("nextMonday", () => {
    it("should find the next Monday relative to a given date", () => {
      // Wednesday, June 3, 2026
      const base = new Date(2026, 5, 3);
      const nextMon = nextMonday(base);
      expect(nextMon.getDay()).toBe(1); // Monday is 1
      expect(nextMon.getDate()).toBe(8); // June 8 is next Monday
    });

    it("should find the next Monday if start date is Sunday", () => {
      // Sunday, June 7, 2026
      const base = new Date(2026, 5, 7);
      const nextMon = nextMonday(base);
      expect(nextMon.getDate()).toBe(8);
    });

    it("should find next week Monday if starting on Monday", () => {
      // Monday, June 8, 2026
      const base = new Date(2026, 5, 8);
      const nextMon = nextMonday(base);
      expect(nextMon.getDate()).toBe(15);
    });
  });

  describe("dateForDow", () => {
    it("should return correct date for different days of the week", () => {
      // Monday, June 8, 2026
      const weekStart = new Date(2026, 5, 8);
      const mon = dateForDow(weekStart, "Mon");
      const wed = dateForDow(weekStart, "Wed");
      const sun = dateForDow(weekStart, "Sun");

      expect(mon.getDate()).toBe(8);
      expect(wed.getDate()).toBe(10);
      expect(sun.getDate()).toBe(14);
    });
  });

  describe("shortDateLabel", () => {
    it("should format date correctly", () => {
      const d = new Date(2026, 5, 8); // Monday June 8
      expect(shortDateLabel(d)).toBe("Mon · Jun 8");
    });
  });

  describe("fullDateLabel", () => {
    it("should format date correctly", () => {
      const d = new Date(2026, 5, 8);
      expect(fullDateLabel(d)).toContain("June");
    });
  });

  describe("parseTime", () => {
    it("should parse valid HH:MM", () => {
      expect(parseTime("14:30")).toEqual({ hours: 14, minutes: 30 });
      expect(parseTime("09:05")).toEqual({ hours: 9, minutes: 5 });
    });

    it("should handle boundary cases", () => {
      expect(parseTime("25:61")).toEqual({ hours: 23, minutes: 59 });
    });

    it("should return default if invalid or empty", () => {
      expect(parseTime("")).toEqual({ hours: 9, minutes: 0 });
      expect(parseTime(null)).toEqual({ hours: 9, minutes: 0 });
      expect(parseTime("invalid")).toEqual({ hours: 9, minutes: 0 });
    });
  });

  describe("postDateTime", () => {
    it("should combine date and time correctly", () => {
      const weekStart = new Date(2026, 5, 8);
      const postDt = postDateTime(weekStart, "Wed", "15:45");
      expect(postDt.getFullYear()).toBe(2026);
      expect(postDt.getMonth()).toBe(5);
      expect(postDt.getDate()).toBe(10);
      expect(postDt.getHours()).toBe(15);
      expect(postDt.getMinutes()).toBe(45);
    });

    it("should handle the US DST spring-forward boundary (2026-03-08)", () => {
      // Sunday, March 8, 2026 is the US "spring forward" date (2:00am -> 3:00am).
      const weekStart = new Date(2026, 2, 2); // Monday, March 2, 2026
      const postDt = postDateTime(weekStart, "Sun", "09:30");
      expect(postDt.getFullYear()).toBe(2026);
      expect(postDt.getMonth()).toBe(2);
      expect(postDt.getDate()).toBe(8);
      expect(postDt.getHours()).toBe(9);
      expect(postDt.getMinutes()).toBe(30);
    });

    it("should handle the US DST fall-back boundary (2026-11-01)", () => {
      // Sunday, November 1, 2026 is the US "fall back" date (2:00am -> 1:00am).
      const weekStart = new Date(2026, 9, 26); // Monday, October 26, 2026
      const postDt = postDateTime(weekStart, "Sun", "01:30");
      expect(postDt.getFullYear()).toBe(2026);
      expect(postDt.getMonth()).toBe(10);
      expect(postDt.getDate()).toBe(1);
      expect(postDt.getHours()).toBe(1);
      expect(postDt.getMinutes()).toBe(30);
    });
  });

  describe("downloadIcs", () => {
    const basePost: IcsPost = {
      day: 1,
      dow: "Mon",
      topic: "Launch, Day",
      title: "Big Launch; Update",
      hook: "Hook line one\nHook line two",
      body: "Body copy with a comma, a semicolon; and a backslash \\ here.",
      cta: "Click now",
      hashtags: "#launch #update",
      platform: "LinkedIn",
    };

    let createObjectURLSpy: ReturnType<typeof vi.fn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
    let capturedText: string | null;

    beforeEach(() => {
      capturedText = null;
      createObjectURLSpy = vi.fn((blob: Blob) => {
        // Capture the text synchronously via the Blob's internal parts isn't directly
        // possible in jsdom without reading it; instead we intercept via Blob.text()
        // in the assertions below by keeping a reference to the blob.
        return "blob:mock-url";
      });
      revokeObjectURLSpy = vi.fn();
      // @ts-expect-error - jsdom doesn't implement these by default
      global.URL.createObjectURL = createObjectURLSpy;
      // @ts-expect-error - jsdom doesn't implement these by default
      global.URL.revokeObjectURL = revokeObjectURLSpy;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("generates a VCALENDAR/VEVENT structure and triggers a download", async () => {
      const weekStart = new Date(2026, 5, 8); // Monday, June 8, 2026
      let blobArg: Blob | undefined;
      createObjectURLSpy.mockImplementation((blob: Blob) => {
        blobArg = blob;
        return "blob:mock-url";
      });

      downloadIcs(
        {
          calendarTitle: "My Test Calendar",
          weekStart,
          postTimes: { "1": "09:00" },
        },
        [basePost]
      );

      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(blobArg).toBeDefined();

      const text = await blobArg!.text();
      expect(text).toContain("BEGIN:VCALENDAR");
      expect(text).toContain("VERSION:2.0");
      expect(text).toContain("END:VCALENDAR");
      expect(text).toContain("BEGIN:VEVENT");
      expect(text).toContain("END:VEVENT");
      expect(text).toContain("BEGIN:VALARM");
      expect(text).toContain("END:VALARM");
      expect(text).toContain("DTSTART:20260608T090000");
      expect(text).toContain("DTEND:20260608T093000"); // default 30 min duration
    });

    it("escapes commas, semicolons, newlines, and backslashes per RFC 5545", async () => {
      const weekStart = new Date(2026, 5, 8);
      let blobArg: Blob | undefined;
      createObjectURLSpy.mockImplementation((blob: Blob) => {
        blobArg = blob;
        return "blob:mock-url";
      });

      downloadIcs(
        {
          calendarTitle: "Escape, Test; Cal",
          weekStart,
          postTimes: { "1": "09:00" },
        },
        [basePost]
      );

      const text = await blobArg!.text();
      // Title escaping in X-WR-CALNAME
      expect(text).toContain("X-WR-CALNAME:Escape\\, Test\\; Cal");
      // Topic (used in CATEGORIES) has a comma escaped
      expect(text).toContain("Launch\\, Day");
      // Newline in hook becomes literal \n within DESCRIPTION
      expect(text).toContain("Hook line one\\nHook line two");
      // Backslash in body is escaped
      expect(text).toContain("a backslash \\\\ here");
      // Semicolon in title is escaped in SUMMARY
      expect(text).toContain("Big Launch\\; Update");
    });

    it("emits UTC DTSTART/DTEND when a timezone is provided", async () => {
      const weekStart = new Date(2026, 5, 8); // Monday, June 8, 2026 (EDT, UTC-4)
      let blobArg: Blob | undefined;
      createObjectURLSpy.mockImplementation((blob: Blob) => {
        blobArg = blob;
        return "blob:mock-url";
      });

      downloadIcs(
        {
          calendarTitle: "TZ Calendar",
          weekStart,
          postTimes: { "1": "09:00" },
          timezone: "America/New_York",
        },
        [basePost]
      );

      const text = await blobArg!.text();
      // 09:00 EDT (UTC-4) on June 8 2026 => 13:00 UTC
      expect(text).toContain("DTSTART:20260608T130000Z");
      expect(text).toContain("DTEND:20260608T133000Z");
    });

    it("falls back to the platform-suggested time when no explicit postTimes entry exists", async () => {
      const weekStart = new Date(2026, 5, 8);
      let blobArg: Blob | undefined;
      createObjectURLSpy.mockImplementation((blob: Blob) => {
        blobArg = blob;
        return "blob:mock-url";
      });

      downloadIcs(
        {
          calendarTitle: "Fallback Calendar",
          weekStart,
          postTimes: {}, // no explicit time for day 1
        },
        [basePost] // platform: LinkedIn -> day 1 suggestion is 08:00
      );

      const text = await blobArg!.text();
      expect(text).toContain("DTSTART:20260608T080000");
    });
  });
});
