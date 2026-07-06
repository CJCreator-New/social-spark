import { describe, it, expect } from "vitest";
import { PASSWORD_MIN_LENGTH, validatePassword } from "../passwordPolicy";

describe("passwordPolicy", () => {
  it("exposes a minimum length of 8", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it("rejects passwords shorter than the minimum length", () => {
    expect(validatePassword("1234567")).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    );
  });

  it("accepts a password exactly at the minimum length boundary", () => {
    expect(validatePassword("12345678")).toBeNull();
  });

  it("accepts passwords longer than the minimum length", () => {
    expect(validatePassword("a-very-long-password-123")).toBeNull();
  });

  it("rejects an empty password", () => {
    expect(validatePassword("")).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    );
  });
});
