import { supabase } from "@/integrations/supabase/client";
import { getE2EAuthFlag } from "@/lib/e2eFixtures";

export type ApiProvider = 'openai' | 'anthropic' | 'openrouter' | 'gemini' | 'kimi' | 'glm';

function getSupabaseRuntimeConfig(): { url: string; key: string } {
  if (typeof window !== "undefined") {
    const customUrl = localStorage.getItem("contentforge_custom_supabase_url") || "";
    const customKey = localStorage.getItem("contentforge_custom_supabase_anon_key") || "";
    if (customUrl && customKey) {
      return { url: customUrl, key: customKey };
    }
  }

  return {
    url: (import.meta.env.VITE_SUPABASE_URL as string) || "",
    key: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "",
  };
}

/**
 * Validates the API key format client-side before any network calls.
 * - OpenAI: sk-followed by at least 32 alphanumeric characters
 * - Anthropic: sk-ant- followed by at least 32 alphanumeric characters and hyphens
 * - OpenRouter: sk-or- followed by at least 32 alphanumeric characters and hyphens
 */
export function validateApiKeyFormat(key: string, provider: ApiProvider): boolean {
  const patterns = {
    // OpenAI: sk- followed by alphanumeric, hyphens, and underscores, min 20 total chars (covers sk-proj-... variants)
    openai: /^sk-[a-zA-Z0-9_-]{20,}$/,
    // Anthropic: sk-ant- followed by alphanumeric, hyphens, and underscores, min 20 chars after prefix
    anthropic: /^sk-ant-[a-zA-Z0-9_-]{20,}$/,
    // OpenRouter: sk-or- followed by alphanumeric, hyphens, and underscores, min 20 chars after prefix
    openrouter: /^sk-or-[a-zA-Z0-9_-]{20,}$/,
    // Gemini: AIza followed by at least 20 alphanumeric/underscore/hyphen chars
    gemini: /^AIza[0-9A-Za-z_-]{20,}$/,
    // Kimi (Moonshot): sk- followed by at least 20 alphanumeric chars
    kimi: /^sk-[A-Za-z0-9]{20,}$/,
    // GLM (Zhipu): id.secret format, both segments alphanumeric
    glm: /^[A-Za-z0-9]{20,}\.[A-Za-z0-9]{16,}$/,
  };
  return patterns[provider]?.test(key) ?? false;
}

/** Returns the access token for the current session, with E2E bypass support. */
async function getAccessToken(): Promise<string | null> {
  if (import.meta.env.DEV && window.localStorage.getItem(getE2EAuthFlag()) === "true") {
    return "e2e-access-token";
  }
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function saveUserApiKey(apiKey: string, provider: ApiProvider, model?: string): Promise<void> {
  // Validate format client-side before any network call
  if (!validateApiKeyFormat(apiKey, provider)) {
    throw new Error("INVALID_KEY_FORMAT");
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error("User session not found");
  }

  const { url: SUPABASE_URL, key: SUPABASE_KEY } = getSupabaseRuntimeConfig();

  // Check if we are in a mock Supabase environment
  if (!SUPABASE_URL || SUPABASE_URL.includes("mock.supabase.co")) {
    console.warn("Using local storage fallback for saveUserApiKey due to mock Supabase URL");
    localStorage.setItem("social_spark_user_api_key", apiKey);
    localStorage.setItem("social_spark_user_api_provider", provider);
    if (model) {
      localStorage.setItem("social_spark_user_api_model", model);
    } else {
      localStorage.removeItem("social_spark_user_api_model");
    }
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/encrypt-api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ apiKey, provider, model: model || undefined }),
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Edge function 'encrypt-api-key' not found (404)");
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Failed to save API key (${res.status})`);
  }
}

/**
 * Live-validates an API key by asking the server to make a minimal real call
 * to the provider. The raw key is sent to our own edge function only (over
 * HTTPS) and is never stored on this path. Returns whether the key works and,
 * when it doesn't, a human-readable reason to show the user.
 */
export async function validateUserApiKey(
  apiKey: string,
  provider: ApiProvider,
  model?: string
): Promise<{ valid: boolean; reason?: string }> {
  // Cheap client-side format gate first — avoids a network round-trip for
  // obviously malformed keys.
  if (!validateApiKeyFormat(apiKey, provider)) {
    return { valid: false, reason: "INVALID_KEY_FORMAT" };
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error("User session not found");
  }

  const { url: SUPABASE_URL, key: SUPABASE_KEY } = getSupabaseRuntimeConfig();

  // In a mock Supabase environment there is no provider to call — treat a
  // well-formed key as valid so local/E2E flows aren't blocked.
  if (!SUPABASE_URL || SUPABASE_URL.includes("mock.supabase.co")) {
    return { valid: true };
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/encrypt-api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: "validate", apiKey, provider, model: model || undefined }),
  });

  const data = await res.json().catch(() => ({} as { valid?: boolean; reason?: string }));

  if (res.status === 429) {
    return { valid: false, reason: "Too many checks. Please wait a moment and try again." };
  }
  if (!res.ok && typeof data?.valid !== "boolean") {
    return { valid: false, reason: data?.reason || `Validation failed (${res.status})` };
  }

  return { valid: Boolean(data?.valid ?? data?.success), reason: data?.reason };
}

/** Updates only the persisted model preference, without touching the stored key. */
export async function updateUserApiModel(model: string | null): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("User session not found");
  }

  const { url: SUPABASE_URL, key: SUPABASE_KEY } = getSupabaseRuntimeConfig();

  if (!SUPABASE_URL || SUPABASE_URL.includes("mock.supabase.co")) {
    if (model) {
      localStorage.setItem("social_spark_user_api_model", model);
    } else {
      localStorage.removeItem("social_spark_user_api_model");
    }
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/encrypt-api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: "update-model", model: model || undefined }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Failed to update model (${res.status})`);
  }
}

