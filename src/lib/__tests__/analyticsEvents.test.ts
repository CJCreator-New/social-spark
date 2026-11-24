import { describe, expect, it, vi, beforeEach } from "vitest";

const sendEventMock = vi.fn();
vi.mock("@/lib/telemetry", () => ({
  sendEvent: (...args: unknown[]) => sendEventMock(...args),
  default: { sendEvent: (...args: unknown[]) => sendEventMock(...args) },
}));

import {
  EVENT_PROP_ALLOW_LIST,
  sanitizeEventProps,
  trackAnalyticsEvent,
  type AnalyticsEventName,
} from "../analyticsEvents";

const FORBIDDEN = ["content", "text", "body", "email", "name", "apiKey"];

describe("analyticsEvents", () => {
  beforeEach(() => {
    sendEventMock.mockReset();
    sendEventMock.mockResolvedValue(undefined);
  });

  it("drops unknown keys", () => {
    const out = sanitizeEventProps("calendar_generated", {
      post_count: 7,
      content: "secret post",
      email: "a@b.c",
    });
    expect(out).toEqual({ post_count: 7 });
  });

  it("drops strings longer than 40 characters", () => {
    const out = sanitizeEventProps("schedule_clicked", {
      platform: "x".repeat(41),
      surface: "calendar_detail",
    });
    expect(out).toEqual({ surface: "calendar_detail" });
  });

  it("keeps allowed numbers and booleans, drops non-finite numbers", () => {
    expect(sanitizeEventProps("calendar_generated", { duration_ms: 1200, post_count: 7 })).toEqual({
      duration_ms: 1200,
      post_count: 7,
    });
    expect(sanitizeEventProps("calendar_generated", { duration_ms: NaN })).toEqual({});
  });

  it("does not throw when telemetry throws synchronously or rejects", () => {
    sendEventMock.mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() => trackAnalyticsEvent("wizard_started")).not.toThrow();
    sendEventMock.mockImplementation(() => Promise.reject(new Error("nope")));
    expect(() => trackAnalyticsEvent("wizard_started")).not.toThrow();
  });

  it("routes sanitised props through telemetry", () => {
    trackAnalyticsEvent("nps_submitted", { score: 9, content: "hi" });
    expect(sendEventMock).toHaveBeenCalledWith("nps_submitted", { score: 9 });
  });

  it("no allow-list contains a forbidden key", () => {
    for (const [name, keys] of Object.entries(EVENT_PROP_ALLOW_LIST)) {
      for (const key of keys) {
        expect(FORBIDDEN, `${name}.${key}`).not.toContain(key);
      }
    }
    const names = Object.keys(EVENT_PROP_ALLOW_LIST) as AnalyticsEventName[];
    for (const n of names) {
      const out = sanitizeEventProps(
        n,
        Object.fromEntries(FORBIDDEN.map((k) => [k, "x"]))
      );
      expect(Object.keys(out)).toEqual([]);
    }
  });
});
