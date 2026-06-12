import { supabase } from "@/integrations/supabase/client";
import { getE2EAuthFlag } from "@/lib/e2eFixtures";

/**
 * Validates the API key format client-side before any network calls.
 * - OpenAI: sk-followed by at least 32 alphanumeric characters
 * - Anthropic: sk-ant- followed by at least 32 alphanumeric characters and hyphens
 * - OpenRouter: sk-or- followed by at least 32 alphanumeric characters and hyphens
 */
export function validateApiKeyFormat(key: string, provider: 'openai' | 'anthropic' | 'openrouter'): boolean {
  const patterns = {
    // OpenAI: sk- followed by alphanumeric and hyphens, min 20 total chars (covers sk-proj-... variants)
    openai: /^sk-[a-zA-Z0-9-]{20,}$/,
    // Anthropic: sk-ant- followed by alphanumeric and hyphens, min 32 chars after prefix
    anthropic: /^sk-ant-[a-zA-Z0-9-]{32,}$/,
    // OpenRouter: sk-or- followed by alphanumeric and hyphens, min 32 chars after prefix
    openrouter: /^sk-or-[a-zA-Z0-9-]{32,}$/,
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

export async function saveUserApiKey(apiKey: string, provider: 'openai' | 'anthropic' | 'openrouter'): Promise<void> {
  // Validate format client-side before any network call
  if (!validateApiKeyFormat(apiKey, provider)) {
    throw new Error("INVALID_KEY_FORMAT");
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error("User session not found");
  }

  const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
  const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";

  // Check if we are in a mock Supabase environment
  if (!SUPABASE_URL || SUPABASE_URL.includes("mock.supabase.co")) {
    console.warn("Using local storage fallback for saveUserApiKey due to mock Supabase URL");
    localStorage.setItem("social_spark_user_api_key", apiKey);
    localStorage.setItem("social_spark_user_api_provider", provider);
    return;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/encrypt-api-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ apiKey, provider }),
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error("Edge function 'encrypt-api-key' not found (404)");
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Failed to save API key (${res.status})`);
    }
  } catch (err) {
    throw err;
  }
}

export async function getUserApiKey(): Promise<{
  apiKey: string | null;
  provider: 'openai' | 'anthropic' | 'openrouter' | null;
  useOwnKey: boolean;
  keyMode: 'fallback' | 'always';
}> {
  const token = await getAccessToken();
  if (!token) {
    return { apiKey: null, provider: null, useOwnKey: false, keyMode: 'fallback' };
  }

  const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
  const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";

  // Check if we are in a mock Supabase environment
  if (!SUPABASE_URL || SUPABASE_URL.includes("mock.supabase.co")) {
    const apiKey = localStorage.getItem("social_spark_user_api_key");
    const provider = localStorage.getItem("social_spark_user_api_provider") as 'openai' | 'anthropic' | 'openrouter' | null;
    const useOwnKey = localStorage.getItem("social_spark_use_own_key") === "true";
    const keyMode = (localStorage.getItem("social_spark_key_mode") === "always" ? "always" : "fallback") as 'fallback' | 'always';
    return {
      apiKey,
      provider,
      useOwnKey: apiKey ? useOwnKey : false,
      keyMode,
    };
  }

  // Call the Edge Function to decrypt the key
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
    return res.json() as Promise<{ apiKey: string | null; provider: 'openai' | 'anthropic' | 'openrouter' | null }>;
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
      };
    }).catch((err: unknown) => {
      console.warn("Failed to query user_settings table.", err);
      return { useOwnKey: false, keyMode: 'fallback' as const };
    });

  try {
    const [decrypted, settings] = await Promise.all([decPromise, settingsPromise]);
    const hasKey = !!decrypted.apiKey;

    return {
      apiKey: decrypted.apiKey,
      provider: decrypted.provider,
      useOwnKey: hasKey ? settings.useOwnKey : false,
      keyMode: settings.keyMode,
    };
  } catch (err) {
    console.error("getUserApiKey failed:", err);
    return {
      apiKey: null,
      provider: null,
      useOwnKey: false,
      keyMode: 'fallback',
    };
  }
}

export async function setUseOwnKey(enabled: boolean, keyMode: 'fallback' | 'always' = 'fallback'): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("User session not found");
  }

  const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
  const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";

  // Check if we are in a mock Supabase environment
  if (!SUPABASE_URL || SUPABASE_URL.includes("mock.supabase.co")) {
    console.warn("Using local storage fallback for setUseOwnKey due to mock Supabase URL");
    localStorage.setItem("social_spark_use_own_key", enabled ? "true" : "false");
    localStorage.setItem("social_spark_key_mode", keyMode);
    return;
  }

  try {
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
  } catch (err) {
    throw err;
  }
}

export async function deleteUserApiKey(): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("User session not found");
  }

  const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
  const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";

  // Check if we are in a mock Supabase environment
  if (!SUPABASE_URL || SUPABASE_URL.includes("mock.supabase.co")) {
    console.warn("Using local storage fallback for deleteUserApiKey due to mock Supabase URL");
    localStorage.removeItem("social_spark_user_api_key");
    localStorage.removeItem("social_spark_user_api_provider");
    localStorage.removeItem("social_spark_use_own_key");
    localStorage.removeItem("social_spark_key_mode");
    return;
  }

  try {
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
  } catch (err) {
    throw err;
  }
}