export async function getUserApiKey(): Promise<{
  apiKey: string | null;
  hasKey: boolean;
  provider: ApiProvider | null;
  apiModel?: string | null;
  useOwnKey: boolean;
  keyMode: 'fallback' | 'always';
  last4?: string | null;
  settingsError?: boolean;
}> {
  const token = await getAccessToken();
  if (!token) {
    return { apiKey: null, hasKey: false, provider: null, apiModel: null, useOwnKey: false, keyMode: 'fallback', settingsError: false };
  }

  const { url: SUPABASE_URL, key: SUPABASE_KEY } = getSupabaseRuntimeConfig();

  // Check if we are in a mock Supabase environment
  if (!SUPABASE_URL || SUPABASE_URL.includes("mock.supabase.co")) {
    const apiKey = localStorage.getItem("social_spark_user_api_key");
    const provider = localStorage.getItem("social_spark_user_api_provider") as ApiProvider | null;
    const apiModel = localStorage.getItem("social_spark_user_api_model");
    const useOwnKey = localStorage.getItem("social_spark_use_own_key") === "true";
    const keyMode = (localStorage.getItem("social_spark_key_mode") === "always" ? "always" : "fallback") as 'fallback' | 'always';
    return {
      apiKey,
      hasKey: !!apiKey,
      provider,
      apiModel: apiKey ? apiModel : null,
      useOwnKey: apiKey ? useOwnKey : false,
      keyMode,
      last4: apiKey ? apiKey.slice(-4) : null,
      settingsError: false,
    };
  }

  // Call the Edge Function to decrypt the key (which now returns metadata only)
  const decPromise = fetch(`${SUPABASE_URL}/functions/v1/decrypt-api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
  }).then(async (res) => {
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error("Edge function 'decrypt-api-key' not found (404)");
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Failed to retrieve API key (${res.status})`);
    }
    return res.json() as Promise<{ hasKey: boolean; provider: ApiProvider | null; apiModel?: string | null; last4?: string | null }>;
  });

  // Query the user_settings table for use_own_key and key_mode
  const settingsPromise = (supabase.from as unknown as (table: string) => ReturnType<typeof supabase.from>)("user_settings")
    .select("use_own_key, key_mode")
    .maybeSingle()
    .then(({ data, error }: { data: unknown; error: unknown }) => {
      if (error) throw error;
      const row = data as unknown as { use_own_key: boolean; key_mode?: string } | null;
      return {
        useOwnKey: row?.use_own_key || false,
        keyMode: (row?.key_mode === 'always' ? 'always' : 'fallback') as 'fallback' | 'always',
        settingsError: false,
      };
    }, (err: unknown) => {
      console.warn("USER_SETTINGS_SCHEMA_ERROR: Failed to query user_settings table.", err);
      return { useOwnKey: false, keyMode: 'fallback' as const, settingsError: true };
    });

  try {
    const [decrypted, settings] = await Promise.all([decPromise, settingsPromise]);

    return {
      apiKey: null, // SECURITY: raw plaintext key is never returned to frontend
      hasKey: decrypted.hasKey,
      provider: decrypted.provider,
      apiModel: decrypted.apiModel ?? null,
      useOwnKey: decrypted.hasKey ? settings.useOwnKey : false,
      keyMode: settings.keyMode,
      last4: decrypted.last4,
      settingsError: settings.settingsError,
    };
  } catch (err) {
    if (err instanceof TypeError && /Failed to fetch/i.test(err.message)) {
      console.warn("getUserApiKey: Supabase edge function is unreachable. Falling back to safe defaults.");
    } else {
      console.error("getUserApiKey failed:", err);
    }
    return {
      apiKey: null,
      hasKey: false,
      provider: null,
      apiModel: null,
      useOwnKey: false,
      keyMode: 'fallback',
      settingsError: true,
    };
  }
}

