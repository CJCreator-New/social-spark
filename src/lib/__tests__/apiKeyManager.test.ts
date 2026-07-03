import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateApiKeyFormat,
  saveUserApiKey,
  validateUserApiKey,
  getUserApiKey,
  deleteUserApiKey,
  setUseOwnKey,
  updateUserApiModel,
} from "../apiKeyManager";

// Use vi.hoisted to declare mocks that are referenced inside vi.mock calls, avoiding hoisting TDZ issues.
const { mockGetSession, mockMaybySingle, mockSelect, mockFrom } = vi.hoisted(() => {
  const mockGetSession = vi.fn();
  const mockMaybySingle = vi.fn();
  const mockSelect = vi.fn(() => ({ maybeSingle: mockMaybySingle }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  return { mockGetSession, mockMaybySingle, mockSelect, mockFrom };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    from: mockFrom,
  },
}));

// ---------------------------------------------------------------------------
// fetch mock helpers
// ---------------------------------------------------------------------------
function mockFetchOk(body: unknown = { success: true }) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function mockFetchError(status: number, errorMsg: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: errorMsg }),
  });
}

const VALID_SESSION = {
  data: {
    session: {
      access_token: "test-access-token",
      user: { id: "user-test-uuid" },
    },
  },
};

const NO_SESSION = { data: { session: null } };

