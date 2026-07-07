import { describe, it, expect } from "vitest";
import { PASSWORD_MIN_LENGTH, validatePassword } from "../passwordPolicy";

describe("passwordPolicy", () => {
  it("exposes a minimum length of 10", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
  });

  it("rejects passwords shorter than the minimum length", () => {
    expect(validatePassword("abc12345")).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    );
  });

  it("accepts a password exactly at the minimum length boundary with letter and digit", () => {
    expect(validatePassword("abcdefgh12")).toBeNull();
  });

  it("accepts passwords longer than the minimum length", () => {
    expect(validatePassword("a-very-long-password-123")).toBeNull();
  });

  it("rejects an empty password", () => {
    expect(validatePassword("")).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    );
  });

  it("rejects a long enough password with letters only", () => {
    expect(validatePassword("abcdefghij")).toBe(
      "Password must contain at least one letter and one digit."
    );
  });

  it("rejects a long enough password with digits only", () => {
    expect(validatePassword("1234567890")).toBe(
      "Password must contain at least one letter and one digit."
    );
  });

  it("rejects the common weak password 'password'", () => {
    expect(validatePassword("password")).toBe(
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    );
  });
});