export async function getQuotaStatus(): Promise<{
  used: number;
  limit: number;
  useOwnKey: boolean;
  keyMode: 'fallback' | 'always';
  planPeriodEnd: string | null;
}> {
  const DEFAULT = { used: 0, limit: 10, useOwnKey: false, keyMode: 'fallback' as const, planPeriodEnd: null as string | null };

  const token = await getAccessToken();
  if (!token) return DEFAULT;

  const { url: SUPABASE_URL } = getSupabaseRuntimeConfig();

  // Check if we are in a mock Supabase environment
  if (!SUPABASE_URL || SUPABASE_URL.includes("mock.supabase.co")) {
    const used = Number(localStorage.getItem("social_spark_generation_count") || "0");
    const useOwnKey = localStorage.getItem("social_spark_use_own_key") === "true";
    const keyMode = (localStorage.getItem("social_spark_key_mode") === "always" ? "always" : "fallback") as 'fallback' | 'always';
    const now = new Date();
    const firstOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
    return { used, limit: 10, useOwnKey, keyMode, planPeriodEnd: firstOfNextMonth };
  }

  try {
    const { data, error } = await (supabase.from as unknown as (table: string) => ReturnType<typeof supabase.from>)("user_settings")
      .select("generation_count, quota_limit, use_own_key, key_mode, plan_period_end")
      .maybeSingle();
    if (error) throw error;
    const row = data as unknown as { generation_count?: number; quota_limit?: number; use_own_key?: boolean; key_mode?: string; plan_period_end?: string | null } | null;
    return {
      used: row?.generation_count ?? 0,
      limit: row?.quota_limit ?? 50,
      useOwnKey: row?.use_own_key || false,
      keyMode: (row?.key_mode === 'always' ? 'always' : 'fallback'),
      planPeriodEnd: row?.plan_period_end ?? null,
    };
  } catch (err) {
    console.warn("getQuotaStatus failed:", err);
    return DEFAULT;
  }
}

export async function setUseOwnKey(enabled: boolean, keyMode: 'fallback' | 'always' = 'fallback'): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("User session not found");
  }

  const { url: SUPABASE_URL, key: SUPABASE_KEY } = getSupabaseRuntimeConfig();

  // Check if we are in a mock Supabase environment
  if (!SUPABASE_URL || SUPABASE_URL.includes("mock.supabase.co")) {
    console.warn("Using local storage fallback for setUseOwnKey due to mock Supabase URL");
    localStorage.setItem("social_spark_use_own_key", enabled ? "true" : "false");
    localStorage.setItem("social_spark_key_mode", keyMode);
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/encrypt-api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: "toggle",
      useOwnKey: enabled,
      keyMode,
    }),
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Edge function 'encrypt-api-key' not found (404) for toggle");
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Failed to update settings (${res.status})`);
  }
}

export async function deleteUserApiKey(): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("User session not found");
  }

  const { url: SUPABASE_URL, key: SUPABASE_KEY } = getSupabaseRuntimeConfig();

  // Check if we are in a mock Supabase environment
  if (!SUPABASE_URL || SUPABASE_URL.includes("mock.supabase.co")) {
    console.warn("Using local storage fallback for deleteUserApiKey due to mock Supabase URL");
    localStorage.removeItem("social_spark_user_api_key");
    localStorage.removeItem("social_spark_user_api_provider");
    localStorage.removeItem("social_spark_user_api_model");
    localStorage.removeItem("social_spark_use_own_key");
    localStorage.removeItem("social_spark_key_mode");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Edge function 'delete-api-key' not found (404)");
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Failed to delete API key (${res.status})`);
  }
}
