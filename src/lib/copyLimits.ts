// Shared character counting + copy sanitising for the editor and copy/export.
import { PLATFORM_LIMITS, resolvePlatform, type PlatformKey } from "./platformCopy";

export const X_URL_WEIGHT = 23;
const URL_RE = /https?:\/\/\S+/g;

export type LimitState = "ok" | "near" | "over";

function toKey(platform: string): PlatformKey {
  return platform in PLATFORM_LIMITS ? (platform as PlatformKey) : resolvePlatform(platform);
}

/** Weighted length: on X every URL counts as 23 characters. Code points, not UTF-16 units. */
export function countPlatformChars(text: string, platform: string): number {
  const src = text || "";
  if (toKey(platform) !== "twitter") return Array.from(src).length;
  let urls = 0;
  const rest = src.replace(URL_RE, () => {
    urls += 1;
    return "";
  });
  return Array.from(rest).length + urls * X_URL_WEIGHT;
}

export function platformLimitStatus(
  text: string,
  platform: string
): { count: number; limit: number; state: LimitState } {
  const limit = PLATFORM_LIMITS[toKey(platform)];
  const count = countPlatformChars(text, platform);
  const state: LimitState = count > limit ? "over" : count >= limit * 0.9 ? "near" : "ok";
  return { count, limit, state };
}

/** Remove markdown emphasis markers; leaves '* ' line-start bullets and hashtags alone. */
export function sanitizeCopy(text: string): string {
  if (!text) return "";
  let s = text;
  s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, "$1");
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  s = s.replace(/(^|[^\w_])__([^_\n]+)__(?=[^\w_]|$)/gm, "$1$2");
  // Single markers hugging text; a bullet has a space after '*' so it never matches.
  s = s.replace(/(^|[^\w*])\*(?!\s)([^*\n]*[^*\s])\*(?=[^\w*]|$)/gm, "$1$2");
  s = s.replace(/(^|[^\w_])_(?!\s)([^_\n]*[^_\s])_(?=[^\w_]|$)/gm, "$1$2");
  return s;
}
