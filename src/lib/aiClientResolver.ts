import { getUserApiKey } from "./apiKeyManager";

export async function resolveAiClient(
  platformAvailable: boolean
): Promise<{ apiKey: string; provider: 'openai' | 'anthropic' | 'openrouter'; source: 'platform' | 'user' }> {
  if (platformAvailable) {
    const platformKey = (import.meta.env.VITE_PLATFORM_AI_KEY as string) || "";
    if (platformKey) {
      // The platform uses OpenRouter / OpenAI or whatever. Let's default it to 'openai' or infer if we need.
      // The task says: return platform key from env VITE_PLATFORM_AI_KEY
      return {
        apiKey: platformKey,
        provider: "openai", // default platform provider
        source: "platform",
      };
    }
  }

  // Fallback to user-supplied key
  const userKeyInfo = await getUserApiKey();
  if (userKeyInfo.useOwnKey && userKeyInfo.apiKey && userKeyInfo.provider) {
    return {
      apiKey: userKeyInfo.apiKey,
      provider: userKeyInfo.provider,
      source: "user",
    };
  }

  throw new Error("AI_UNAVAILABLE");
}
