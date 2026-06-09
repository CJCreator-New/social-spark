import { getUserApiKey } from "./apiKeyManager";

export async function resolveAiClient(
  platformAvailable: boolean
): Promise<{ apiKey: string; provider: 'openai' | 'anthropic' | 'openrouter'; source: 'platform' | 'user' }> {
  // Platform path (used when platformAvailable=true or keyMode='fallback')
  if (platformAvailable) {
    const platformKey = (import.meta.env.VITE_PLATFORM_AI_KEY as string) || "";
    if (platformKey) {
      return {
        apiKey: platformKey,
        provider: "openai",
        source: "platform",
      };
    }
  }

  // Fetch user key settings once
  const userKeyInfo = await getUserApiKey();

  // If the user has configured "always use my key", bypass the platform entirely
  if (userKeyInfo.useOwnKey && userKeyInfo.keyMode === 'always' && userKeyInfo.apiKey && userKeyInfo.provider) {
    return {
      apiKey: userKeyInfo.apiKey,
      provider: userKeyInfo.provider,
      source: "user",
    };
  }

  // Fallback to user-supplied key (only when useOwnKey is enabled and key exists)
  if (userKeyInfo.useOwnKey && userKeyInfo.apiKey && userKeyInfo.provider) {
    return {
      apiKey: userKeyInfo.apiKey,
      provider: userKeyInfo.provider,
      source: "user",
    };
  }

  throw new Error("AI_UNAVAILABLE");
}
