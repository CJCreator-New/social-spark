import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveAiClient } from "../aiClientResolver";

// ---------------------------------------------------------------------------
// Mock getUserApiKey from apiKeyManager
// ---------------------------------------------------------------------------
const mockGetUserApiKey = vi.fn();

vi.mock("../apiKeyManager", () => ({
  getUserApiKey: (...args: unknown[]) => mockGetUserApiKey(...args),
}));

// ---------------------------------------------------------------------------
// Helper to set the VITE_PLATFORM_AI_KEY env
// ---------------------------------------------------------------------------
function setPlatformKey(value: string) {
  vi.stubEnv("VITE_PLATFORM_AI_KEY", value);
}

describe("resolveAiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // -------------------------------------------------------------------------
  // Platform available path
  // -------------------------------------------------------------------------
  it("returns source='platform' when platformAvailable=true and env key is set", async () => {
    setPlatformKey("platform-secret-key-xyz");

    const result = await resolveAiClient(true);

    expect(result.source).toBe("platform");
    expect(result.apiKey).toBe("platform-secret-key-xyz");
    // Platform key is the Lovable AI Gateway (Gemini-family), not OpenAI.
    expect(result.provider).toBe("gemini");
  });

  it("respects VITE_PLATFORM_AI_PROVIDER override when set to a valid provider", async () => {
    setPlatformKey("platform-secret-key-xyz");
    vi.stubEnv("VITE_PLATFORM_AI_PROVIDER", "anthropic");

    const result = await resolveAiClient(true);

    expect(result.provider).toBe("anthropic");
  });

  it("falls back to gemini when VITE_PLATFORM_AI_PROVIDER is not a valid ApiProvider", async () => {
    setPlatformKey("platform-secret-key-xyz");
    vi.stubEnv("VITE_PLATFORM_AI_PROVIDER", "not-a-real-provider");

    const result = await resolveAiClient(true);

    expect(result.provider).toBe("gemini");
  });

  it("does NOT call getUserApiKey when platform is available", async () => {
    setPlatformKey("platform-secret-key-xyz");

    await resolveAiClient(true);

    expect(mockGetUserApiKey).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // User key fallback path
  // -------------------------------------------------------------------------
  it("returns source='user' when platform unavailable and user key exists with useOwnKey=true", async () => {
    setPlatformKey(""); // no platform key

    mockGetUserApiKey.mockResolvedValue({
      apiKey: "sk-user-key-" + "a".repeat(24),
      hasKey: true,
      provider: "openai",
      useOwnKey: true,
    });

    const result = await resolveAiClient(false);

    expect(result.source).toBe("user");
    expect(result.provider).toBe("openai");
    // BYOK keys are decrypted server-side only; the client never receives a
    // usable apiKey for the "user" source (F-012 — no more placeholder string).
    expect(result.apiKey).toBeUndefined();
  });

  it("returns source='user' for Anthropic provider", async () => {
    setPlatformKey("");

    mockGetUserApiKey.mockResolvedValue({
      apiKey: "sk-ant-user-key-" + "a".repeat(32),
      hasKey: true,
      provider: "anthropic",
      useOwnKey: true,
    });

    const result = await resolveAiClient(false);

    expect(result.source).toBe("user");
    expect(result.provider).toBe("anthropic");
    expect(result.apiKey).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // AI_UNAVAILABLE scenarios
  // -------------------------------------------------------------------------
  it("throws AI_UNAVAILABLE when platform is down and no user key", async () => {
    setPlatformKey("");

    mockGetUserApiKey.mockResolvedValue({
      apiKey: null,
      hasKey: false,
      provider: null,
      useOwnKey: false,
    });

    await expect(resolveAiClient(false)).rejects.toThrow("AI_UNAVAILABLE");
  });

  it("throws AI_UNAVAILABLE when platform is unavailable and platformAvailable=false with no env key", async () => {
    setPlatformKey("");

    mockGetUserApiKey.mockResolvedValue({
      apiKey: null,
      hasKey: false,
      provider: null,
      useOwnKey: false,
    });

    await expect(resolveAiClient(false)).rejects.toThrow("AI_UNAVAILABLE");
  });

  it("throws AI_UNAVAILABLE when user key exists but useOwnKey=false", async () => {
    setPlatformKey("");

    mockGetUserApiKey.mockResolvedValue({
      apiKey: "sk-user-key-abc123abc123abc123abc123abc123",
      hasKey: true,
      provider: "openai",
      useOwnKey: false, // toggle disabled
    });

    await expect(resolveAiClient(false)).rejects.toThrow("AI_UNAVAILABLE");
  });

  it("throws AI_UNAVAILABLE when user apiKey is null even if useOwnKey=true", async () => {
    setPlatformKey("");

    mockGetUserApiKey.mockResolvedValue({
      apiKey: null,
      hasKey: false,
      provider: "openai",
      useOwnKey: true, // toggle on, but no key saved
    });

    await expect(resolveAiClient(false)).rejects.toThrow("AI_UNAVAILABLE");
  });

  // -------------------------------------------------------------------------
  // Security: error message must not expose raw key
  // -------------------------------------------------------------------------
  it("AI_UNAVAILABLE error message does not expose any key value", async () => {
    setPlatformKey("some-secret-platform-key");
    vi.stubEnv("VITE_PLATFORM_AI_KEY", ""); // override to empty to force unavailable

    mockGetUserApiKey.mockResolvedValue({
      apiKey: null,
      hasKey: false,
      provider: null,
      useOwnKey: false,
    });

    let caught: Error | null = null;
    try {
      await resolveAiClient(false);
    } catch (e) {
      caught = e as Error;
    }

    expect(caught).not.toBeNull();
    expect(caught!.message).toBe("AI_UNAVAILABLE");
    // Message should be exactly the code — no key embedded
    expect(caught!.message).not.toContain("sk-");
    expect(caught!.message).not.toContain("platform");
  });

  // -------------------------------------------------------------------------
  // Platform key with env var missing fallback
  // -------------------------------------------------------------------------
  it("falls through to user key when platformAvailable=true but env key is empty", async () => {
    setPlatformKey(""); // env var set but empty

    mockGetUserApiKey.mockResolvedValue({
      apiKey: "sk-or-user-fallback-" + "a".repeat(32),
      hasKey: true,
      provider: "openrouter",
      useOwnKey: true,
    });

    const result = await resolveAiClient(true);

    // When env key is empty string, platform branch is skipped → user key used
    expect(result.source).toBe("user");
  });
});
