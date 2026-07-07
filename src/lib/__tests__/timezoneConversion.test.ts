import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  zonedToUtcIso,
  fmtDateInTz,
  fmtTimeInTz,
  tzOffsetString,
  isValidTimezone,
} from "../timezones";

describe("timezones — conversion round-trip", () => {
  it("converts America/New_York wall time 09:00 to UTC correctly", () => {
    const utc = zonedToUtcIso("2026-07-06", "09:00", "America/New_York");
    expect(utc).toBe("2026-07-06T13:00:00.000Z");
  });

  it("converts Asia/Kolkata wall time correctly", () => {
    const utc = zonedToUtcIso("2026-07-06", "09:00", "Asia/Kolkata");
    expect(utc).toBe("2026-07-06T03:30:00.000Z");
  });

  it("preserves the correct UTC instant when converting from a timezone", () => {
    const utc = zonedToUtcIso("2026-03-15", "10:00", "America/New_York");
    expect(new Date(utc).toISOString()).toBe("2026-03-15T14:00:00.000Z");
  });

  it("handles DST spring-forward day (2026-03-08 US) without NaN", () => {
    const utc = zonedToUtcIso("2026-03-08", "02:30", "America/New_York");
    expect(isNaN(Date.parse(utc))).toBe(false);
  });

  it("handles DST fall-back day (2026-11-01 US) without NaN", () => {
    const utc = zonedToUtcIso("2026-11-01", "01:30", "America/New_York");
    expect(isNaN(Date.parse(utc))).toBe(false);
  });

  it("round-trips formatted date/time back through Intl without crashing", () => {
    const iso = "2026-07-06T13:00:00.000Z";
    const localDate = fmtDateInTz(iso, "America/New_York");
    const localTime = fmtTimeInTz(iso, "America/New_York");
    expect(typeof localDate).toBe("string");
    expect(typeof localTime).toBe("string");
  });

  it("returns a valid tz offset string for a common timezone", () => {
    const offset = tzOffsetString("America/New_York", new Date("2026-07-06"));
    expect(offset).toMatch(/^[+-]\d{2}:\d{2}$/);
  });
});
