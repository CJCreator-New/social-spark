// Workspace hashtag policy: normalize, ban, require.
// Used both to inject the policy into AI prompts (via edge functions)
// and as a client-side safety net so the final hashtags always comply.

import { resolvePlatform, PlatformKey } from "./platformCopy";

export interface HashtagPolicy {
  banned: string[];   // stored lowercase, no leading #
  required: string[]; // stored lowercase, no leading #
}

// Per-platform max tags we'll ever append (mirrors platformCopy intent).
const PLATFORM_MAX: Record<PlatformKey, number> = {
  facebook: 3,
  instagram: 15,
  linkedin: 5,
  twitter: 2,
  tiktok: 5,
};

// Long-form platforms shouldn't carry hashtags at all.
function isLongForm(platformInput?: string | null): boolean {
  const s = (platformInput || "").toLowerCase();
  return s.includes("newsletter") || s.includes("blog");
}

// Normalize a freeform tag input (with or without #, mixed case, surrounding chars)
// into a clean lowercase token without #.
export function normalizeTag(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/^#+/, "")
    .replace(/[^\w]/g, "")
    .toLowerCase();
}

// Parse a saved-tag list from any input (array or space/comma string).
export function parsePolicyList(input: string | string[] | null | undefined): string[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input.join(" ") : input;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\s,]+/)) {
    const tag = normalizeTag(part);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

// Display form (with leading #).
export function displayTag(tag: string): string {
  const t = normalizeTag(tag);
  return t ? `#${t}` : "";
}

// Apply the policy to a freeform hashtag string returned by the AI.
// - Strips banned tags.
// - Appends any missing required tags (up to platform max).
// - Returns space-separated string with single # prefix.
export function applyPolicy(
  rawHashtags: string | string[] | null | undefined,
  platformInput: string | null | undefined,
  policy: HashtagPolicy,
  lockedTags: string[] = [],
): string {
  if (isLongForm(platformInput)) return "";

  const platform = resolvePlatform(platformInput);
  const max = PLATFORM_MAX[platform];

  const bannedSet = new Set(policy.banned.map(normalizeTag).filter(Boolean));
  const requiredList = policy.required.map(normalizeTag).filter(Boolean);
  const lockedList = lockedTags.map(normalizeTag).filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();

  // 1) Locked tags ALWAYS appear first (and override the ban list — user explicit choice).
  for (const tag of lockedList) {
    if (out.length >= max) break;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }

  // 2) Existing AI-generated tags, dropping banned + already-locked.
  const sourceParts = Array.isArray(rawHashtags)
    ? rawHashtags.join(" ")
    : (rawHashtags || "");
  for (const part of sourceParts.split(/[\s,]+/)) {
    if (out.length >= max) break;
    const tag = normalizeTag(part);
    if (!tag || seen.has(tag) || bannedSet.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }

  // 3) Append required tags not already present (until we hit the platform max).
  for (const tag of requiredList) {
    if (out.length >= max) break;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }

  return out.slice(0, max).map(displayTag).join(" ");
}

/** Parse the rendered hashtag string back into normalized tokens. */
export function parseHashtagsString(input: string | null | undefined): string[] {
  return parsePolicyList(input);
}

