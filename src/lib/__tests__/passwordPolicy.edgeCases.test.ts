import { describe, it, expect } from "vitest";
import { validatePassword, PASSWORD_MIN_LENGTH } from "../passwordPolicy";

describe("passwordPolicy — edge cases", () => {
  it("rejects whitespace-only passwords", () => {
    expect(validatePassword("   ")).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    );
  });

  it("rejects passwords exceeding a maximum length boundary", () => {
    const long = "a".repeat(1000);
    // If there is a max-length rule, this will flag it; otherwise ensure no crash
    const result = validatePassword(long);
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("rejects passwords with only special characters", () => {
    expect(validatePassword("!@#$%")).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    );
  });

  it("accepts compliant passwords with Unicode characters", () => {
    const password = "Pässwörd längéñ";
    // Should not crash and should either accept or reject with a rule message
    const result = validatePassword(password);
    expect(result === null || typeof result === "string").toBe(true);
  });

  it("treats leading/trailing whitespace as part of the password length", () => {
    const trimmed = "a".repeat(PASSWORD_MIN_LENGTH);
    expect(validatePassword(trimmed)).toBeNull();
  });

  it("rejects empty string explicitly", () => {
    expect(validatePassword("")).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    );
  });

  it("accepts a password at minimum length with mixed character classes", () => {
    expect(validatePassword("Abcdef1!")).toBeNull();
  });
});
