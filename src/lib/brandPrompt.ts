/**
 * The ONE place that turns brand data into prompt text.
 *
 * The profile brand slot is the single source of truth. Browser storage is a
 * cache of it (see brandCache.ts). Every generation call site passes the slot
 * (optionally merged with the cache via `mergeBrandSources`) to
 * `buildBrandPrompt` and nothing else assembles brand instructions.
 */

export interface BrandPromptInput {
  voice?: string | null;
  style?: string | null;
  copy_style?: string | null;
  audiences?: string[] | null;
  goals?: string[] | null;
  forbidden_phrases?: string[] | null;
  required_phrases?: string[] | null;
  proof_points?: string[] | null;
  cta_preferences?: string[] | null;
  preferred_structures?: string[] | null;
  banned_hashtags?: string[] | null;
  required_hashtags?: string[] | null;
}

export const BRAND_PROMPT_HEADER = "### BRAND MEMORY & IDENTITY CONSTRAINTS";

const DEFAULT_COPY_STYLE = "Keep plain text (recommended)";

function list(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}

function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function tags(value: string[] | null | undefined): string[] {
  return list(value).map((t) => `#${t.replace(/^#+/, "")}`);
}

/** True when the input carries at least one field that would reach the prompt. */
export function hasBrandPromptContent(brand?: BrandPromptInput | null): boolean {
  return buildBrandPrompt(brand) !== "";
}

/** Builds the complete brand instruction block. Empty fields are omitted. */
export function buildBrandPrompt(brand?: BrandPromptInput | null): string {
  if (!brand) return "";
  const lines: string[] = [];

  const voice = text(brand.voice);
  if (voice) lines.push(`- VOICE / TONE: ${voice}`);

  const style = text(brand.style);
  if (style) lines.push(`- WRITING STYLE: ${style}`);

  const copyStyle = text(brand.copy_style);
  if (copyStyle && copyStyle !== DEFAULT_COPY_STYLE) lines.push(`- COPY STYLE: ${copyStyle}`);

  const audiences = list(brand.audiences);
  if (audiences.length) lines.push(`- TARGET AUDIENCE: ${audiences.join(", ")}`);

  const goals = list(brand.goals);
  if (goals.length) lines.push(`- GOALS: ${goals.join(", ")}`);

  const forbidden = list(brand.forbidden_phrases);
  if (forbidden.length) {
    lines.push(`- FORBIDDEN PHRASES (NEVER USE): ${forbidden.map((p) => `"${p}"`).join(", ")}`);
  }

  const required = list(brand.required_phrases);
  if (required.length) {
    lines.push(`- REQUIRED PHRASES (WORK IN NATURALLY): ${required.map((p) => `"${p}"`).join(", ")}`);
  }

  const proof = list(brand.proof_points);
  if (proof.length) {
    lines.push("- PROOF POINTS & KEY DATA (WEAVE THESE IN WHERE NATURAL):");
    proof.forEach((point) => lines.push(`  * ${point}`));
  }

  const ctas = list(brand.cta_preferences);
  if (ctas.length) {
    lines.push(
      `- PREFERRED CTA PATTERNS: Use call-to-action styles matching: ${ctas.join(", ")}`
    );
  }

  const structures = list(brand.preferred_structures);
  if (structures.length) {
    lines.push(`- PREFERRED WRITING STRUCTURES: Align content formats to: ${structures.join(", ")}`);
  }

  const banned = tags(brand.banned_hashtags);
  if (banned.length) lines.push(`- BANNED HASHTAGS (NEVER USE): ${banned.join(" ")}`);

  const requiredTags = tags(brand.required_hashtags);
  if (requiredTags.length) lines.push(`- REQUIRED HASHTAGS (INCLUDE): ${requiredTags.join(" ")}`);

  if (lines.length === 0) return "";
  return [BRAND_PROMPT_HEADER, ...lines].join("\n");
}

const MERGE_LIST_KEYS = [
  "audiences",
  "goals",
  "forbidden_phrases",
  "required_phrases",
  "proof_points",
  "cta_preferences",
  "preferred_structures",
  "banned_hashtags",
  "required_hashtags",
] as const;

const MERGE_TEXT_KEYS = ["voice", "style", "copy_style"] as const;

/**
 * Combines the profile slot with the browser cache. The slot wins for every
 * field it has a value for; the cache only fills fields the slot leaves empty.
 */
export function mergeBrandSources(
  slot?: BrandPromptInput | null,
  cache?: BrandPromptInput | null
): BrandPromptInput {
  const out: BrandPromptInput = {};
  for (const key of MERGE_TEXT_KEYS) {
    out[key] = text(slot?.[key]) || text(cache?.[key]) || null;
  }
  for (const key of MERGE_LIST_KEYS) {
    const fromSlot = list(slot?.[key]);
    out[key] = fromSlot.length ? fromSlot : list(cache?.[key]);
  }
  return out;
}