// ---------------------------------------------------------------------------
// 1. validateApiKeyFormat
// ---------------------------------------------------------------------------
describe("validateApiKeyFormat", () => {
  describe("OpenAI", () => {
    it("accepts sk- key with 32+ alphanumeric chars", () => {
      expect(validateApiKeyFormat("sk-" + "a".repeat(32), "openai")).toBe(true);
    });

    it("accepts sk-proj- variant (real OpenAI format)", () => {
      expect(validateApiKeyFormat("sk-proj-" + "a".repeat(48), "openai")).toBe(true);
    });

    it("rejects key without sk- prefix", () => {
      expect(validateApiKeyFormat("api-" + "a".repeat(32), "openai")).toBe(false);
    });

    it("rejects key that is too short", () => {
      expect(validateApiKeyFormat("sk-short", "openai")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(validateApiKeyFormat("", "openai")).toBe(false);
    });

    it("rejects key with spaces", () => {
      expect(validateApiKeyFormat("sk- " + "a".repeat(32), "openai")).toBe(false);
    });

    it("rejects key with special characters (not alphanumeric or hyphen)", () => {
      expect(validateApiKeyFormat("sk-" + "a".repeat(28) + "!@#$", "openai")).toBe(false);
    });
  });

  describe("Anthropic", () => {
    it("accepts valid sk-ant- key", () => {
      expect(validateApiKeyFormat("sk-ant-" + "a".repeat(32), "anthropic")).toBe(true);
    });

    it("accepts sk-ant-api03- variant", () => {
      expect(validateApiKeyFormat("sk-ant-api03-" + "abc".repeat(16), "anthropic")).toBe(true);
    });

    it("rejects key with wrong prefix (plain sk-)", () => {
      expect(validateApiKeyFormat("sk-" + "a".repeat(32), "anthropic")).toBe(false);
    });

    it("rejects key that is too short", () => {
      expect(validateApiKeyFormat("sk-ant-short", "anthropic")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(validateApiKeyFormat("", "anthropic")).toBe(false);
    });

    it("rejects key with spaces", () => {
      expect(validateApiKeyFormat("sk-ant- " + "a".repeat(32), "anthropic")).toBe(false);
    });
  });

  describe("OpenRouter", () => {
    it("accepts valid sk-or- key", () => {
      expect(validateApiKeyFormat("sk-or-" + "a".repeat(32), "openrouter")).toBe(true);
    });

    it("accepts sk-or-v1- variant", () => {
      expect(validateApiKeyFormat("sk-or-v1-" + "abc".repeat(15), "openrouter")).toBe(true);
    });

    it("rejects key with wrong prefix", () => {
      expect(validateApiKeyFormat("sk-" + "a".repeat(32), "openrouter")).toBe(false);
    });

    it("rejects key that is too short", () => {
      expect(validateApiKeyFormat("sk-or-short", "openrouter")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(validateApiKeyFormat("", "openrouter")).toBe(false);
    });

    it("rejects key with spaces", () => {
      expect(validateApiKeyFormat("sk-or- " + "a".repeat(32), "openrouter")).toBe(false);
    });
  });

  describe("Gemini", () => {
    it("accepts valid AIza... key", () => {
      expect(validateApiKeyFormat("AIza" + "a".repeat(32), "gemini")).toBe(true);
    });

    it("rejects key without AIza prefix", () => {
      expect(validateApiKeyFormat("sk-" + "a".repeat(32), "gemini")).toBe(false);
    });

    it("rejects key that is too short", () => {
      expect(validateApiKeyFormat("AIzashort", "gemini")).toBe(false);
    });
  });

  describe("Kimi", () => {
    it("accepts valid sk- key", () => {
      expect(validateApiKeyFormat("sk-" + "a".repeat(32), "kimi")).toBe(true);
    });

    it("rejects key that is too short", () => {
      expect(validateApiKeyFormat("sk-short", "kimi")).toBe(false);
    });
  });

  describe("GLM", () => {
    it("accepts valid id.secret key", () => {
      expect(validateApiKeyFormat("a".repeat(24) + "." + "b".repeat(20), "glm")).toBe(true);
    });

    it("rejects key without a dot separator", () => {
      expect(validateApiKeyFormat("a".repeat(44), "glm")).toBe(false);
    });

    it("rejects key that is too short", () => {
      expect(validateApiKeyFormat("short.short", "glm")).toBe(false);
    });
  });

  describe("Cross-provider rejection", () => {
    it("rejects non-sk prefix for openai", () => {
      expect(validateApiKeyFormat("ant-key-" + "a".repeat(32), "openai")).toBe(false);
    });

    it("rejects openrouter key for anthropic provider", () => {
      const orKey = "sk-or-" + "a".repeat(32);
      expect(validateApiKeyFormat(orKey, "anthropic")).toBe(false);
    });

    it("rejects plain openai key for openrouter provider", () => {
      const oaiKey = "sk-" + "a".repeat(32);
      expect(validateApiKeyFormat(oaiKey, "openrouter")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. saveUserApiKey
// ---------------------------------------------------------------------------
describe("saveUserApiKey", () => {
  const VALID_KEY = "sk-" + "a".repeat(32);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(VALID_SESSION);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws INVALID_KEY_FORMAT before any network call for bad key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(saveUserApiKey("bad-key", "openai")).rejects.toThrow("INVALID_KEY_FORMAT");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws 'User session not found' when not authenticated", async () => {
    mockGetSession.mockResolvedValue(NO_SESSION);
    await expect(saveUserApiKey(VALID_KEY, "openai")).rejects.toThrow("User session not found");
  });

  it("calls encrypt-api-key Edge Function with correct body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    await saveUserApiKey(VALID_KEY, "openai");

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/v1/encrypt-api-key");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body as string);
    expect(body.apiKey).toBe(VALID_KEY);
    expect(body.provider).toBe("openai");
    // Authorization header must be set
    expect((opts.headers as Record<string, string>)["Authorization"]).toContain(
      VALID_SESSION.data.session.access_token
    );
  });

  it("throws and surfaces error message when Edge Function returns error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal server error" }),
    } as Response);

    await expect(saveUserApiKey(VALID_KEY, "openai")).rejects.toThrow("Internal server error");
  });

  it("error message does NOT contain the raw API key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "An unexpected error occurred." }),
    } as Response);

    let thrownError: Error | null = null;
    try {
      await saveUserApiKey(VALID_KEY, "openai");
    } catch (e) {
      thrownError = e as Error;
    }

    expect(thrownError).not.toBeNull();
    // The raw key must never appear in the error message
    expect(thrownError!.message).not.toContain(VALID_KEY);
  });

  it("sends correct Authorization header with Bearer token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    // use anthropic key properly
    const anthropicKey = "sk-ant-" + "a".repeat(32);
    fetchSpy.mockClear();
    await saveUserApiKey(anthropicKey, "anthropic");

    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer test-access-token`);
  });

  it("forwards the optional model param in the request body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    await saveUserApiKey(VALID_KEY, "openai", "gpt-5-mini");

    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.model).toBe("gpt-5-mini");
  });
});

// ---------------------------------------------------------------------------
// 3. getUserApiKey
// ---------------------------------------------------------------------------
describe("getUserApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null values when not authenticated (no session)", async () => {
    mockGetSession.mockResolvedValue(NO_SESSION);
    const result = await getUserApiKey();
    expect(result).toEqual({ apiKey: null, hasKey: false, provider: null, apiModel: null, useOwnKey: false, keyMode: 'fallback', settingsError: false });
  });

  it("returns null apiKey when no user_settings row exists", async () => {
    mockGetSession.mockResolvedValue(VALID_SESSION);
    mockMaybySingle.mockResolvedValue({ data: null, error: null });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ hasKey: false, provider: null, last4: null }),
    } as Response);

    const result = await getUserApiKey();
    expect(result.apiKey).toBeNull();
    expect(result.hasKey).toBe(false);
    expect(result.useOwnKey).toBe(false);
  });

  it("returns hasKey, provider, useOwnKey=true, last4 on happy path", async () => {
    mockGetSession.mockResolvedValue(VALID_SESSION);
    mockMaybySingle.mockResolvedValue({ data: { use_own_key: true }, error: null });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ hasKey: true, provider: "openai", last4: "abc123" }),
    } as Response);

    const result = await getUserApiKey();
    expect(result.apiKey).toBeNull(); // SECURE: No raw key returned
    expect(result.hasKey).toBe(true);
    expect(result.last4).toBe("abc123");
    expect(result.provider).toBe("openai");
    expect(result.useOwnKey).toBe(true);
    expect(result.settingsError).toBe(false);
  });

  it("returns null (does not throw) when decrypt Edge Function fails", async () => {
    mockGetSession.mockResolvedValue(VALID_SESSION);
    mockMaybySingle.mockResolvedValue({ data: { use_own_key: false }, error: null });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "An unexpected error occurred." }),
    } as Response);

    // Per spec: "Returns null (does not throw) if decrypt Edge Function fails gracefully"
    // Now that getUserApiKey is wrapped in try/catch (P2-41), it returns the default null state.
    const result = await getUserApiKey();
    expect(result).toEqual({
      apiKey: null,
      hasKey: false,
      provider: null,
      apiModel: null,
      useOwnKey: false,
      keyMode: 'fallback',
      settingsError: true,
    });
  });

  it("returns hasKey: true when key exists in DB but useOwnKey is false", async () => {
    mockGetSession.mockResolvedValue(VALID_SESSION);
    mockMaybySingle.mockResolvedValue({ data: { use_own_key: false }, error: null });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ hasKey: true, provider: "openai", last4: "abc123" }),
    } as Response);

    const result = await getUserApiKey();
    // Key comes back from decrypt but useOwnKey is false
    expect(result.useOwnKey).toBe(false);
    expect(result.hasKey).toBe(true);
    expect(result.apiKey).toBeNull();
  });

  it("surfaces a settings schema warning when the settings row cannot be read", async () => {
    mockGetSession.mockResolvedValue(VALID_SESSION);
    mockMaybySingle.mockResolvedValue({ data: null, error: new Error("column use_own_key does not exist") });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ hasKey: true, provider: "openai", last4: "abc123" }),
    } as Response);

    const result = await getUserApiKey();
    expect(result.settingsError).toBe(true);
    expect(result.useOwnKey).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. deleteUserApiKey
// ---------------------------------------------------------------------------
describe("deleteUserApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws 'User session not found' when not authenticated", async () => {
    mockGetSession.mockResolvedValue(NO_SESSION);
    await expect(deleteUserApiKey()).rejects.toThrow("User session not found");
  });

  it("calls delete-api-key Edge Function with correct headers", async () => {
    mockGetSession.mockResolvedValue(VALID_SESSION);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    await deleteUserApiKey();

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/v1/delete-api-key");
    expect(opts.method).toBe("POST");
    const headers = opts.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer test-access-token`);
  });

  it("throws error message from Edge Function on failure", async () => {
    mockGetSession.mockResolvedValue(VALID_SESSION);
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "An unexpected error occurred." }),
    } as Response);

    await expect(deleteUserApiKey()).rejects.toThrow("An unexpected error occurred.");
  });
});

