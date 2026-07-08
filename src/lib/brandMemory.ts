import { resolveFunctionsBaseUrl } from "@/lib/functionsBaseUrl";

/**
 * Minimal shape shared by anything that can act as a "brand identity" source
 * for prompt assembly — currently satisfied structurally by both
 * `ProfileRow` (legacy single-brand-per-user fields) and `BrandSlotRow`
 * (see src/hooks/queries/shared.ts, part of the brand-slots feature). Keeping
 * this interface minimal (rather than importing either concrete row type)
 * lets both call sites pass their row directly with no mapping step.
 */
export interface BrandIdentityFields {
  forbidden_phrases?: string[] | null;
  proof_points?: string[] | null;
  cta_preferences?: string[] | null;
  preferred_structures?: string[] | null;
}

/**
 * Checks if the user has configured any brand memory elements in their profile.
 */
export function hasBrandMemory(profile?: BrandIdentityFields | null): boolean {
  if (!profile) return false;

  const hasForbidden =
    Array.isArray(profile.forbidden_phrases) && profile.forbidden_phrases.length > 0;
  const hasProof = Array.isArray(profile.proof_points) && profile.proof_points.length > 0;
  const hasCta = Array.isArray(profile.cta_preferences) && profile.cta_preferences.length > 0;
  const hasStructures =
    Array.isArray(profile.preferred_structures) && profile.preferred_structures.length > 0;

  return hasForbidden || hasProof || hasCta || hasStructures;
}

/**
 * Builds a prompt snippet enforcing brand identity based on profile settings.
 */
export function buildBrandMemoryPrompt(profile?: BrandIdentityFields | null): string {
  if (!profile || !hasBrandMemory(profile)) return "";

  const sections: string[] = ["### BRAND MEMORY & IDENTITY CONSTRAINTS"];

  if (Array.isArray(profile.forbidden_phrases) && profile.forbidden_phrases.length > 0) {
    sections.push(
      `- FORBIDDEN PHRASES (NEVER USE): ${profile.forbidden_phrases.map((p) => `"${p}"`).join(", ")}`
    );
  }

  if (Array.isArray(profile.proof_points) && profile.proof_points.length > 0) {
    sections.push("- PROOF POINTS & KEY DATA (WEAVE THESE IN WHERE NATURAL):");
    profile.proof_points.forEach((point) => {
      sections.push(`  * ${point}`);
    });
  }

  if (Array.isArray(profile.cta_preferences) && profile.cta_preferences.length > 0) {
    sections.push(
      `- PREFERRED CTA PATTERNS: Use call-to-action styles matching: ${profile.cta_preferences.join(", ")}`
    );
  }

  if (Array.isArray(profile.preferred_structures) && profile.preferred_structures.length > 0) {
    sections.push(
      `- PREFERRED WRITING STRUCTURES: Align content formats to: ${profile.preferred_structures.join(", ")}`
    );
  }

  return sections.join("\n");
}

/**
 * Executes an AI generation call with platform-to-user-key fallback.
 */
import { resolveAiClient } from "./aiClientResolver";
import { supabase } from "@/integrations/supabase/client";

export interface AiGenerationRequestBody {
  [key: string]: unknown;
  userApiKey?: string;
  userApiProvider?: string | null;
}

/**
 * Errors that indicate a client/validation/quota problem — these should surface
 * directly to the user and NOT trigger the user-key fallback path.
 * Fallback should only happen for infrastructure failures (network, 5xx, 429).
 */
const NON_FALLBACK_ERRORS = [
  "Missing core idea",
  "Missing core idea or topics",
  "Sign in required",
  "Unauthorized",
  "QUOTA_EXCEEDED",
  "UPGRADE_REQUIRED",
  "Rate limit exceeded",
  "Request body too large",
  "Invalid request",
  "AI is not configured", // server-side platform key missing
  "PLATFORM_UNAVAILABLE", // entire provider waterfall exhausted — surface directly
  "All platform AI providers", // same error, string-prefix match
];

function isNonFallbackError(message: string): boolean {
  return NON_FALLBACK_ERRORS.some(
    (prefix) => message.startsWith(prefix) || message.includes(prefix)
  );
}

export async function generateWithFallback<T = unknown>(
  endpoint: string,
  body: AiGenerationRequestBody,
  abortSignal?: AbortSignal
): Promise<{ data: T; usedFallback: boolean; keyMode: "always" | "fallback" | null }> {
  const SUPABASE_URL = resolveFunctionsBaseUrl((import.meta.env.VITE_SUPABASE_URL as string) || "");
  const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";
  if (!SUPABASE_KEY) {
    console.error(
      "generateWithFallback: VITE_SUPABASE_PUBLISHABLE_KEY is missing or empty. " +
        "Requests to Supabase Edge Functions will fail with 401 Unauthorized. " +
        "Check your .env configuration."
    );
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };

  // Resolve user key settings upfront (needed to check key_mode).
  // Swallow any network errors here — key lookup failure is not fatal at this stage.
  const userKeyInfo = await resolveAiClient(false).catch(() => null);

  // If user has configured "always use my key", inject immediately and skip platform
  if (userKeyInfo && userKeyInfo.source === "user") {
    const alwaysBody = {
      ...body,
      userApiKey: userKeyInfo.apiKey,
      userApiProvider: userKeyInfo.provider,
    };
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(alwaysBody),
      signal: abortSignal,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error || `Generation failed (${res.status})`);
    }
    const data = await res.json();
    if (data?.error) throw new Error(data.error);
    return { data, usedFallback: true, keyMode: "always" };
  }

  // Platform path
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    // 4xx client errors (validation, auth, quota) — surface directly, do NOT fall back
    if (!res.ok && res.status >= 400 && res.status < 500) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error || `Request failed (${res.status})`);
    }

    if (!res.ok && (res.status === 429 || res.status >= 500)) {
      throw new Error(`Platform failed with status ${res.status}`);
    }

    const data = await res.json();
    if (data?.error === "QUOTA_EXCEEDED" || data?.error === "UPGRADE_REQUIRED") {
      throw new Error(data.message || data.error);
    }
    // Treat validation/auth errors returned in a 200 body as non-fallback errors
    if (data?.error && isNonFallbackError(String(data.error))) {
      throw new Error(data.error);
    }
    if (data?.error) {
      throw new Error(data.error);
    }

    return { data, usedFallback: false, keyMode: null };
  } catch (err) {
    // If request was aborted by user, don't fallback, just throw the abort error
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }

    const errMessage = err instanceof Error ? err.message : String(err);

    // Validation/auth/quota errors must surface directly — no point trying a different key
    if (isNonFallbackError(errMessage)) {
      throw err;
    }

    console.warn(`Platform AI call failed (${errMessage}). Attempting fallback key...`);

    // Platform failed — try user key as fallback (infrastructure failure only)
    let fallbackClient: Awaited<ReturnType<typeof resolveAiClient>>;
    try {
      fallbackClient = await resolveAiClient(false);
    } catch {
      // No fallback key available
      throw new Error("AI_UNAVAILABLE");
    }

    const fallbackBody = {
      ...body,
      userApiKey: fallbackClient.apiKey,
      userApiProvider: fallbackClient.provider,
    };

    const res = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(fallbackBody),
      signal: abortSignal,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Fallback generation failed (${res.status})`);
    }

    const data = await res.json();
    if (data?.error) {
      throw new Error(data.error);
    }

    return { data, usedFallback: true, keyMode: "fallback" };
  }
}
