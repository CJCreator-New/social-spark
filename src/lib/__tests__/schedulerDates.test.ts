import { describe, it, expect } from "vitest";
import { buildScheduledAt, countSchedulerResults } from "../schedulerDates";

describe("buildScheduledAt", () => {
  it("keeps the requested day and wall time in that zone", () => {
    const iso = buildScheduledAt("2026-12-02", "09:30", "Asia/Kolkata");
    expect(iso).toBe("2026-12-02T09:30:00+05:30");
    expect(iso.slice(0, 10)).toBe("2026-12-02");
  });

  it("uses different UTC instants for positive and negative offset zones", () => {
    const kolkata = buildScheduledAt("2026-12-02", "09:00", "Asia/Kolkata");
    const newYork = buildScheduledAt("2026-12-02", "09:00", "America/New_York");
    expect(kolkata.endsWith("+05:30")).toBe(true);
    expect(newYork.endsWith("-05:00")).toBe(true);
    expect(new Date(kolkata).toISOString()).toBe("2026-12-02T03:30:00.000Z");
    expect(new Date(newYork).toISOString()).toBe("2026-12-02T14:00:00.000Z");
  });

  it("applies daylight saving for the specific day", () => {
    expect(buildScheduledAt("2026-07-01", "09:00", "America/New_York")).toBe(
      "2026-07-01T09:00:00-04:00"
    );
  });

  it("is never today's date unless the requested day is today", () => {
    const today = new Date().toISOString().slice(0, 10);
    const other = today === "2030-01-15" ? "2030-01-16" : "2030-01-15";
    expect(buildScheduledAt(other, "09:00", "UTC").slice(0, 10)).toBe(other);
    expect(buildScheduledAt(other, "09:00", "UTC").slice(0, 10)).not.toBe(today);
    expect(buildScheduledAt(today, "09:00", "UTC").slice(0, 10)).toBe(today);
  });

  it("rejects malformed input", () => {
    expect(() => buildScheduledAt("12/02/2026", "09:00", "UTC")).toThrow();
    expect(() => buildScheduledAt("2026-12-02", "25:00", "UTC")).toThrow();
  });
});

describe("countSchedulerResults", () => {
  it("summarises mixed success and failure", () => {
    const r = countSchedulerResults(
      { attempted: 5, succeeded: 3, failed: 2, errors: [{ index: 1, message: "x" }] },
      "Buffer"
    );
    expect(r.succeeded).toBe(3);
    expect(r.failed).toBe(2);
    expect(r.message).toBe("3/5 posts pushed to Buffer, 2 failed");
  });

  it("handles all success and empty responses", () => {
    expect(countSchedulerResults({ succeeded: 4, failed: 0 }, "Buffer").message).toBe(
      "4/4 posts pushed to Buffer"
    );
    expect(countSchedulerResults(null)).toMatchObject({ succeeded: 0, failed: 0 });
  });
});