// ---------------------------------------------------------------------------
// 5. setUseOwnKey
// ---------------------------------------------------------------------------
describe("setUseOwnKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(VALID_SESSION);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls encrypt-api-key with action=toggle and useOwnKey value", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    await setUseOwnKey(true);

    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/v1/encrypt-api-key");
    const body = JSON.parse(opts.body as string);
    expect(body.action).toBe("toggle");
    expect(body.useOwnKey).toBe(true);
  });

  it("throws 'User session not found' when not authenticated", async () => {
    mockGetSession.mockResolvedValue(NO_SESSION);
    await expect(setUseOwnKey(true)).rejects.toThrow("User session not found");
  });
});

// ---------------------------------------------------------------------------
// 6. localStorage Fallback
// ---------------------------------------------------------------------------
describe("localStorage Fallback", () => {
  const VALID_OPENAI_KEY = "sk-" + "a".repeat(32);
  const VALID_ANTHROPIC_KEY = "sk-ant-" + "a".repeat(32);
  const VALID_OPENROUTER_KEY = "sk-or-" + "a".repeat(32);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetSession.mockResolvedValue(VALID_SESSION);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe("when VITE_SUPABASE_URL contains mock.supabase.co", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://mock.supabase.co");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("saves key to localStorage directly and retrieves it correctly", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      // Save
      await saveUserApiKey(VALID_OPENAI_KEY, "openai");
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(localStorage.getItem("social_spark_user_api_key")).toBe(VALID_OPENAI_KEY);
      expect(localStorage.getItem("social_spark_user_api_provider")).toBe("openai");

      // Set toggle
      await setUseOwnKey(true, "always");
      expect(localStorage.getItem("social_spark_use_own_key")).toBe("true");
      expect(localStorage.getItem("social_spark_key_mode")).toBe("always");

      // Retrieve
      const retrieved = await getUserApiKey();
      expect(retrieved).toEqual({
        apiKey: VALID_OPENAI_KEY,
        hasKey: true,
        provider: "openai",
        apiModel: null,
        useOwnKey: true,
        keyMode: "always",
        last4: "aaaa",
        settingsError: false,
      });

      // Delete
      await deleteUserApiKey();
      expect(localStorage.getItem("social_spark_user_api_key")).toBeNull();
      expect(localStorage.getItem("social_spark_user_api_provider")).toBeNull();
      expect(localStorage.getItem("social_spark_user_api_model")).toBeNull();
      expect(localStorage.getItem("social_spark_use_own_key")).toBeNull();
      expect(localStorage.getItem("social_spark_key_mode")).toBeNull();
    });
  });

  describe("when Edge Functions return 404 (Not Found)", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://real-project.supabase.co");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("throws errors on save, toggle, delete and returns default values for get", async () => {
      // Mock fetch returning 404
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Function not found" }),
      } as Response);

      // Save should throw error and not save to localStorage
      await expect(saveUserApiKey(VALID_ANTHROPIC_KEY, "anthropic")).rejects.toThrow("encrypt-api-key' not found (404)");
      expect(localStorage.getItem("social_spark_user_api_key")).toBeNull();

      // Toggle should throw error and not save to localStorage
      await expect(setUseOwnKey(true, "fallback")).rejects.toThrow("encrypt-api-key' not found (404) for toggle");
      expect(localStorage.getItem("social_spark_use_own_key")).toBeNull();

      // Retrieve should return null/default settings and not pull from localStorage
      mockMaybySingle.mockRejectedValue(new Error("Table not found"));
      const retrieved = await getUserApiKey();
      expect(retrieved).toEqual({
        apiKey: null,
        hasKey: false,
        provider: null,
        apiModel: null,
        useOwnKey: false,
        keyMode: "fallback",
        settingsError: true,
      });

      // Delete should throw error
      await expect(deleteUserApiKey()).rejects.toThrow("delete-api-key' not found (404)");
    });
  });

  describe("when fetch throws a network error (Failed to fetch)", () => {
    beforeEach(() => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://real-project.supabase.co");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("throws errors and does not fall back to localStorage", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(
        new TypeError("Failed to fetch")
      );

      // Save should throw network error
      await expect(saveUserApiKey(VALID_OPENROUTER_KEY, "openrouter")).rejects.toThrow("Failed to fetch");
      expect(localStorage.getItem("social_spark_user_api_key")).toBeNull();

      // Toggle should throw network error
      await expect(setUseOwnKey(true, "always")).rejects.toThrow("Failed to fetch");
      expect(localStorage.getItem("social_spark_use_own_key")).toBeNull();

      // Retrieve should return default null values
      mockMaybySingle.mockRejectedValue(new Error("DB error"));
      const retrieved = await getUserApiKey();
      expect(retrieved).toEqual({
        apiKey: null,
        hasKey: false,
        provider: null,
        apiModel: null,
        useOwnKey: false,
        keyMode: "fallback",
        settingsError: true,
      });

      // Delete should throw network error
      await expect(deleteUserApiKey()).rejects.toThrow("Failed to fetch");
    });
  });
});

