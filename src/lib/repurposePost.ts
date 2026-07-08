import { resolvePlatform } from "@/lib/platformCopy";
import { EMPTY_POST, type Post } from "@/components/wizard/constants";
import type {
  GeneratePostImagePayload,
  GeneratedPostPayload,
  RepurposePayload,
} from "@/hooks/queries/shared";

/**
 * Shared helper for turning a raw edge-function response (or any loosely-typed
 * object) into a `Post`. Used by both the single-post regenerate/repurpose
 * flows and the bulk repurpose flow in CalendarDetail.tsx — keep this the one
 * source of truth so both stay in sync.
 */
export function unwrapPost(value: unknown): Post | null {
  if (!value || typeof value !== "object") return null;
  const candidate = "post" in value ? (value as { post?: unknown }).post : value;
  if (!candidate || typeof candidate !== "object") return null;
  const post = candidate as Partial<Post>;
  return typeof post.day === "number" && typeof post.dow === "string"
    ? { ...EMPTY_POST, ...post }
    : null;
}

export function aspectRatioForPlatform(platform?: string): string {
  const normalized = resolvePlatform(platform || "");
  if (normalized === "instagram") return "4:5";
  if (normalized === "twitter") return "16:9";
  if (normalized === "facebook") return "1.91:1";
  return "1.91:1";
}

export type RepurposeImageResult = {
  publicUrl?: string;
  storagePath?: string;
  aspectRatio?: string;
  generatedAt?: string;
} | null | undefined;

export type RepurposeStage = "" | "rewriting" | "scoring" | "illustrating";

export interface RepurposeOnePostDeps {
  /** Calendar id — image generation is skipped entirely when absent (matches single-post flow). */
  calendarId?: string;
  platform: string;
  formPayload: {
    industry?: string;
    voice?: string;
    style?: string;
    goals?: string[];
    platform?: string;
  };
  repurposeMutateAsync: (payload: RepurposePayload) => Promise<unknown>;
  generateImageMutateAsync: (payload: GeneratePostImagePayload) => Promise<RepurposeImageResult>;
  onStageChange?: (stage: RepurposeStage) => void;
  /** Non-blocking — the caller decides how (or whether) to surface an illustration failure. */
  onImageError?: (error: unknown) => void;
}

export interface RepurposeOnePostResult {
  post?: Post;
  error?: string;
}

/**
 * Rewrites a single post for a target platform, scores it (client-side —
 * handled by the caller re-rendering with the returned post), and best-effort
 * generates an illustrative cover image. Returns a result object instead of
 * mutating any component/global state so it is safe to call concurrently from
 * the bulk-repurpose queue as well as the single-post repurpose menu.
 */
export async function repurposeOnePost(
  sourcePost: Post,
  targetPlatform: string,
  deps: RepurposeOnePostDeps
): Promise<RepurposeOnePostResult> {
  const {
    calendarId,
    platform,
    formPayload,
    repurposeMutateAsync,
    generateImageMutateAsync,
    onStageChange,
    onImageError,
  } = deps;

  try {
    onStageChange?.("rewriting");
    const payload: RepurposePayload = {
      post: sourcePost as unknown as GeneratedPostPayload,
      targetPlatform,
      platform: platform || formPayload.platform || "LinkedIn",
      context: {
        industry: formPayload.industry || "",
        voice: formPayload.voice || "",
        style: formPayload.style || "",
        goals: formPayload.goals || [],
      },
    };

    const data = await repurposeMutateAsync(payload);
    const result = unwrapPost(data);
    if (!result) {
      return { error: "Failed to parse repurposed post" };
    }

    let repurposed: Post = {
      ...result,
      day: sourcePost.day,
      dow: sourcePost.dow,
      image_url: undefined,
      image_storage_path: undefined,
      image_generated_at: undefined,
    };

    // Step 2: score the repurposed variant (client-side, instant; PerformanceScoreCard
    // recomputes on render — nothing to await here, this stage is purely informational).
    onStageChange?.("scoring");

    // Step 3: generate an illustrative image for the repurposed variant, best-effort.
    if (calendarId && repurposed.image_prompt) {
      onStageChange?.("illustrating");
      try {
        const aspectRatio = aspectRatioForPlatform(targetPlatform);
        const imgResult = await generateImageMutateAsync({
          calendarId,
          postDay: sourcePost.day,
          post: repurposed as unknown as GeneratedPostPayload,
          prompt: repurposed.image_prompt,
          platform: targetPlatform,
          aspectRatio,
        });
        if (imgResult?.publicUrl) {
          repurposed = {
            ...repurposed,
            image_url: String(imgResult.publicUrl || ""),
            image_storage_path: String(imgResult.storagePath || ""),
            image_aspect_ratio: String(imgResult.aspectRatio || aspectRatio),
            image_generated_at: String(imgResult.generatedAt || new Date().toISOString()),
          };
        }
      } catch (imgErr) {
        // Image generation is an enhancement, not a blocker — text is still usable.
        onImageError?.(imgErr);
      }
    }

    return { post: repurposed };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Repurpose failed" };
  } finally {
    onStageChange?.("");
  }
}

/** True if an error message indicates the per-user rate limit or generation quota was hit. */
export function isQuotaOrRateLimitError(message: string | undefined | null): boolean {
  if (!message) return false;
  return (
    message.includes("QUOTA_EXCEEDED") ||
    message.includes("UPGRADE_REQUIRED") ||
    /rate limit/i.test(message)
  );
}
