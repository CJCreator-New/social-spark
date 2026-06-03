import { describe, it, expect } from "vitest";
import {
  parseLocalDate,
  toDateInputValue,
  nextMonday,
  dateForDow,
  shortDateLabel,
  fullDateLabel,
  parseTime,
  postDateTime,
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
  });
});
