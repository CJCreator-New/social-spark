// Shared helpers used across generate-calendar, generate-single-post, regenerate-post.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const VALID_DOW = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

export const LENGTH_GUIDE_WEEK: Record<string, string> = {
  short: "80–120 words per post (tight, punchy)",
  medium: "160–230 words per post (balanced depth)",
  long: "280–380 words per post (deep, substantive)",
  mixed: "VARY length across the week — at least 2 short (80–120w), 3 medium (160–230w), and 2 long (280–380w) posts. Distribute deliberately.",
};

export const LENGTH_GUIDE_SINGLE: Record<string, string> = {
  short: "80–120 words (tight, punchy)",
  medium: "160–230 words (balanced depth)",
  long: "280–380 words (deep, substantive)",
  mixed: "160–230 words (balanced depth)",
};

export const STRUCTURE_GUIDE: Record<string, string> = {
  paragraphs: "Use flowing paragraphs only. No bullet points or numbered lists in the body.",
  bullets: "Structure the body primarily as bullet points or short numbered items. Minimal prose connective tissue.",
  mixed: "MIX paragraphs and bullet points — paragraph hook, bullets for the meat, paragraph close. Use '→' or '•' markers.",
  perPost: "Pick the best structure per post based on its topic and format — vary deliberately.",
};

export const BANNED_PHRASES = [
  "in today's fast-paced world",
  "in the ever-evolving landscape",
  "game-changer",
  "game changer",
  "revolutionize",
  "revolutionary",
  "unlock the power of",
  "take it to the next level",
  "leverage synergies",
  "in this day and age",
  "at the end of the day",
  "let's dive in",
  "let's dive into",
];

export function bannedPhrasesBlock(): string {
  return `BANNED PHRASES — do NOT use any of these or close variants:\n${BANNED_PHRASES.map(p => `- "${p}"`).join("\n")}\nAvoid empty hype openers. Open with a specific observation, number, or contrarian claim instead.`;
}

export function normTag(s: string): string {
  return `#${String(s || "").trim().replace(/^#+/, "").replace(/[^\w]/g, "").toLowerCase()}`;
}

export function cleanList(arr: unknown, max: number): string[] {
  return ((arr as unknown[]) || [])
    .map(s => String(s || "").trim())
    .filter(Boolean)
    .slice(0, max);
}

export function cleanTagList(arr: unknown, max: number): string[] {
  return ((arr as unknown[]) || []).map(s => normTag(String(s || ""))).filter(t => t.length > 1).slice(0, max);
}

export function isLongFormPlatform(platform: string): boolean {
  return platform === "Newsletter" || platform === "Blog";
}

export function buildHashtagInstr(
  platform: string,
  cleanBannedTags: string[],
  cleanRequiredTags: string[],
  opts: { every?: boolean } = {},
): string {
  const longForm = isLongFormPlatform(platform);
  const base = longForm
    ? `HASHTAGS: This is a ${platform} post — return an EMPTY string ("") for the hashtags field. Do NOT invent hashtags.`
    : `HASHTAGS: Provide 3–6 platform-native hashtags as a single space-separated string (e.g. "#AI #ProductOps #SaaS"). Mix one broad, two niche, and one trending where relevant.`;
  const banned = !longForm && cleanBannedTags.length
    ? `\n  HASHTAG BAN — NEVER use these hashtags or close variants in any post: ${cleanBannedTags.join(" ")}`
    : "";
  const required = !longForm && cleanRequiredTags.length
    ? `\n  HASHTAG REQUIREMENT — INCLUDE at least one of these brand hashtags${opts.every === false ? "" : " in EVERY post"}: ${cleanRequiredTags.join(" ")}`
    : "";
  return base + banned + required;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
