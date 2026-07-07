import { beforeEach, describe, expect, it } from "vitest";
import {
  loadScheduleTimezone,
  resolveScheduleTimezone,
  saveScheduleTimezone,
} from "@/lib/schedulePreferences";

describe("schedulePreferences", () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* jsdom may not expose localStorage in some environments */
    }
  });

  it("saves and loads a timezone per user", () => {
    saveScheduleTimezone("user-1", "Asia/Singapore");
    expect(loadScheduleTimezone("user-1")).toBe("Asia/Singapore");
    expect(loadScheduleTimezone("user-2")).toBeNull();
  });

  it("resolves from storage before profile or browser defaults", () => {
    saveScheduleTimezone("user-1", "Europe/London");
    expect(resolveScheduleTimezone("user-1", "UTC", "America/New_York")).toBe("Europe/London");
    expect(resolveScheduleTimezone("user-2", "UTC", "America/New_York")).toBe("UTC");
    expect(resolveScheduleTimezone("user-3", null, "America/New_York")).toBe("America/New_York");
  });
});
