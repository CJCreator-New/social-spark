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
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Failed to save API key (${res.status})`);
  }
}

export async function getUserApiKey(): Promise<{ apiKey: string | null; provider: 'openai' | 'anthropic' | 'openrouter' | null; useOwnKey: boolean }> {
  const token = await getAccessToken();
  if (!token) {
    return { apiKey: null, provider: null, useOwnKey: false };
  }

  const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
  const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";

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
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Failed to retrieve API key (${res.status})`);
    }
    return res.json() as Promise<{ apiKey: string | null; provider: 'openai' | 'anthropic' | 'openrouter' | null }>;
  });

  // Query the user_settings table to check if use_own_key is enabled
  const settingsPromise = supabase
    .from("user_settings" as any)
    .select("use_own_key")
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) throw error;
      return (data as unknown as { use_own_key: boolean } | null)?.use_own_key || false;
    });

  const [decrypted, useOwnKey] = await Promise.all([decPromise, settingsPromise]);

  return {
    apiKey: decrypted.apiKey,
    provider: decrypted.provider,
    useOwnKey,
  };
}

export async function setUseOwnKey(enabled: boolean): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("User session not found");
  }

  const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
  const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";

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
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Failed to update settings (${res.status})`);
  }
}

export async function deleteUserApiKey(): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("User session not found");
  }

  const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
  const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";

  const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Failed to delete API key (${res.status})`);
  }
}
