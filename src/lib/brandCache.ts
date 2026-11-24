/**
 * Browser cache for brand data plus the one-time local -> profile migration.
 *
 * The profile brand slot is the source of truth. This module only:
 *  - reads/writes a localStorage copy (same key the wizard has always used), and
 *  - merges any local-only fields into an empty profile slot, once.
 * Every storage access is wrapped in try/catch; storage can be missing or corrupt.
 */
import { BRAND_MEMORY_PREFIX } from "@/components/wizard/constants";
import type { BrandPromptInput } from "@/lib/brandPrompt";
import type { BrandSlotUpdate } from "@/hooks/queries/shared";

/** Shape the wizard has always stored locally. */
export interface LocalBrandMemory {
  voice?: string;
  style?: string;
  copyStyle?: string;
  cta?: string;
  audiences?: string[];
  goals?: string[];
  bannedWords?: string[];
  requiredWords?: string[];
  bannedHashtags?: string[];
  requiredHashtags?: string[];
  updatedAt?: number;
}

export const BRAND_MIGRATION_KEY_PREFIX = "brand-migration:v1:";

function userKey(userId?: string | null) {
  return userId || "guest";
}

export function brandCacheKey(userId?: string | null) {
  return `${BRAND_MEMORY_PREFIX}${userKey(userId)}`;
}

export function brandMigrationKey(userId?: string | null) {
  return `${BRAND_MIGRATION_KEY_PREFIX}${userKey(userId)}`;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v ?? "").trim()).filter(Boolean) : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Reads the cached brand data. Returns null when missing or corrupt. */
export function readBrandCache(userId?: string | null): LocalBrandMemory | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(brandCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      voice: str(parsed.voice),
      style: str(parsed.style),
      copyStyle: str(parsed.copyStyle),
      cta: str(parsed.cta),
      audiences: strings(parsed.audiences),
      goals: strings(parsed.goals),
      bannedWords: strings(parsed.bannedWords),
      requiredWords: strings(parsed.requiredWords),
      bannedHashtags: strings(parsed.bannedHashtags),
      requiredHashtags: strings(parsed.requiredHashtags),
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : undefined,
    };
  } catch {
    return null;
  }
}

/** Writes the cache. Best effort; never throws. */
export function writeBrandCache(userId: string | null | undefined, data: LocalBrandMemory) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      brandCacheKey(userId),
      JSON.stringify({ ...data, updatedAt: data.updatedAt ?? Date.now() })
    );
  } catch {
    /* best effort */
  }
}

export function clearBrandCache(userId: string | null | undefined) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(brandCacheKey(userId));
  } catch {
    /* best effort */
  }
}

/** Cache -> builder input (so the cache can fill gaps in the slot). */
export function cacheToBrandInput(cache?: LocalBrandMemory | null): BrandPromptInput | null {
  if (!cache) return null;
  return {
    voice: cache.voice,
    style: cache.style,
    copy_style: cache.copyStyle,
    audiences: cache.audiences,
    goals: cache.goals,
    forbidden_phrases: cache.bannedWords,
    required_phrases: cache.requiredWords,
    cta_preferences: cache.cta ? [cache.cta] : [],
    banned_hashtags: cache.bannedHashtags,
    required_hashtags: cache.requiredHashtags,
  };
}

/** Slot -> cache (write-through after a profile save). Keeps existing cache-only fields. */
export function slotToCache(
  slot: BrandPromptInput,
  previous?: LocalBrandMemory | null
): LocalBrandMemory {
  return {
    ...(previous ?? {}),
    voice: str(slot.voice),
    style: str(slot.style),
    cta: strings(slot.cta_preferences)[0] ?? "",
    audiences: strings(slot.audiences),
    goals: strings(slot.goals),
    bannedWords: strings(slot.forbidden_phrases),
    requiredWords: strings(slot.required_phrases),
    bannedHashtags: strings(slot.banned_hashtags),
    requiredHashtags: strings(slot.required_hashtags),
    updatedAt: Date.now(),
  };
}

export type BrandSlotPatch = Pick<
  BrandSlotUpdate,
  | "voice"
  | "style"
  | "audiences"
  | "goals"
  | "forbidden_phrases"
  | "required_phrases"
  | "cta_preferences"
  | "banned_hashtags"
  | "required_hashtags"
>;

function isMigrated(userId?: string | null): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage.getItem(brandMigrationKey(userId));
  } catch {
    return false;
  }
}

function markMigrated(userId?: string | null) {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(brandMigrationKey(userId), String(Date.now()));
    }
  } catch {
    /* best effort */
  }
}

/** Lets a caller retry the migration when persisting the patch failed. */
export function resetBrandMigration(userId?: string | null) {
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(brandMigrationKey(userId));
  } catch {
    /* best effort */
  }
}

/**
 * One-time migration of local-only brand fields into the profile slot.
 *
 * Returns the patch to save on the slot: only fields that are empty on the
 * profile and non-empty locally. Never overwrites a non-empty profile field.
 * Marks the versioned key on the first call, so later calls return {}. When
 * persisting the patch fails, call `resetBrandMigration` so it can retry.
 */
export function migrateLocalBrandToProfile(
  localData: LocalBrandMemory | null | undefined,
  profileSlot: BrandPromptInput | null | undefined,
  userId?: string | null
): BrandSlotPatch {
  if (isMigrated(userId)) return {};
  markMigrated(userId);
  if (!localData || !profileSlot) return {};

  const local = cacheToBrandInput(localData);
  if (!local) return {};
  const patch: BrandSlotPatch = {};

  for (const key of ["voice", "style"] as const) {
    if (!str(profileSlot[key]) && str(local[key])) patch[key] = str(local[key]);
  }
  for (const key of [
    "audiences",
    "goals",
    "forbidden_phrases",
    "required_phrases",
    "cta_preferences",
    "banned_hashtags",
    "required_hashtags",
  ] as const) {
    if (strings(profileSlot[key]).length === 0 && strings(local[key]).length > 0) {
      patch[key] = strings(local[key]);
    }
  }
  return patch;
}
