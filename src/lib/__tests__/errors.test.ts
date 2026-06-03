import { describe, it, expect } from "vitest";
import {
  AppError,
  NetworkError,
  ValidationError,
  AuthError,
  RateLimitError,
  TimeoutError,
  isAppError,
  getUserFriendlyMessage,
  getDeveloperMessage,
} from "../errors";

describe("errors helper and class tests", () => {
  describe("Custom Error Classes", () => {
    it("should instantiate custom error classes correctly", () => {
      const err = new ValidationError("Invalid field value", { field: "industry" });
      expect(err.message).toBe("Invalid field value");
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.statusCode).toBe(400);
      expect(err.isRetryable).toBe(false);
      expect(err.context).toEqual({ field: "industry" });
    });

    it("should support serialization to JSON", () => {
      const err = new AuthError("Session expired");
      const json = err.toJSON();
      expect(json.name).toBe("AuthError");
      expect(json.code).toBe("AUTH_ERROR");
      expect(json.statusCode).toBe(401);
    });

    it("should calculate retry after for RateLimitError", () => {
      const err = new RateLimitError("Slow down", 3000);
      expect(err.getRetryAfter()).toBe(3000);
      const defaultErr = new RateLimitError("Slow down");
      expect(defaultErr.getRetryAfter()).toBe(5000);
    });
  });

  describe("isAppError", () => {
    it("should correctly identify AppError instances", () => {
      const appErr = new NetworkError("Lost connection");
      const normErr = new Error("Standard error");
      expect(isAppError(appErr)).toBe(true);
      expect(isAppError(normErr)).toBe(false);
      expect(isAppError("string")).toBe(false);
      expect(isAppError(null)).toBe(false);
    });
  });

  describe("getUserFriendlyMessage", () => {
    it("should return the exact message for AppError", () => {
      const appErr = new ValidationError("A nice validation error message");
      expect(getUserFriendlyMessage(appErr)).toBe("A nice validation error message");
    });

    it("should map network standard errors to a safe user message", () => {
      const err = new Error("Failed to fetch data from network");
      expect(getUserFriendlyMessage(err)).toBe("Connection error. Please check your internet and try again.");
    });

    it("should map timeout standard errors to a safe user message", () => {
      const err = new Error("Connection timeout");
      expect(getUserFriendlyMessage(err)).toBe("Request took too long. Please try again.");
    });

    it("should map other standard errors to a default safe message", () => {
      const err = new Error("Some database constraint violation");
      expect(getUserFriendlyMessage(err)).toBe("Something went wrong. Please try again.");
    });

    it("should handle string errors as-is", () => {
      expect(getUserFriendlyMessage("Direct error string")).toBe("Direct error string");
    });

    it("should return fallback message for unknown types", () => {
      expect(getUserFriendlyMessage({})).toBe("An unexpected error occurred. Please try again.");
    });
  });

  describe("getDeveloperMessage", () => {
    it("should format developer message for AppError", () => {
      const err = new ValidationError("Incorrect value", { key: "abc" });
      expect(getDeveloperMessage(err)).toContain("[VALIDATION_ERROR] Incorrect value");
      expect(getDeveloperMessage(err)).toContain('"key":"abc"');
    });

    it("should format developer message for standard Error", () => {
      const err = new Error("Fatal error");
      expect(getDeveloperMessage(err)).toBe("Error: Fatal error");
    });

    it("should fallback to String representation for raw errors", () => {
      expect(getDeveloperMessage("raw string error")).toBe("raw string error");
    });
  });
});
