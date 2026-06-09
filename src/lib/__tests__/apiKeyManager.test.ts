import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateApiKeyFormat, saveUserApiKey } from "../apiKeyManager";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

describe("apiKeyManager — validateApiKeyFormat", () => {
  describe("OpenAI", () => {
    it("accepts a valid OpenAI key", () => {
      expect(validateApiKeyFormat("sk-" + "a".repeat(32), "openai")).toBe(true);
      expect(validateApiKeyFormat("sk-proj-" + "a".repeat(48), "openai")).toBe(true);
    });

    it("rejects a key without sk- prefix", () => {
      expect(validateApiKeyFormat("api-" + "a".repeat(32), "openai")).toBe(false);
    });

    it("rejects a key shorter than 32 alphanumeric chars after prefix", () => {
      expect(validateApiKeyFormat("sk-short", "openai")).toBe(false);
    });

    it("rejects an empty key", () => {
      expect(validateApiKeyFormat("", "openai")).toBe(false);
    });
  });

  describe("Anthropic", () => {
    it("accepts a valid Anthropic key", () => {
      expect(validateApiKeyFormat("sk-ant-" + "a".repeat(32), "anthropic")).toBe(true);
      expect(validateApiKeyFormat("sk-ant-api03-" + "abc".repeat(16), "anthropic")).toBe(true);
    });

    it("rejects a key with wrong prefix", () => {
      expect(validateApiKeyFormat("sk-" + "a".repeat(32), "anthropic")).toBe(false);
    });

    it("rejects a key that is too short", () => {
      expect(validateApiKeyFormat("sk-ant-short", "anthropic")).toBe(false);
    });
  });

  describe("OpenRouter", () => {
    it("accepts a valid OpenRouter key", () => {
      expect(validateApiKeyFormat("sk-or-" + "a".repeat(32), "openrouter")).toBe(true);
      expect(validateApiKeyFormat("sk-or-v1-" + "abc".repeat(15), "openrouter")).toBe(true);
    });

    it("rejects a key with wrong prefix", () => {
      expect(validateApiKeyFormat("sk-" + "a".repeat(32), "openrouter")).toBe(false);
    });

    it("rejects a key that is too short", () => {
      expect(validateApiKeyFormat("sk-or-short", "openrouter")).toBe(false);
    });
  });
});

describe("apiKeyManager — saveUserApiKey format validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws INVALID_KEY_FORMAT for an OpenAI key with wrong format", async () => {
    await expect(saveUserApiKey("bad-key-format", "openai")).rejects.toThrow("INVALID_KEY_FORMAT");
  });

  it("throws INVALID_KEY_FORMAT for an Anthropic key with wrong format", async () => {
    await expect(saveUserApiKey("sk-wrongformat", "anthropic")).rejects.toThrow("INVALID_KEY_FORMAT");
  });

  it("throws INVALID_KEY_FORMAT for an OpenRouter key with wrong format", async () => {
    await expect(saveUserApiKey("not-a-real-key", "openrouter")).rejects.toThrow("INVALID_KEY_FORMAT");
  });

  it("does NOT throw INVALID_KEY_FORMAT for a correctly-formatted OpenAI key (will fail on session next)", async () => {
    // Format is valid — the error should come from session lookup, not format validation
    const validKey = "sk-" + "a".repeat(32);
    await expect(saveUserApiKey(validKey, "openai")).rejects.toThrow("User session not found");
  });
});
