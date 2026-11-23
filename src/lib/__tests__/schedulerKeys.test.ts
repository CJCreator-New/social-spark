import { describe, it, expect } from "vitest";
import { validateSchedulerKey, MAX_SCHEDULER_KEY_LENGTH } from "../schedulerKeys";

describe("validateSchedulerKey", () => {
  it("accepts buffer and hootsuite", () => {
    expect(validateSchedulerKey("buffer", "abc123-_.TOKEN").ok).toBe(true);
    expect(validateSchedulerKey("hootsuite", "abc123-_.TOKEN").ok).toBe(true);
  });

  it("rejects other providers", () => {
    expect(validateSchedulerKey("openai", "abc").ok).toBe(false);
    expect(validateSchedulerKey("", "abc").ok).toBe(false);
    expect(validateSchedulerKey(undefined, "abc").ok).toBe(false);
  });

  it("rejects empty and over-long keys", () => {
    expect(validateSchedulerKey("buffer", "").ok).toBe(false);
    expect(validateSchedulerKey("buffer", undefined).ok).toBe(false);
    expect(validateSchedulerKey("buffer", "a".repeat(MAX_SCHEDULER_KEY_LENGTH)).ok).toBe(true);
    expect(validateSchedulerKey("buffer", "a".repeat(MAX_SCHEDULER_KEY_LENGTH + 1)).ok).toBe(false);
  });

  it("rejects keys with whitespace or newlines", () => {
    expect(validateSchedulerKey("buffer", "ab cd").ok).toBe(false);
    expect(validateSchedulerKey("buffer", "abcd\n").ok).toBe(false);
    expect(validateSchedulerKey("hootsuite", "ab\tcd").ok).toBe(false);
    expect(validateSchedulerKey("hootsuite", "ab\r\ncd").ok).toBe(false);
  });
});
