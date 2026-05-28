// Per-post health insights: char usage, hashtag density, within-limit status.
// Pure client-side, computed from a post + its target platform.

import { formatForPlatform, resolvePlatform, niceLabelFor, PlatformKey, PostLike } from "./platformCopy";

export type LimitState = "ok" | "warn" | "over";
export type DensityState = "sweet" | "sparse" | "dense" | "na";
export type HealthState = "good" | "warn" | "bad";

export interface PostInsights {
  charCount: number;
  charLimit: number;
  charPct: number;
  limitState: LimitState;
  hashtagCount: number;
  hashtagState: DensityState;
  hashtagLabel: string;
  health: HealthState;
  platformLabel: string;
  hookScore: number;
  recommendations: string[];
}

// Sweet-spot ranges per platform (min, max). Outside = sparse / dense.
const HASHTAG_RANGE: Record<PlatformKey, [number, number]> = {
  linkedin: [3, 5],
  instagram: [8, 15],
  twitter: [1, 2],
  facebook: [0, 3],
};

function isLongForm(p?: string | null): boolean {
  const s = (p || "").toLowerCase();
  return s.includes("newsletter") || s.includes("blog");
}

function countTags(input: string | string[] | undefined | null): number {
  if (!input) return 0;
  const raw = Array.isArray(input) ? input.join(" ") : input;
  return raw
    .split(/[\s,]+/)
    .map(t => t.trim().replace(/^#+/, ""))
    .filter(t => t.length > 1).length;
}

export function insightFor(post: PostLike, platformInput?: string | null): PostInsights {
  const f = formatForPlatform(post, platformInput);
  const platform = resolvePlatform(platformInput);
  const platformLabel = niceLabelFor(platformInput);

  const ratio = f.charCount / f.limit;
  const limitState: LimitState =
    f.charCount > f.limit ? "over" : ratio >= 0.9 ? "warn" : "ok";

  const longForm = isLongForm(platformInput);
  const hashtagCount = countTags(post.hashtags);

  let hashtagState: DensityState;
  let hashtagLabel: string;
  if (longForm) {
    hashtagState = "na";
    hashtagLabel = "no tags needed";
  } else {
    const [min, max] = HASHTAG_RANGE[platform];
    if (hashtagCount < min) {
      hashtagState = "sparse";
      hashtagLabel = `${hashtagCount} tag${hashtagCount === 1 ? "" : "s"} · sparse`;
    } else if (hashtagCount > max) {
      hashtagState = "dense";
      hashtagLabel = `${hashtagCount} tags · dense`;
    } else {
      hashtagState = "sweet";
      hashtagLabel = `${hashtagCount} tag${hashtagCount === 1 ? "" : "s"} · sweet spot`;
    }
  }

  // Overall health rolls up the worst signal.
  let health: HealthState = "good";
  if (limitState === "over" || hashtagState === "dense") health = "bad";
  else if (limitState === "warn" || hashtagState === "sparse") health = "warn";

  const hook = String(post.hook || post.title || "").trim();
  const hookScore = Math.min(
    1,
    [
      hook.length >= 35 && hook.length <= 180,
      /[0-9%$]/.test(hook),
      /[?]/.test(hook) || /\b(how|why|what|when|stop|start|before|after)\b/i.test(hook),
      !/^(here'?s|in this post|today|let'?s)/i.test(hook),
    ].filter(Boolean).length / 4
  );

  const recommendations: string[] = [];
  if (limitState === "over") recommendations.push(`Trim for ${platformLabel}; this version exceeds the platform limit.`);
  else if (limitState === "warn") recommendations.push("Consider tightening the copy before publishing.");
  if (hashtagState === "sparse") recommendations.push(`Add a few relevant hashtags for ${platformLabel}.`);
  if (hashtagState === "dense") recommendations.push("Reduce hashtags so the post feels less crowded.");
  if (hookScore < 0.5) recommendations.push("Strengthen the hook with a sharper claim, question, or concrete number.");

  return {
    charCount: f.charCount,
    charLimit: f.limit,
    charPct: Math.round(ratio * 100),
    limitState,
    hashtagCount,
    hashtagState,
    hashtagLabel,
    health,
    platformLabel,
    hookScore,
    recommendations,
  };
}