// ---------------------------------------------------------------------------
// validateUserApiKey
// ---------------------------------------------------------------------------
describe("validateUserApiKey", () => {
  const VALID_KEY = "sk-" + "a".repeat(32);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(VALID_SESSION);
    vi.stubEnv("VITE_SUPABASE_URL", "https://real-project.supabase.co");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns INVALID_KEY_FORMAT reason without any network call for a malformed key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await validateUserApiKey("bad-key", "openai");
    expect(result).toEqual({ valid: false, reason: "INVALID_KEY_FORMAT" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws 'User session not found' when not authenticated", async () => {
    mockGetSession.mockResolvedValue(NO_SESSION);
    await expect(validateUserApiKey(VALID_KEY, "openai")).rejects.toThrow("User session not found");
  });

  it("posts action='validate' with key + provider to the encrypt-api-key function", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ valid: true }),
    } as Response);

    await validateUserApiKey(VALID_KEY, "openai");

    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/v1/encrypt-api-key");
    const body = JSON.parse(opts.body as string);
    expect(body.action).toBe("validate");
    expect(body.apiKey).toBe(VALID_KEY);
    expect(body.provider).toBe("openai");
  });

  it("returns valid:true when the server confirms the key works", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ valid: true }),
    } as Response);

    const result = await validateUserApiKey(VALID_KEY, "openai");
    expect(result.valid).toBe(true);
  });

  it("returns valid:false with the server's reason when the provider rejects the key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ valid: false, reason: "Key was rejected (invalid or revoked)." }),
    } as Response);

    const result = await validateUserApiKey(VALID_KEY, "openai");
    expect(result).toEqual({ valid: false, reason: "Key was rejected (invalid or revoked)." });
  });

  it("surfaces a rate-limit message on HTTP 429", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({}),
    } as Response);

    const result = await validateUserApiKey(VALID_KEY, "openai");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/too many checks/i);
  });

  it("treats a mock Supabase environment as valid without a network call", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://mock.supabase.co");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await validateUserApiKey(VALID_KEY, "openai");
    expect(result).toEqual({ valid: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("forwards the optional model param when provided", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ valid: true }),
    } as Response);

    await validateUserApiKey(VALID_KEY, "openai", "gpt-5");

    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.model).toBe("gpt-5");
  });
});

// ---------------------------------------------------------------------------
// updateUserApiModel
// ---------------------------------------------------------------------------
describe("updateUserApiModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(VALID_SESSION);
    vi.stubEnv("VITE_SUPABASE_URL", "https://real-project.supabase.co");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("posts action='update-model' with the new model id", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    } as Response);

    await updateUserApiModel("gpt-5-mini");

    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/v1/encrypt-api-key");
    const body = JSON.parse(opts.body as string);
    expect(body.action).toBe("update-model");
    expect(body.model).toBe("gpt-5-mini");
  });

  it("throws 'User session not found' when not authenticated", async () => {
    mockGetSession.mockResolvedValue(NO_SESSION);
    await expect(updateUserApiModel("gpt-5-mini")).rejects.toThrow("User session not found");
  });
});
