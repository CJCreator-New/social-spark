import { getUserApiKey, type ApiProvider } from "./apiKeyManager";

const VALID_PROVIDERS: readonly ApiProvider[] = [
  "openai",
  "anthropic",
  "openrouter",
  "gemini",
  "kimi",
  "glm",
];

function isApiProvider(value: string): value is ApiProvider {
  return (VALID_PROVIDERS as readonly string[]).includes(value);
}

// NOTE: any import.meta.env.VITE_* value is inlined into the client bundle at
// build time and is world-readable. VITE_PLATFORM_AI_KEY must never actually
// hold a live secret in a production build — this path exists for local/E2E
// use only. Real platform-key generation happens server-side in the edge
// functions, which is why every current call site passes platformAvailable=false.
export async function resolveAiClient(platformAvailable: boolean): Promise<
  | { apiKey: string; provider: ApiProvider; source: "platform" }
  // BYOK keys are decrypted server-side only (see api_key_security_hardening
  // migration) — getUserApiKey() never returns the plaintext key to the
  // client, so there is nothing real to put in `apiKey` for the user-key
  // path. Callers must invoke the server (edge function) for user-keyed
  // generations and cannot send a client-side Authorization header for them.
  | { apiKey?: undefined; provider: ApiProvider; source: "user" }
> {
  // Platform path (used when platformAvailable=true or keyMode='fallback')
  if (platformAvailable) {
    const platformKey = (import.meta.env.VITE_PLATFORM_AI_KEY as string) || "";
    if (platformKey) {
      // The platform key is the Lovable AI Gateway (Gemini-family), not OpenAI —
      // hardcoding "openai" here made telemetry/model-selection/error-mapping
      // report the wrong provider. Default to "gemini" but allow override via a
      // non-secret env var, validated against the ApiProvider union.
      const rawProvider = (import.meta.env.VITE_PLATFORM_AI_PROVIDER as string) || "gemini";
      const provider: ApiProvider = isApiProvider(rawProvider) ? rawProvider : "gemini";
      return {
        apiKey: platformKey,
        provider,
        source: "platform",
      };
    }
  }

  // Fetch user key settings once
  const userKeyInfo = await getUserApiKey();

  // If the user has configured "always use my key", bypass the platform entirely
  if (
    userKeyInfo.useOwnKey &&
    userKeyInfo.keyMode === "always" &&
    userKeyInfo.hasKey &&
    userKeyInfo.provider
  ) {
    return {
      provider: userKeyInfo.provider,
      source: "user",
    };
  }

  // Fallback to user-supplied key (only when useOwnKey is enabled and key exists)
  if (userKeyInfo.useOwnKey && userKeyInfo.hasKey && userKeyInfo.provider) {
    return {
      provider: userKeyInfo.provider,
      source: "user",
    };
  }

  throw new Error("AI_UNAVAILABLE");
}
