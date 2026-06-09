import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateApiKeyFormat,
  saveUserApiKey,
  getUserApiKey,
  deleteUserApiKey,
  setUseOwnKey,
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
    expect(result).toEqual({ apiKey: null, provider: null, useOwnKey: false, keyMode: 'fallback' });
  });

  it("returns null apiKey when no user_settings row exists", async () => {
    mockGetSession.mockResolvedValue(VALID_SESSION);
    mockMaybySingle.mockResolvedValue({ data: null, error: null });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ apiKey: null, provider: null }),
    } as Response);

    const result = await getUserApiKey();
    expect(result.apiKey).toBeNull();
    expect(result.useOwnKey).toBe(false);
  });

  it("returns apiKey, provider, useOwnKey=true on happy path", async () => {
    mockGetSession.mockResolvedValue(VALID_SESSION);
    mockMaybySingle.mockResolvedValue({ data: { use_own_key: true }, error: null });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ apiKey: "sk-decrypted-key-abc123", provider: "openai" }),
    } as Response);

    const result = await getUserApiKey();
    expect(result.apiKey).toBe("sk-decrypted-key-abc123");
    expect(result.provider).toBe("openai");
    expect(result.useOwnKey).toBe(true);
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
      provider: null,
      useOwnKey: false,
      keyMode: 'fallback',
    });
  });

  it("returns null apiKey when use_own_key is false even if key exists", async () => {
    mockGetSession.mockResolvedValue(VALID_SESSION);
    mockMaybySingle.mockResolvedValue({ data: { use_own_key: false }, error: null });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ apiKey: "sk-some-key-abc123", provider: "openai" }),
    } as Response);

    const result = await getUserApiKey();
    // Key comes back from decrypt but useOwnKey is false
    expect(result.useOwnKey).toBe(false);
    // apiKey still returned (caller decides whether to use it based on useOwnKey)
    expect(result.apiKey).toBe("sk-some-key-abc123");
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
