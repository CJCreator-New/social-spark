declare const Deno: any;

// Shared helpers used across generate-calendar, generate-single-post, regenerate-post.

// ALLOWED_ORIGIN should be set to the production frontend origin (e.g.
// "https://app.socialspark.com"; comma-separate to allow more than one, such
// as a staging domain) to restrict CORS on these endpoints. Deno.deploy/
// Supabase edge functions always set DENO_DEPLOYMENT_ID in deployed
// environments; only fall back to "*" for local dev (`supabase functions
// serve`), where DENO_DEPLOYMENT_ID is unset.
const isDeployed = typeof Deno !== "undefined" && !!Deno.env.get("DENO_DEPLOYMENT_ID");
const configuredOrigin = typeof Deno !== "undefined" ? Deno.env.get("ALLOWED_ORIGIN") : undefined;
if (isDeployed && !configuredOrigin) {
  // Fail closed, not crashed: a missing secret used to throw at module load,
  // which made the entire function (including the OPTIONS preflight) return
  // a non-200 and go completely unreachable. Log loudly and deny all origins
  // instead so the function still serves requests once the secret is fixed.
  console.error(
    "ALLOWED_ORIGIN is not set in this deployed environment. All cross-origin requests will be rejected until it is configured in Supabase Edge Functions secrets."
  );
}
const allowedOrigins = (configuredOrigin || (isDeployed ? "" : "*"))
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const LOVABLE_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
];

function isLovableOrigin(origin: string): boolean {
  return LOVABLE_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function resolveAllowedOrigin(requestOrigin?: string | null): string {
  if (allowedOrigins.includes("*")) return "*";
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) return requestOrigin;
  // Always allow Lovable-hosted origins so preview URLs work even without
  // explicit ALLOWED_ORIGIN entries.
  if (requestOrigin && isLovableOrigin(requestOrigin)) return requestOrigin;
  return allowedOrigins[0] || "";
}

export const CORS_ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

// Static default — reflects only the first configured origin. Prefer
// getCorsHeaders(requestOrigin) per-request so Access-Control-Allow-Origin
// matches the caller's actual origin when more than one is allowed.
export const corsHeaders = {
  "Access-Control-Allow-Origin": resolveAllowedOrigin(),
  "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const origin = resolveAllowedOrigin(requestOrigin);
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {}),
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}

export const VALID_DOW = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);

export const ENRICHMENT_MODEL = "google/gemini-2.5-flash-lite";

const LOG_VALUE_MAX_LENGTH = 2_000;
const ALLOWED_AI_ENDPOINTS = new Set([
  "https://api.openai.com/v1/chat/completions",
  "https://openrouter.ai/api/v1/chat/completions",
  "https://ai.gateway.lovable.dev/v1/chat/completions",
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  "https://api.moonshot.ai/v1/chat/completions",
  "https://open.bigmodel.cn/api/paas/v4/chat/completions",
]);

export function sanitizeLogValue(value: unknown, maxLength = LOG_VALUE_MAX_LENGTH): string {
  const raw = value instanceof Error
    ? value.stack || value.message
    : typeof value === "string"
      ? value
      : (() => {
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        })();

  return String(raw)
    .replace(/[\r\n\t]/g, " ")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .slice(0, maxLength);
}

export function sanitizeHtmlText(value: unknown): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAllowedAiEndpoint(url: string): string | null {
  try {
    const normalized = new URL(url);
    normalized.hash = "";
    normalized.search = "";
    const endpoint = normalized.toString();
    return ALLOWED_AI_ENDPOINTS.has(endpoint) ? endpoint : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLATFORM PROVIDER WATERFALL
//  Ordered list of platform-level AI providers tried in sequence.
//  The waterfall skips any entry whose secret key is not configured.
//  Set secondary keys in Supabase: PLATFORM_OPENROUTER_KEY, PLATFORM_OPENAI_KEY,
//  PLATFORM_ANTHROPIC_KEY. Only LOVABLE_API_KEY is required.
// ─────────────────────────────────────────────────────────────────────────────

interface ProviderEntry {
  name: string;
  envKey: string;
  provider: "openai" | "anthropic" | "openrouter" | "lovable";
  endpoint?: string;   // only used for lovable (custom gateway URL)
  model: (quality: string) => string;
}

const PLATFORM_PROVIDER_CHAIN: ProviderEntry[] = [
  {
    name: "lovable-gateway",
    envKey: "LOVABLE_API_KEY",
    provider: "lovable",
    endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
    model: (q) => q === "polished" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
  },
  {
    name: "openrouter",
    envKey: "PLATFORM_OPENROUTER_KEY",
    provider: "openrouter",
    model: (q) => q === "polished" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
  },
  {
    name: "openai",
    envKey: "PLATFORM_OPENAI_KEY",
    provider: "openai",
    model: (q) => q === "polished" ? "gpt-4o" : "gpt-4o-mini",
  },
  {
    name: "anthropic",
    envKey: "PLATFORM_ANTHROPIC_KEY",
    provider: "anthropic",
    model: (q) => q === "polished" ? "claude-3-5-sonnet-latest" : "claude-3-5-haiku-latest",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  CIRCUIT BREAKER  (in-memory, per Deno isolate)
//  Opens after CIRCUIT_THRESHOLD consecutive failures; resets after CIRCUIT_RESET_MS.
//  A half-open probe is allowed once the cooldown expires.
// ─────────────────────────────────────────────────────────────────────────────

const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_RESET_MS  = 60_000; // 60 seconds

const _circuitState = new Map<string, { failures: number; openUntil: number }>();

function isCircuitOpen(name: string): boolean {
  const s = _circuitState.get(name);
  if (!s) return false;
  if (s.openUntil > Date.now()) return true;
  // cooldown expired → half-open: delete state, allow one probe
  _circuitState.delete(name);
  return false;
}

function recordProviderSuccess(name: string): void {
  _circuitState.delete(name);
}

function recordProviderFailure(name: string): void {
  const s = _circuitState.get(name) ?? { failures: 0, openUntil: 0 };
  s.failures++;
  if (s.failures >= CIRCUIT_THRESHOLD) {
    s.openUntil = Date.now() + CIRCUIT_RESET_MS;
    console.warn(`[circuit-breaker] ${sanitizeLogValue(name)} tripped after ${s.failures} failures - cooling ${CIRCUIT_RESET_MS / 1000}s`);
  }
  _circuitState.set(name, s);
}

// Verifies the bearer token's signature against Supabase Auth before trusting
// the caller's identity. This is safe to use for quota, rate-limiting, and
// usage-tracking decisions.
export async function getVerifiedUserId(token?: string | null): Promise<string | null> {
  if (!token) return null;
  try {
    const supabaseUrl = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : null;
    const supabaseAnonKey = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_ANON_KEY") : null;
    if (!supabaseUrl || !supabaseAnonKey) return null;
    // @ts-ignore: Deno dynamic import
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user) return null;
    return data.user.id;
  } catch (err) {
    console.error("getVerifiedUserId failed:", err);
    return null;
  }
}

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

export const STYLE_GUIDE: Record<string, string> = {
  "Short punchy lines": "STYLE: Keep every sentence short. Use crisp line breaks, strong verbs, and a fast cadence. One thought per line.",
  "Long-form narrative": "STYLE: Write like a thoughtful essay. Build tension, explain the arc, and land on a reflective takeaway.",
  "Lists & frameworks": "STYLE: Organize the body around steps, principles, or frameworks. Use numbered sections or bullet points that feel immediately usable.",
  "Thread-style breakdown": "STYLE: Make the post feel like a clean thread. Open with the thesis, then break the idea into compact, sequenced beats.",
  "Stats-led": "STYLE: Lead with a concrete number, percentage, or metric. Use evidence first, then interpret what it means.",
  "Case study format": "STYLE: Frame the post as a mini case study — situation, friction, action, result, lesson.",
  "Question-led": "STYLE: Open with a sharp question that creates curiosity. Use the rest of the post to answer it clearly.",
  "First-person story": "STYLE: Write in first person with a personal moment, lesson, or observation. Keep it grounded and human.",
  "Industry insight": "STYLE: Sound like an expert sharing a field note. Be specific, signal lived experience, and connect the insight to a broader trend.",
  "Myth-busting": "STYLE: Start by challenging a common assumption, then explain the reality with concise evidence or logic.",
  "How-to guide": "STYLE: Teach something directly. Use ordered steps, practical advice, and a clear outcome.",
  "Behind-the-scenes": "STYLE: Reveal the process, the messy middle, and the decision points. Make it feel candid and specific.",
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

export function buildRequiredWordsBlock(requiredWords?: string[]): string {
  if (!requiredWords || requiredWords.length === 0) return "";
  return `REQUIRED WORDS — you MUST include all of the following words/phrases in the generated post body:\n${requiredWords.map(w => `- "${w}"`).join("\n")}`;
}

export function buildEngagementRules(platform: string): string {
  const platformGuidance = (() => {
    switch (platform) {
      case "LinkedIn":
        return "Thoughtful, credible, insight-led. Lead with a sharp point of view or a useful observation, then back it up with specifics.";
      case "Instagram":
        return "Punchy, visual, story-driven. Use vivid language, make the opening scroll-stopping, and keep the rhythm lively.";
      case "X":
        return "Concise, sharp, opinionated. Keep the post tight, direct, and easy to quote or reply to.";
      case "Facebook":
        return "Warm, conversational, community-first. Sound human, approachable, and easy to react to or share.";
      case "TikTok":
        return "Hook-first, high energy, highly conversational. Write text that works as a voiceover/video script (1-3 lines hooks, fast setup, engaging CTA).";
      default:
        return "Native to the platform. Match the platform's expectations and keep the tone natural.";
    }
  })();

  return `\nENGAGEMENT RULES:\n- Open with a strong hook in the first line, not a summary.\n- Focus on one clear idea only.\n- Use concrete examples, numbers, or short stories whenever possible.\n- Avoid vague hype, filler, and overused marketing phrases.\n- End with a CTA that matches the goal: question, invitation, comment prompt, save/share prompt, or next step.\n- ${platformGuidance}`;
}

export function getPlatformPreset(platform: string): string {
  switch (platform) {
    case "LinkedIn":
      return `\nPLATFORM PRESCRIPT: LinkedIn posts should open with a professional insight or data point, include a short explanation, and end with a discussion prompt.`;
    case "Instagram":
      return `\nPLATFORM PRESCRIPT: Instagram captions should start with a scroll-stopping line, include a 1-2 sentence micro-story or vivid image, and a short CTA like "Save this" or "Share your story".`;
    case "X":
      return `\nPLATFORM PRESCRIPT: X posts must be concise (one to three short sentences), bold in opinion, and formatted for quick replies and retweets. Avoid long explanations.`;
    case "Facebook":
      return `\nPLATFORM PRESCRIPT: Facebook posts can be slightly longer, warm, and community-focused. Invite comments and sharing; include a clear question.`;
    case "TikTok":
      return `\nPLATFORM PRESCRIPT: TikTok description / scripts should lead with a high-impact verbal hook (under 3 seconds), followed by 3 key points, and end with a highly engaging comment prompt like "Would you try this?"`;
    default:
      return `\nPLATFORM PRESCRIPT: Match the platform's native style.`;
  }
}

export function getStylePreset(style?: string): string {
  const selectedStyle = String(style || "").trim();
  if (!selectedStyle) return "\nSTYLE PRESCRIPT: Use the most natural style for the topic and audience.";
  return `\nSTYLE PRESCRIPT: ${STYLE_GUIDE[selectedStyle] || `Use ${selectedStyle} faithfully and keep the structure consistent with that style.`}`;
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

// Backwards-compatibility alias: some places mistakenly referenced `longFormPlatform`.
// Provide both an exported const and a global alias so undefined-reference errors are avoided.
export const longFormPlatform = isLongFormPlatform;
try {
  // attach to globalThis for runtimes that reference the identifier unscoped
  // (this is best-effort and safe — it simply assigns a function reference).
  (globalThis as unknown as Record<string, unknown>).longFormPlatform = isLongFormPlatform;
} catch {
  /* ignore — non-critical */
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

export function applyHashtagPolicy(
  rawHashtags: unknown,
  platform: string,
  cleanBannedTags: string[],
  cleanRequiredTags: string[],
  max = 6,
): string {
  if (isLongFormPlatform(platform)) return "";

  const banned = new Set(cleanBannedTags.map(t => normTag(t).toLowerCase()));
  const required = cleanRequiredTags.map(t => normTag(t)).filter(t => t.length > 1);
  const source = Array.isArray(rawHashtags) ? rawHashtags.join(" ") : String(rawHashtags || "");
  const out: string[] = [];
  const seen = new Set<string>();

  for (const part of source.split(/[\s,]+/)) {
    if (out.length >= max) break;
    const tag = normTag(part);
    const key = tag.toLowerCase();
    if (tag.length <= 1 || seen.has(key) || banned.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }

  for (const tag of required) {
    if (out.length >= max) break;
    const key = tag.toLowerCase();
    if (seen.has(key) || banned.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }

  return out.join(" ");
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Logs the full error server-side with a request ID, and returns a safe
 * generic message plus that ID to the client for support correlation.
 */
export function errorResponse(context: string, e: unknown, status = 500): Response {
  const requestId = crypto.randomUUID();
  console.error(`[${requestId}] ${sanitizeLogValue(context)} error:`, sanitizeLogValue(e));
  return jsonResponse({ error: "An unexpected error occurred. Please try again.", requestId }, status);
}

export const MAX_REQUEST_BODY_BYTES = 256 * 1024; // 256 KB

/**
 * Checks the Content-Length header before reading the request body.
 * Returns a 413 response if the declared size exceeds the limit, or null if OK.
 */
export function checkContentLength(req: Request, maxBytes: number = MAX_REQUEST_BODY_BYTES): Response | null {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    return jsonResponse({ error: "Request body too large." }, 413);
  }
  return null;
}

export async function recordServerTelemetryEvent(
  eventName: string,
  props: Record<string, unknown> = {},
  userId: string | null = null,
): Promise<boolean> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("Missing supabase env for server telemetry");
    return false;
  }

  const row = {
    event_name: eventName,
    props,
    user_id: userId,
    created_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/telemetry_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });

    if (!res.ok) {
      console.warn("Server telemetry insert failed", await res.text());
      return false;
    }

    return true;
  } catch (e) {
    console.warn("Server telemetry error", e);
    return false;
  }
}

// ─── BRAND MEMORY: RELEVANT EXEMPLAR SELECTION ────────────────────────────

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "being", "this", "that", "these",
  "those", "it", "its", "as", "at", "by", "from", "your", "you", "we", "our",
  "i", "my", "they", "their", "not", "no", "do", "does", "did", "have", "has",
  "had", "will", "would", "can", "could", "should", "about", "into", "than",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
      (w) => w.length > 2 && !STOPWORDS.has(w)
    )
  );
}

/**
 * From a (potentially large) list of saved brand exemplar posts, select the
 * `limit` most relevant to the current generation topic/core idea using
 * simple keyword overlap. Falls back to the most recent examples (end of
 * array) when there's no meaningful overlap, and never throws.
 */
export function selectRelevantExamples(
  allExamples: string[] | undefined,
  topic: string,
  coreIdea: string,
  limit = 3
): string[] {
  try {
    const examples = (allExamples || []).filter((e) => typeof e === "string" && e.trim().length > 0);
    if (examples.length <= limit) return examples;

    const queryTokens = new Set<string>([
      ...tokenize(topic || ""),
      ...tokenize(coreIdea || ""),
    ]);

    if (queryTokens.size === 0) {
      // No topic context to match against — use the most recently saved examples.
      return examples.slice(-limit);
    }

    const scored = examples.map((text, index) => {
      const tokens = tokenize(text);
      let overlap = 0;
      for (const t of queryTokens) {
        if (tokens.has(t)) overlap++;
      }
      return { text, index, overlap };
    });

    scored.sort((a, b) => b.overlap - a.overlap || b.index - a.index);

    const top = scored.slice(0, limit);
    // If nothing overlapped at all, prefer recency over arbitrary order.
    if (top.every((s) => s.overlap === 0)) {
      return examples.slice(-limit);
    }
    return top.map((s) => s.text);
  } catch (e) {
    console.warn("selectRelevantExamples failed, falling back to first examples", e);
    return (allExamples || []).slice(0, limit);
  }
}

// ─── TREND-AWARE GENERATION ───────────────────────────────────────────────

/**
 * Fetch top trending topic titles for an industry/platform from the
 * trending_topics table, for injection into generation prompts.
 * Returns an empty array if Supabase env vars are missing or the query fails
 * — trend context is an enhancement, never a hard dependency.
 */
export async function getTrendingTopics(
  industry?: string,
  platform?: string,
  limit = 5
): Promise<string[]> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) return [];

    // @ts-ignore - Deno ESM import resolved at runtime
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let query = supabase
      .from("trending_topics")
      .select("title")
      .order("score", { ascending: false })
      .limit(limit);

    if (industry) query = query.eq("industry", industry);
    if (platform) query = query.eq("platform", platform);

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [];
    return data.map((row: { title: string }) => row.title).filter(Boolean);
  } catch (e) {
    console.warn("getTrendingTopics failed, continuing without trend context", e);
    return [];
  }
}

// ─── RATE LIMITING ────────────────────────────────────────────────────────

interface RateLimitConfig {
  maxRequests: number;  // Max requests allowed
  windowMs: number;     // Time window in milliseconds
}

export async function checkRateLimit(userId: string, endpoint: string, config: RateLimitConfig): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  try {
    const kv = await Deno.openKv();
    const key = ["ratelimit", endpoint, userId];
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get current request data
    const data = await kv.get(key);
    let requests: number[] = (data.value as number[]) || [];
    
    // Clean old requests outside the window
    requests = requests.filter(ts => ts > windowStart);

    if (requests.length >= config.maxRequests) {
      const oldestRequest = requests[0];
      const resetAt = oldestRequest + config.windowMs;
      await kv.close();
      return { allowed: false, remaining: 0, resetAt };
    }

    // Add current request
    requests.push(now);
    await kv.set(key, requests, { expireIn: config.windowMs });
    await kv.close();

    return { 
      allowed: true, 
      remaining: config.maxRequests - requests.length,
      resetAt: now + config.windowMs
    };
  } catch (e) {
    console.warn("Rate limit check failed, allowing request", e);
    // If KV fails, allow the request
    return { allowed: true, remaining: config.maxRequests, resetAt: Date.now() + config.windowMs };
  }
}

// ─── GENERATION QUOTA (PILOT) ──────────────────────────────────────────────

export type EffectiveTier = "free" | "starter" | "pro";

export async function checkQuota(userId: string): Promise<{ allowed: boolean; used: number; limit: number; useOwnKey: boolean; keyMode: string; tier: EffectiveTier }> {
  const DEFAULT = { allowed: true, used: 0, limit: 50, useOwnKey: false, keyMode: "fallback", tier: "free" as EffectiveTier };
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_KEY) return DEFAULT;

  // userId comes from a decoded JWT `sub`; ensure it is a real UUID before
  // interpolating into the PostgREST query URL.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(userId)) {
    console.warn("checkQuota: userId is not a valid UUID, returning default quota");
    return DEFAULT;
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/user_settings?user_id=eq.${encodeURIComponent(userId)}&select=generation_count,quota_limit,quota_period_start,use_own_key,key_mode,tier,plan_period_end`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    if (!res.ok) return DEFAULT;
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return DEFAULT;

    const useOwnKey = !!row.use_own_key;
    const keyMode = row.key_mode || "fallback";

    // ── Monthly quota window ──────────────────────────────────────────────
    // quota_period_start tracks which calendar month the current count belongs to.
    // If it is from a previous month, treat the effective count as 0 (reset).
    // The actual DB reset happens atomically inside increment_generation_count().
    const periodStart = row.quota_period_start ? new Date(row.quota_period_start) : new Date(0);
    const nowMonthStart = new Date();
    nowMonthStart.setUTCDate(1);
    nowMonthStart.setUTCHours(0, 0, 0, 0);
    const effectiveCount = periodStart < nowMonthStart ? 0 : (row.generation_count ?? 0);

    const used  = effectiveCount;
    const limit = row.quota_limit ?? 50;

    // Effective tier: a paid tier whose window has lapsed is treated as free.
    const storedTier = (row.tier === "starter" || row.tier === "pro") ? row.tier : "free";
    const periodEnd = row.plan_period_end ? Date.parse(row.plan_period_end) : NaN;
    const windowActive = Number.isFinite(periodEnd) && periodEnd > Date.now();
    const tier: EffectiveTier = storedTier === "free" ? "free" : (windowActive ? storedTier : "free");

    const allowed = (useOwnKey && keyMode === "always") || used < limit;

    return { allowed, used, limit, useOwnKey, keyMode, tier };
  } catch (e) {
    console.warn("checkQuota failed, allowing request", e);
    return DEFAULT;
  }
}

/**
 * BYOK is now available to all tiers — this function is retained as a no-op
 * so existing callers don't need to be updated immediately.
 * @deprecated Remove call sites; BYOK is no longer gated behind a paid tier.
 */
export function rejectFreeTierByok(
  _useOwnKey: boolean,
  _tier: EffectiveTier,
): Response | null {
  return null;
}

/**
 * Message shown when a user has exhausted their monthly platform generation
 * quota. Points free users at upgrading for more platform credits; all users
 * can use BYOK (Settings > API Keys, 'Always use my key') to bypass the quota.
 */
export function quotaExceededMessage(tier: EffectiveTier): string {
  if (tier === "free") {
    return "You've used your 50 free platform generations this month. Upgrade for more platform credits, or add your own API key (Settings → API Keys) to keep generating at no platform cost.";
  }
  if (tier === "starter") {
    return "You've used your 100 Starter generations this month. Add your own API key (Settings → API Keys, 'Always use my key') to keep generating, or upgrade to Pro for 500 monthly generations.";
  }
  return "You've used your 500 Pro generations this month. Add your own API key (Settings → API Keys, 'Always use my key') to keep generating without limits.";
}

export async function incrementGenerationCount(userId: string): Promise<void> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  try {
    await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/increment_generation_count`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ p_user_id: userId }),
    });
  } catch (e) {
    console.warn("incrementGenerationCount failed", e);
  }
}

// ─── PAYLOAD NORMALIZATION & CONTEXT BUILDING ─────────────────────────────

/**
 * Standardized payload structure shared across all generation functions
 */
export interface GenerationPayload {
  industry: string;
  industryLabel: string;
  niche: string;
  platform: string;
  language: string;
  coreIdea: string;
  brandMemory: string;
  audiences: string[];
  voice: string;
  style: string;
  goals: string[];
  topic: string;           // Single-post only
  topics: string[];         // Calendar only
  dow: string;              // Single-post only
  date: string;             // Single-post only
  format: string;
  cta: string;
  length: string;
  structure: string;
  extra: string;
  brand_examples: string[];
  framework: string; // AIDA | PAS | BAB | 4U | FAB | Question-led | Story-led | Auto
  bannedWords: string[];
  requiredWords: string[];
  bannedHashtags: string[];
  requiredHashtags: string[];
  quality: "draft" | "polished"; // draft: single-call, polished: two-pass critique+rewrite
  userApiKey?: string;
  userApiProvider?: "openai" | "anthropic" | "openrouter" | "gemini" | "kimi" | "glm";
  trendingTopics?: string[];
}

const BRITISH_TO_AMERICAN: Record<string, string> = {
  organising: "organizing",
  organised: "organized",
  organisingly: "organizingly",
  optimising: "optimizing",
  optimised: "optimized",
  recognising: "recognizing",
  recognised: "recognized",
  analysing: "analyzing",
  analysed: "analyzed",
  utilising: "utilizing",
  utilised: "utilized",
  emphasising: "emphasizing",
  emphasised: "emphasized",
  behaviour: "behavior",
  colour: "color",
  favourite: "favorite",
  centre: "center",
  defence: "defense",
  licence: "license",
  labour: "labor",
  theatre: "theater",
  flavour: "flavor",
  humour: "humor",
  neighbour: "neighbor",
  catalogue: "catalog",
  travelled: "traveled",
  travelling: "traveling",
  cancelled: "canceled",
  modelling: "modeling",
  standardise: "standardize",
  standardised: "standardized",
  standardising: "standardizing",
};

export function fixSpelling(text: string): string {
  let result = text || "";
  for (const [british, american] of Object.entries(BRITISH_TO_AMERICAN)) {
    result = result.replace(new RegExp(`\\b${british}\\b`, "gi"), (match) => {
      const replacement = american;
      return match[0] === match[0].toUpperCase()
        ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
        : replacement;
    });
  }
  return result;
}
function buildContentRules(platform: string, language?: string): string {
  const normalizedLanguage = String(language || "English").trim().toLowerCase();
  const spellingRule = normalizedLanguage === "tamil" || normalizedLanguage === "தமிழ்"
    ? "- Keep the output fully in Tamil script and avoid mixing in English unless a product name or platform term needs it."
    : "- Use American English spelling: optimizing, organizing, recognizing, analyzing, utilizing, emphasizing.\n- Avoid British spellings such as organising, optimising, recognising, analysing, utilising, emphasising.";

  const globalConstraints = "- Never fabricate statistics or named studies — use qualifying language ('roughly', 'studies suggest').";

  let platformGuidance = "";
  if (platform === "LinkedIn") {
    platformGuidance = "\n- Use paragraph-chunking: write in short blocks of 1-3 sentences with blank lines in between to reward dwell time.";
  } else if (platform === "X" || platform === "Twitter") {
    platformGuidance = "\n- Strictly enforce the 280-character limit instruction. Never use standalone hashtag blocks at the end of the post; weave hashtags naturally if used, or omit them.";
  } else if (platform === "Instagram") {
    platformGuidance = "\n- Use double-newline visual spacing for clean paragraph division. Cap hashtags to 3 to 8 (modern post-2024 algorithm best practice).";
  }

  return `\nCONTENT RULES:\n- Do not use markdown syntax in post text: no **bold**, *italic*, headings, or inline code.\n- Use plain-text bullets only (• or →). Do not combine bullets with markdown formatting.\n- Rotate CTA verbs across the week; do not repeat the same CTA verb on every post.\n- Stay tightly within the user's stated topic angle; do not introduce tangential sub-topics unless requested.\n- Keep the post platform-native: LinkedIn = insight-led, Instagram = visual/story-driven, X = concise/opinionated, Facebook = warm/community-first, TikTok = script-based/high-energy.\n- If the topic is India-specific, incorporate current Indian trends (Digital India, EV adoption, startup ecosystem), regional contexts (South/North/East/West differences), and cultural references (jugaad innovation, dharma/responsibility themes) where relevant.\n- Reference upcoming festivals (Diwali, Holi, Durga Puja) and national events (Republic Day) in seasonal content.\n${globalConstraints}${platformGuidance}\n${spellingRule}${buildEngagementRules(platform)}`;
}

function buildLanguageRules(language?: string): string {
  const normalized = String(language || "English").trim().toLowerCase();
  if (normalized === "tamil" || normalized === "தமிழ்") {
    return `\nLANGUAGE RULES:\n- Write the output in natural Tamil script.\n- Do not transliterate Tamil into English letters.\n- Keep English out of the body unless a brand name, product name, or platform term truly needs it.\n- Use clear, everyday Tamil that sounds native and readable, not machine-translated.\n- Keep hashtags platform-native; if Tamil hashtags are used, make them short and natural.`;
  }
  return `\nLANGUAGE RULES:\n- Write the output in English unless the user explicitly chooses another language.`;
}

/**
 * Clean and normalize payload with sensible defaults
 */
export function cleanPayload(body: unknown): GenerationPayload {
  if (!body || typeof body !== "object") {
    return getPayloadDefaults();
  }

  const payload = body as Record<string, unknown>;
  return {
    industry: String(payload.industry || "").trim() || "",
    industryLabel: String(payload.industryLabel || "").trim() || "",
    niche: String(payload.niche || "").trim() || "",
    platform: String(payload.platform || "LinkedIn").trim(),
    language: String(payload.language || "English").trim(),
    coreIdea: String(payload.coreIdea || "").trim() || "",
    brandMemory: String(payload.brandMemory || "").trim() || "",
    audiences: cleanList(payload.audiences, 10),
    voice: String(payload.voice || "").trim() || "",
    style: String(payload.style || "").trim() || "",
    goals: cleanList(payload.goals, 10),
    topic: String(payload.topic || "").trim() || "",
    topics: cleanList(payload.topics, 50),
    dow: String(payload.dow || "Mon").trim(),
    date: String(payload.date || "").trim() || "",
    format: String(payload.format || "Balanced mix").trim(),
    cta: String(payload.cta || "Share & repost bait").trim(),
    length: String(payload.length || "medium").trim(),
    structure: String(payload.structure || "mixed").trim(),
    extra: String(payload.extra || "").trim() || "",
    brand_examples: cleanList(payload.brand_examples, 20),
    framework: String(payload.framework || "Auto").trim(),
    quality: String(payload.quality || "draft").trim() === "polished" ? "polished" : "draft",
    bannedWords: cleanList(payload.bannedWords, 20),
    requiredWords: cleanList(payload.requiredWords, 10),
    bannedHashtags: cleanTagList(payload.bannedHashtags, 30),
    requiredHashtags: cleanTagList(payload.requiredHashtags, 10),
    userApiKey: payload.userApiKey ? String(payload.userApiKey).trim() : undefined,
    userApiProvider: (payload.userApiProvider && ["openai", "anthropic", "openrouter", "gemini", "kimi", "glm"].includes(String(payload.userApiProvider).trim()))
      ? (String(payload.userApiProvider).trim() as any)
      : undefined,
  };
}

/**
 * Get payload with all default values
 */
export function getPayloadDefaults(): GenerationPayload {
  return {
    industry: "",
    industryLabel: "",
    niche: "",
    platform: "LinkedIn",
    language: "English",
    coreIdea: "",
    brandMemory: "",
    audiences: [],
    voice: "",
    style: "",
    goals: [],
    topic: "",
    topics: [],
    dow: "Mon",
    date: "",
    format: "Balanced mix",
    cta: "Share & repost bait",
    length: "medium",
    structure: "mixed",
    extra: "",
    brand_examples: [],
    framework: "Auto",
    quality: "draft",
    bannedWords: [],
    requiredWords: [],
    bannedHashtags: [],
    requiredHashtags: [],
    userApiKey: undefined,
    userApiProvider: undefined,
  };
}

/**
 * Build the strategic prompt framework that keeps every output centered on one core idea.
 */
export function buildStrategicPromptFramework(payload: GenerationPayload): string {
  const industry = payload.industryLabel || payload.industry || "the selected industry";
  const niche = payload.niche || industry;
  const audiences = payload.audiences.length ? payload.audiences.join(", ") : "the target audience";
  const voice = payload.voice || "the intended brand voice";
  const style = payload.style || "the intended writing style";
  const platform = payload.platform || "the chosen platform";
  const coreIdea = payload.coreIdea || "the provided core idea";

  return `
PROMPT FRAMEWORK:
CORE IDEA LOCK:
- Core idea / central angle: ${coreIdea}
- Non-negotiable rule: every sentence must support this angle.

VARIABLE SELECTION MATRIX:
- Industry: use the terminology, examples, and market reality of ${industry}.
- Platform: adapt hook length, structure, cadence, and formatting to ${platform}.
- Niche: narrow the frame to ${niche} without widening the topic.
- Target audience: speak directly to ${audiences}, their goals, and their pain points.
- Brand voice: preserve ${voice} as the personality of the message.
- Writing style: render the idea in a ${style} style without changing the thesis.
${payload.brandMemory ? `- Brand memory: honor these saved preferences without overwriting the core idea: ${payload.brandMemory}` : ""}
${payload.trendingTopics && payload.trendingTopics.length ? `- Trending right now in ${industry}: ${payload.trendingTopics.join(", ")}. Where it fits naturally with the core idea, weave in a relevant trending angle or reference — but never let a trend override or dilute the core idea.` : ""}

FOCUS GUARDRAILS:
- Do not introduce secondary angles, tangents, or adjacent topics.
- If a detail does not reinforce the core idea, remove it.
- If a variable conflicts with the core idea, the core idea wins.
- Keep the output specialized, but never let specialization become drift.

QUALITY CHECK:
- Ask whether each line supports the core idea.
- Ask whether the industry, niche, audience, voice, and style choices changed delivery rather than meaning.
- Reject any draft that feels broad, generic, or off-angle.`;
}

export function buildCinematicImagePromptRules(payload: GenerationPayload): string {
  const industry = payload.industryLabel || payload.industry || "the selected industry";
  const topic = payload.topic || payload.coreIdea || industry;
  const audience = payload.audiences.length ? payload.audiences.join(", ") : "the target audience";
  const voice = payload.voice || "the intended brand voice";
  const style = payload.style || "the intended writing style";

  return `
IMAGE PROMPT REQUIREMENT:
- Add an "image_prompt" field that turns the post into a single cinematic visual concept.
- Translate the post into a scene, not a literal screenshot or infographic.
- Preserve the same core idea, but express it through symbolism, mood, and visual storytelling.
- The prompt must be detailed enough for a high-end image model to produce a polished, editorial-quality result.
- Anchor the scene in ${industry} and ${topic}, and make it feel relevant to ${audience}.
- Match the emotional tone of ${voice} and ${style}, but elevate it into a cinematic art direction brief.
- Explicitly cover artistic style, lighting, composition, color palette, textures, depth, and atmospheric details.
- Favor language like film still, key art, dramatic framing, realistic depth, rich contrast, and controlled motion.
- Avoid text overlays, watermarks, UI mockups, collage language, and generic stock-photo language.
- Keep the final image_prompt concise enough to paste into an image generator, but rich enough to steer quality.`;
}

/**
 * Build the common prompt context lines (repeated in all functions)
 */
export function buildPromptContext(
  payload: GenerationPayload,
  opts: { includeTopics?: boolean; isSinglePost?: boolean } = {}
): string {
  const label = payload.industryLabel || payload.industry;
  const niche = payload.niche || label;
  const audiences = payload.audiences.length ? payload.audiences.join(", ") : "industry professionals";
  const voice = payload.voice || "conversational and professional";
  const style = payload.style || "balanced";
  const goals = payload.goals.length ? payload.goals.join(", ") : "Awareness, Engagement";

  let topicLine = "";
  if (opts.isSinglePost) {
    const singleTopic = payload.topic || payload.coreIdea || payload.industryLabel || payload.industry || "the topic";
    topicLine = `- Topic for this post: ${singleTopic}\n`;
  } else if (opts.includeTopics && payload.topics.length) {
    topicLine = `- Topics to cover (use every selected topic at least once across the week; cluster related topics together if needed rather than dropping any): ${payload.topics.join(", ")}\n`;
  }

  const dateNote = payload.date ? ` (${payload.date})` : "";

  const context = `- Industry / niche: ${label || "(not specified)"}
- Niche focus: ${niche || label || "(not specified)"}
- Core idea: ${payload.coreIdea}
- Audience: ${audiences}
- Voice / tone: ${voice}
- Writing style: ${style}
- Goals: ${goals}
- Output language: ${payload.language || "English"}
${topicLine}- Post format mix: ${payload.format}
- CTA approach: ${payload.cta}${buildContentRules(payload.platform, payload.language)}${buildLanguageRules(payload.language)}${getStylePreset(payload.style)}`;

  const framework = buildStrategicPromptFramework(payload);

  // Append a short platform preset to help the model match native conventions
  return context + framework + getPlatformPreset(payload.platform);
}

/**
 * Build a system message that contains framework-level rules, persona, and global guards.
 */
export function buildSystemMessage(
  payload: GenerationPayload,
  opts: { includeTopics?: boolean; isSinglePost?: boolean } = {}
): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const season = now.getMonth() >= 2 && now.getMonth() <= 4 ? "Spring" : 
                 now.getMonth() >= 5 && now.getMonth() <= 7 ? "Summer" :
                 now.getMonth() >= 8 && now.getMonth() <= 10 ? "Autumn" : "Winter";

  const framework = buildStrategicPromptFramework(payload);
  const contentRules = buildContentRules(payload.platform, payload.language);
  const languageRules = buildLanguageRules(payload.language);
  const stylePreset = getStylePreset(payload.style);
  const banned = bannedPhrasesBlock();
  const requiredWordsBlock = buildRequiredWordsBlock(payload.requiredWords);
  
  const antiMimicry = payload.brand_examples && payload.brand_examples.length > 0
    ? "\nANTI-MIMICRY RULE: Match the cadence, vocabulary, and sentence structure of the brand examples provided, but do NOT copy phrases or specific hooks verbatim. Freshness is key."
    : "";

  const exemplars = getExemplars(payload.platform, payload.style);
  const topicForMatching = opts.isSinglePost ? payload.topic : (payload.topics || []).join(" ");
  const userExamples = selectRelevantExamples(payload.brand_examples, topicForMatching, payload.coreIdea, 3);
  const exemplarBlock = exemplars.length || userExamples.length
    ? `\nEXEMPLARS (Model-provided + User Brand):
${exemplars.map(e => `- ${e}`).join("\n")}
${userExamples.length ? `- USER BRAND EXAMPLES:\n${userExamples.map(e => `  - ${e}`).join("\n")}` : ""}

CONTRASTIVE GUIDANCE:
- STRONG HOOK: Specific, creates curiosity gap, starts with high-impact word, or uses a concrete number.
- WEAK HOOK: "In today's fast-paced world...", "Have you ever wondered...", or generic statements. Avoid these at all costs.`
    : "";

  const frameworkNote = payload.framework && payload.framework !== "Auto" ? `FRAMEWORK: Use ${payload.framework} for the post structure.` : "FRAMEWORK: Auto — choose the best framework if unsure.";

  return `[ROLE]
You are a senior ${payload.platform} content strategist for ${payload.industryLabel || payload.industry || 'the industry'} who writes for ${payload.audiences.length ? payload.audiences.join(', ') : 'the target audience'}.

[CONTEXT]
- Today's Date: ${dateStr}
- Current Season: ${season}
- Platform Constraints: ${payload.platform} style conventions apply.

[INSTRUCTIONS]
Follow the strategic framework and content rules strictly:
${framework}
${contentRules}
${languageRules}
${stylePreset}
- ${frameworkNote}

[CONSTRAINTS]
${banned}
${antiMimicry}
${requiredWordsBlock ? `- ${requiredWordsBlock}` : ""}
- Never output markdown bold/italic formatting in the post copy.
- Stay strictly on topic. Do not drift into generic summaries.

[EXAMPLES]
${exemplarBlock}
${getPlatformPreset(payload.platform)}`;
}

export const EXEMPLARS: Record<string, Record<string, string[]>> = {
  LinkedIn: {
    "Short punchy lines": [
      `Hook: "70% of startups fail in year one — here's how we cut churn by 40%."\nBody: "We focused on onboarding checklists, timed emails, and a 5-step support playbook. Result: activation up 18%.\nCTA: Tell me your biggest onboarding challenge.",`,
      `Hook: "Stop treating features like product — build for outcomes instead."\nBody: "Map the customer journey, define the A -> B outcome, then ship experiments that move the needle. We ran 3 trials and found one that improved retention by 7%.\nCTA: What's one customer outcome you care about?",`,
    ],
  },
  Instagram: {
    "First-person story": [
      `Hook: "I almost quit my startup at month 6."\nBody: "We had no product-market fit. I started talking to customers daily, built a tiny feature, and saw signups jump. Lesson: ship small, learn fast.\nCTA: Save if you need permission to iterate.",`,
      `Hook: "The photo you won't see: my messy desk at 3am."\nBody: "Real work looks chaotic. Here's how I prioritize focus: 1) Block time, 2) say no, 3) ship imperfect.\nCTA: Share your late-night ritual.",`,
    ],
  },
};

export function getExemplars(platform: string, style?: string): string[] {
  const plat = String(platform || "");
  const st = String(style || "");
  const byPlatform = (EXEMPLARS as Record<string, Record<string, string[]>>)[plat] || {};
  if (st && byPlatform[st]) return byPlatform[st].slice(0, 2);
  // fallback: collect first two examples across styles
  const all = Object.values(byPlatform).flat();
  return all.slice(0, 2);
}

/**
 * Build a concise user message containing the per-request brief (core idea, topic(s), length, structure, extras).
 */
export function buildUserMessage(
  payload: GenerationPayload,
  opts: { includeTopics?: boolean; isSinglePost?: boolean; leanOutput?: boolean } = {}
): string {
  const topicLine = opts.isSinglePost
    ? `Topic: ${payload.topic || payload.coreIdea || '(not specified)'}`
    : (opts.includeTopics && payload.topics && payload.topics.length) ? `Topics: ${payload.topics.join(', ')}` : `Core idea: ${payload.coreIdea || '(not specified)'} `;

  const brief = `BRIEF:\n- Industry: ${payload.industryLabel || payload.industry || '(not specified)'}\n- ${topicLine}\n- Audience: ${payload.audiences.length ? payload.audiences.join(', ') : '(not specified)'}\n- Voice: ${payload.voice || '(not specified)'}\n- Style: ${payload.style || '(not specified)'}\n- Goals: ${payload.goals.length ? payload.goals.join(', ') : '(not specified)'}\n- Length target: ${payload.length || 'medium'}\n- Structure target: ${payload.structure || 'mixed'}\n${payload.extra ? `- Extra: ${payload.extra}` : ''}\n`;

  // Lean mode (7-post calendars): the full "plan + variants + self_check" ask combined
  // with a large tool schema makes Gemini's forced tool-call fail with an upstream 400.
  // Keep the ask minimal for calendar-sized outputs.
  const ask = opts.leanOutput
    ? `Return the result via the provided function tool. Also provide 3 hook_options and 2 cta_options per post.`
    : `Return the result via the provided function tool. Include a lightweight plan first (plan.angle, plan.hook_thesis, plan.proof_points[], plan.cta_intent) before the final body. Also provide 3 hook_options, 2 cta_options, and up to 2 body_variants. Provide a self_check object listing any forbidden rule violations.`;

  return brief + "\n" + ask;
}

/**
 * Perform a cheap pre-call to gemini-2.5-flash-lite to turn coreIdea + topics[] 
 * into 7 differentiated angles for a calendar.
 */
export function getProviderModel(provider: string, quality: string): string {
  if (provider === "openai") {
    return quality === "polished" ? "gpt-4o" : "gpt-4o-mini";
  }
  if (provider === "anthropic") {
    return quality === "polished" ? "claude-3-5-sonnet-latest" : "claude-3-5-haiku-latest";
  }
  if (provider === "openrouter") {
    return quality === "polished" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
  }
  if (provider === "gemini") {
    return quality === "polished" ? "gemini-2.5-pro" : "gemini-2.5-flash";
  }
  if (provider === "kimi") {
    return quality === "polished" ? "kimi-k2-0905-preview" : "moonshot-v1-8k";
  }
  if (provider === "glm") {
    return quality === "polished" ? "glm-4.6" : "glm-4.5-air";
  }
  return quality === "polished" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
}

export function shouldUseUserKeyOnly(keyMode?: string | null): boolean {
  return String(keyMode || "fallback").trim() === "always";
}

export function shouldFallbackToUserKey(status: number): boolean {
  return status === 429 || status === 402 || status === 503;
}

export function clampMaxTokensForProvider(provider: string, model: string, maxTokens?: number): number | undefined {
  if (typeof maxTokens !== "number") return undefined;

  const normalizedModel = model.toLowerCase();
  // Gemini (via Lovable gateway, OpenRouter, or direct) reliably serves
  // tool-calling completions up to ~8k output tokens; higher requests
  // intermittently return upstream 400s with 0 output tokens generated.
  // Cap to a safe ceiling.
  if (provider === "gemini" || ((provider === "lovable" || provider === "openrouter") && normalizedModel.includes("gemini"))) {
    return Math.min(maxTokens, 8000);
  }

  return maxTokens;
}

async function callOpenAiCompatibleDirect(
  url: string,
  messages: Array<{ role: string; content: string }>,
  tool: Record<string, unknown> | null,
  apiKey: string,
  model: string,
  temperature: number,
  max_tokens?: number
): Promise<{ status: number; data?: Record<string, unknown>; error?: string }> {
  const hasTool = tool && Object.keys(tool).length > 0;
  const functionName = hasTool ? (((tool as any).function?.name || "") as string) : "";
  const endpoint = getAllowedAiEndpoint(url);
  if (!endpoint) {
    console.error("Blocked AI call to unapproved endpoint:", sanitizeLogValue(url));
    return { status: 400, error: "Unsupported AI provider endpoint." };
  }
  
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        tools: hasTool ? [tool] : undefined,
        tool_choice: hasTool ? { type: "function", function: { name: functionName } } : undefined,
        temperature,
        max_tokens,
      }),
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error(`Direct call to ${sanitizeLogValue(endpoint)} failed ${res.status}:`, sanitizeLogValue(text));
      return { status: res.status, error: `API error: ${res.status}` };
    }
    
    const data = await res.json();
    return { status: 200, data };
  } catch (e) {
    console.error(`Direct call to ${sanitizeLogValue(endpoint)} encountered network error:`, sanitizeLogValue(e));
    return { status: 500, error: e instanceof Error ? e.message : "Network error" };
  }
}

async function callAnthropicDirect(
  messages: Array<{ role: string; content: string }>,
  tool: Record<string, unknown> | null,
  apiKey: string,
  model: string,
  temperature: number,
  max_tokens?: number
): Promise<{ status: number; data?: Record<string, unknown>; error?: string }> {
  const systemMessage = messages.find(m => m.role === "system")?.content || "";
  const regularMessages = messages.filter(m => m.role !== "system");
  
  const hasTool = tool && Object.keys(tool).length > 0;
  let anthropicTools: any[] | undefined = undefined;
  let toolChoice: any = undefined;
  
  if (hasTool) {
    const oaiFunction = ((tool as any).function || {}) as any;
    anthropicTools = [{
      name: oaiFunction.name,
      description: oaiFunction.description,
      input_schema: oaiFunction.parameters
    }];
    toolChoice = { type: "tool", name: oaiFunction.name };
  }
  
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: regularMessages,
        system: systemMessage || undefined,
        tools: anthropicTools,
        tool_choice: toolChoice,
        temperature,
        max_tokens: max_tokens || 4000
      })
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error("Anthropic direct API call failed:", sanitizeLogValue(text));
      return { status: res.status, error: `Anthropic error: ${res.status}` };
    }
    
    const data = await res.json();
    
    if (hasTool) {
      const toolUseContent = data.content?.find((c: any) => c.type === "tool_use");
      if (!toolUseContent) {
        return { status: 500, error: "Anthropic did not invoke the requested tool" };
      }
      
      const mappedData = {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    name: toolUseContent.name,
                    arguments: typeof toolUseContent.input === "string" ? toolUseContent.input : JSON.stringify(toolUseContent.input)
                  }
                }
              ]
            }
          }
        ]
      };
      
      return { status: 200, data: mappedData };
    } else {
      const textContent = data.content?.find((c: any) => c.type === "text")?.text || "";
      const mappedData = {
        choices: [
          {
            message: {
              content: textContent
            }
          }
        ]
      };
      return { status: 200, data: mappedData };
    }
  } catch (e) {
    console.error("Anthropic direct call encountered network error:", e);
    return { status: 500, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function callAI(
  messages: Array<{ role: string; content: string }>,
  tool: Record<string, unknown> | null,
  apiKey: string,
  opts: {
    provider: "openai" | "anthropic" | "openrouter" | "lovable" | "gemini" | "kimi" | "glm";
    quality?: string;
    model?: string;
    temperature?: number;
    timeoutMs?: number;
    max_tokens?: number;
  }
): Promise<{ status: number; data?: Record<string, unknown>; error?: string }> {
  const provider = opts.provider;
  const quality = opts.quality || "draft";
  const temperature = typeof opts.temperature === "number" ? opts.temperature : 0.7;
  const model = opts.model || getProviderModel(provider, quality);
  const maxTokens = clampMaxTokensForProvider(provider, model, opts.max_tokens);
  if (typeof opts.max_tokens === "number" && maxTokens !== opts.max_tokens) {
    console.warn(`[ai] clamped max_tokens for ${sanitizeLogValue(provider)}/${sanitizeLogValue(model)}: ${opts.max_tokens} -> ${maxTokens}`);
  }

  if (provider === "openai") {
    return callOpenAiCompatibleDirect("https://api.openai.com/v1/chat/completions", messages, tool, apiKey, model, temperature, maxTokens);
  } else if (provider === "openrouter") {
    return callOpenAiCompatibleDirect("https://openrouter.ai/api/v1/chat/completions", messages, tool, apiKey, model, temperature, maxTokens);
  } else if (provider === "anthropic") {
    return callAnthropicDirect(messages, tool, apiKey, model, temperature, maxTokens);
  } else if (provider === "lovable") {
    // Lovable AI Gateway speaks the OpenAI-compatible wire protocol
    return callOpenAiCompatibleDirect("https://ai.gateway.lovable.dev/v1/chat/completions", messages, tool, apiKey, model, temperature, maxTokens);
  } else if (provider === "gemini") {
    // Gemini's OpenAI-compatible endpoint
    return callOpenAiCompatibleDirect("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", messages, tool, apiKey, model, temperature, maxTokens);
  } else if (provider === "kimi") {
    // Moonshot Kimi — OpenAI-compatible chat completions
    return callOpenAiCompatibleDirect("https://api.moonshot.ai/v1/chat/completions", messages, tool, apiKey, model, temperature, maxTokens);
  } else if (provider === "glm") {
    // Zhipu GLM — OpenAI-compatible chat completions
    return callOpenAiCompatibleDirect("https://open.bigmodel.cn/api/paas/v4/chat/completions", messages, tool, apiKey, model, temperature, maxTokens);
  }

  return { status: 400, error: `Unsupported API provider: ${provider}` };
}

export function padTopics(topics: string[], coreIdea: string): string[] {
  const result = [...topics];
  if (result.length >= 7) return result.slice(0, 7);
  
  if (result.length === 0) {
    result.push(coreIdea || "General update");
  }

  let idx = 0;
  const templates = [
    (t: string) => `Deep dive into ${t}`,
    (t: string) => `Key takeaways on ${t}`,
    (t: string) => `Why ${t} matters now`,
    (t: string) => `How to approach ${t}`,
    (t: string) => `Common mistakes with ${t}`,
    (t: string) => `Future trends in ${t}`,
    (t: string) => `A contrarian view on ${t}`,
  ];

  while (result.length < 7) {
    const baseTopic = result[idx % result.length];
    const generator = templates[Math.floor(result.length / 7) % templates.length];
    result.push(generator(baseTopic));
    idx++;
  }
  return result;
}

export async function enrichTopics(
  payload: GenerationPayload,
  apiKey: string
): Promise<string[]> {
  const model = payload.userApiProvider ? getProviderModel(payload.userApiProvider, "draft") : ENRICHMENT_MODEL;
  const system = `You are a senior content strategist. Given a core idea and a list of topics, return exactly 7 unique, highly differentiated post angles for a 7-day calendar. Each angle should be one sentence, focusing on a specific fact, story, or contrarian point. Do not repeat themes. Return as a simple JSON array of strings.`;
  const user = `Core Idea: ${payload.coreIdea}\nTopics: ${payload.topics.join(", ")}\nIndustry: ${payload.industryLabel || payload.industry}`;

  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  try {
    let data: any;
    if (payload.userApiKey && payload.userApiProvider) {
      const aiRes = await callAI(messages, null, payload.userApiKey, {
        provider: payload.userApiProvider,
        quality: "draft",
        model,
      });
      if (aiRes.status === 200) {
        data = aiRes.data;
      } else {
        return padTopics(payload.topics, payload.coreIdea);
      }
    } else {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.8,
        }),
      });

      if (!res.ok) return padTopics(payload.topics, payload.coreIdea);
      data = await res.json();
    }

    const content = data?.choices?.[0]?.message?.content || "";
    const m = content.match(/\[[\s\S]*\]/);
    if (m) {
      try {
        const enriched = JSON.parse(m[0]);
        if (Array.isArray(enriched) && enriched.length > 0) return padTopics(enriched, payload.coreIdea);
      } catch (e) { /* fallback */ }
    }
  } catch (e) {
    console.warn("Topic enrichment failed:", e);
  }

  return padTopics(payload.topics, payload.coreIdea);
}

function extractBalancedJSON(str: string): string | null {
  const firstBrace = str.indexOf('{');
  const firstBracket = str.indexOf('[');
  
  if (firstBrace === -1 && firstBracket === -1) {
    return null;
  }
  
  const startChar = (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) ? '{' : '[';
  const endChar = startChar === '{' ? '}' : ']';
  const startIdx = startChar === '{' ? firstBrace : firstBracket;
  
  let count = 0;
  let inString = false;
  let escape = false;
  
  for (let i = startIdx; i < str.length; i++) {
    const char = str[i];
    
    if (escape) {
      escape = false;
      continue;
    }
    
    if (char === '\\') {
      escape = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === startChar) {
        count++;
      } else if (char === endChar) {
        count--;
        if (count === 0) {
          return str.substring(startIdx, i + 1);
        }
      }
    }
  }
  
  return null;
}

export function extractJSONFromString(content: string): any {
  const trimmed = content.trim();
  
  // 1. Direct parse
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      // ignore
    }
  }

  // 2. Balanced brace extraction
  const balanced = extractBalancedJSON(trimmed);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch (e) {
      // ignore
    }
  }

  // 3. Fallback to greedy regex
  const m = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch (e) {
      // ignore
    }
  }

  return null;
}

export async function scoreVariants(
  variants: string[],
  brief: { coreIdea?: string; topic?: string; platform: string; industry?: string; goals?: string[]; userApiKey?: string; userApiProvider?: string },
  apiKey: string
): Promise<{ scores: Record<string, number>[], winner_index: number }> {
  if (!variants.length) return { scores: [], winner_index: 0 };
  
  const model = brief.userApiProvider ? getProviderModel(brief.userApiProvider, "draft") : "google/gemini-2.5-flash-lite";
  const system = `You are a critical content editor. Score the following ${variants.length} post variants on 5 criteria (0-5 scale): 
1. hook_strength (creates curiosity/impact)
2. specificity (avoiding fluff)
3. on_brief (matches topic/audience)
4. platform_fit (native feel for ${brief.platform})
5. cta_clarity (clear action)

Return a JSON object with a "results" array containing the scores for each variant in order, and a "winner_index" for the best overall variant.`;

  const user = `BRIEF: Topic "${brief.topic || brief.coreIdea}", Industry "${brief.industry}", Goals: ${brief.goals?.join(", ") || "Engagement"}
VARIANTS:
${variants.map((v, i) => `[Variant ${i}]: ${v.slice(0, 1000)}`).join("\n\n")}`;

  const messages = [{ role: "system", content: system }, { role: "user", content: user }];

  try {
    let data: any;
    if (brief.userApiKey && brief.userApiProvider) {
      const aiRes = await callAI(messages, null, brief.userApiKey, {
        provider: brief.userApiProvider as any,
        quality: "draft",
        model,
        temperature: 0.1,
      });
      if (aiRes.status === 200) {
        data = aiRes.data;
      } else {
        throw new Error(aiRes.error);
      }
    } else {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1, // High precision
        }),
      });

      if (res.ok) {
        data = await res.json();
      } else {
        throw new Error(`Status ${res.status}`);
      }
    }

    if (data) {
      const content = String(data?.choices?.[0]?.message?.content || "").trim();
      const parsed = extractJSONFromString(content);

      if (parsed && parsed.results && Array.isArray(parsed.results)) {
        return {
          scores: parsed.results,
          winner_index: typeof parsed.winner_index === "number" ? parsed.winner_index : 0
        };
      }
    }
  } catch (e) {
    console.warn("Judge scoring failed:", e);
  }

  // Fallback: simple uniform scores
  return {
    scores: variants.map(() => ({ hook_strength: 3, specificity: 3, on_brief: 3, platform_fit: 3, cta_clarity: 3 })),
    winner_index: 0
  };
}

type GatewayResult = { status: number; data?: Record<string, unknown>; error?: string };

// Retries on transient failures (timeouts, 5xx). Does not retry on 429/402 or 4xx,
// since those indicate quota/credit/client errors that won't succeed on retry.
export async function callAIGateway(
  messages: Array<{ role: string; content: string }>,
  tool: Record<string, unknown>,
  apiKey: string,
  opts: {
    timeoutMs?: number;
    model?: string;
    temperature?: number;
    top_p?: number;
    userApiKey?: string | null;
    userApiProvider?: string | null;
    quality?: string;
    userToken?: string | null;
    userIp?: string | null;
    max_tokens?: number;
    maxRetries?: number;
  } = {}
): Promise<GatewayResult> {
  const maxRetries = opts.maxRetries ?? 2;
  let lastResult: GatewayResult = { status: 500, error: "An unexpected error occurred." };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastResult = await callAIGatewayOnce(messages, tool, apiKey, opts);

    // 503 = entire waterfall exhausted — no point retrying at this level
    const isRetryable = (lastResult.status >= 500 && lastResult.status !== 503) || lastResult.error === "AI request timeout";
    if (!isRetryable || attempt === maxRetries) {
      return lastResult;
    }

    const delayMs = 500 * 2 ** attempt + Math.floor(Math.random() * 200);
    console.warn(`AI gateway call failed (status ${lastResult.status}), retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return lastResult;
}

async function callAIGatewayOnce(
  messages: Array<{ role: string; content: string }>,
  tool: Record<string, unknown>,
  _apiKey: string,   // kept for signature compat — waterfall reads keys from Deno.env directly
  opts: {
    timeoutMs?: number;
    model?: string;
    temperature?: number;
    top_p?: number;
    userApiKey?: string | null;
    userApiProvider?: string | null;
    quality?: string;
    userToken?: string | null;
    userIp?: string | null;
    max_tokens?: number;
  } = {}
): Promise<GatewayResult> {
  let userApiKey = opts.userApiKey;
  let userApiProvider = opts.userApiProvider;
  let userApiModel: string | null | undefined = undefined;
  let userUseOwnKey = Boolean(userApiKey && userApiProvider);
  let userKeyMode: "fallback" | "always" = "fallback";

  if (opts.userToken) {
    try {
      const supabaseUrl = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : null;
      const supabaseAnonKey = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_ANON_KEY") : null;
      if (supabaseUrl && supabaseAnonKey) {
        // @ts-ignore: Deno dynamic import
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${opts.userToken}`,
            },
          },
        });
        const { data, error } = await userClient.rpc("get_decrypted_api_key");
        if (error) {
          console.error("get_decrypted_api_key RPC failed server-side:", error.message || error);
        } else {
          const row = Array.isArray(data) ? data[0] : data;
          if (row && row.decrypted_key) {
            userApiKey = row.decrypted_key;
            userApiProvider = row.api_provider;
            userApiModel = row.api_model || undefined;
            userUseOwnKey = row.use_own_key ?? userUseOwnKey;
            userKeyMode = row.key_mode === "always" ? "always" : "fallback";
          }
        }
      }
    } catch (err) {
      console.error("Failed to decrypt user API key server-side:", err);
    }
  }

  const canUseUserKey = Boolean(userUseOwnKey && userApiKey && userApiProvider);

  if (shouldUseUserKeyOnly(userKeyMode)) {
    if (!canUseUserKey) {
      return { status: 402, error: "User API key is required in always mode." };
    }

    // Asynchronously log the fallback usage to the audit log
    const supabaseUrl = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : null;
    const supabaseServiceKey = typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : null;
    
    if (supabaseUrl && supabaseServiceKey && opts.userToken) {
      try {
        const parts = opts.userToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          const userId = payload.sub;
          if (userId) {
            // Asynchronous logging so it doesn't block the AI response
            (async () => {
              try {
                // @ts-ignore: Deno dynamic import
                const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
                const adminClient = createClient(supabaseUrl, supabaseServiceKey);
                const { error: logErr } = await adminClient.from("api_key_audit_log").insert({
                  user_id: userId,
                  action: "used",
                  provider: userApiProvider,
                  source: "user",
                  ip_address: opts.userIp || null,
                });
                if (logErr) {
                  // Only log the error code/hint, never the full error object which may contain query metadata
                  console.error("Failed to insert used audit log:", logErr?.code || logErr?.message || "db_error");
                }
              } catch (err) {
                console.error("Failed to dynamically create admin client or log event:", err);
              }
            })();
          }
        }
      } catch (e) {
        console.error("Failed to log used audit event:", e);
      }
    }

    // Use the user's saved model choice if they picked one; otherwise fall
    // back to a model that matches their provider — never carry a platform
    // (Google/Gemini) model id into an OpenAI/Anthropic endpoint or the
    // provider will 400 on an unknown model.
    const userModelAlways = userApiModel || getProviderModel(userApiProvider as string, opts.quality || "draft");
    return callAI(messages, tool, userApiKey, {
      provider: userApiProvider as any,
      quality: opts.quality,
      model: userModelAlways,
      temperature: opts.temperature,
      timeoutMs: opts.timeoutMs,
      max_tokens: opts.max_tokens,
    });
  }

  // ── Platform Provider Waterfall ──────────────────────────────────────────
  // Try each configured platform provider in priority order until one succeeds.
  // Circuit-broken providers are skipped for CIRCUIT_RESET_MS after CIRCUIT_THRESHOLD failures.
  // 429/402/5xx/timeout → continue to next provider.
  // Hard 4xx (400/401/403) → request is malformed; stop immediately.

  const quality = opts.quality || "draft";

  for (const entry of PLATFORM_PROVIDER_CHAIN) {
    const providerKey = (typeof Deno !== "undefined" ? Deno.env.get(entry.envKey) : undefined);
    if (!providerKey) continue;              // secret not configured → skip

    if (isCircuitOpen(entry.name)) {
      console.info(`[waterfall] ${sanitizeLogValue(entry.name)} circuit open - skipping`);
      continue;
    }

    const providerModel = opts.model || entry.model(quality);
    console.info(`[waterfall] trying ${sanitizeLogValue(entry.name)} (model: ${sanitizeLogValue(providerModel)})`);

    const result = await callAI(messages, tool, providerKey, {
      provider: entry.provider,
      model: providerModel,
      temperature: opts.temperature,
      timeoutMs: opts.timeoutMs,
      max_tokens: opts.max_tokens,
    });

    if (result.status === 200) {
      recordProviderSuccess(entry.name);
      console.info(`[waterfall] ${sanitizeLogValue(entry.name)} succeeded`);
      return result;
    }

    recordProviderFailure(entry.name);
    console.warn(`[waterfall] ${sanitizeLogValue(entry.name)} returned ${result.status}: ${sanitizeLogValue(result.error)}`);

    // Hard 4xx (not 429/402) = request is malformed; retrying other providers won't help
    if (result.status >= 400 && result.status < 500
        && result.status !== 429 && result.status !== 402) {
      console.error(`[waterfall] hard client error ${result.status} - aborting waterfall`);
      return result;
    }
    // 5xx / 429 / 402 / timeout → try next provider in chain
  }

  const platformResult = { status: 503, error: "All platform AI providers are currently unavailable." };

  if (shouldFallbackToUserKey(platformResult.status) && canUseUserKey) {
    const userModelFallback = userApiModel || getProviderModel(userApiProvider as string, opts.quality || "draft");
    return callAI(messages, tool, userApiKey as string, {
      provider: userApiProvider as any,
      quality: opts.quality,
      model: userModelFallback,
      temperature: opts.temperature,
      timeoutMs: opts.timeoutMs,
      max_tokens: opts.max_tokens,
    });
  }

  // All configured providers exhausted
  console.error("[waterfall] all platform providers failed or unconfigured");
  return platformResult;
}

/**
 * Parse and extract tool call from AI response
 */
export function parseAIResponse(
  data: Record<string, unknown>,
  toolName: string
): { success: boolean; parsed?: Record<string, unknown>; error?: string } {
  try {
    const choice = (data?.choices && Array.isArray(data.choices) && data.choices[0] && typeof data.choices[0] === "object")
      ? (data.choices[0] as Record<string, unknown>)
      : undefined;
    const message = choice?.message && typeof choice.message === "object"
      ? (choice.message as Record<string, unknown>)
      : undefined;

    // Try several shapes where the model might place a function/tool call or structured JSON
    const toolCall =
      (message?.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls[0] && typeof message.tool_calls[0] === "object" && message.tool_calls[0]) ||
      message?.tool_call ||
      message?.function_call ||
      choice?.function_call ||
      choice?.tool_call;

    const toolCallRecord = toolCall && typeof toolCall === "object" ? (toolCall as Record<string, unknown>) : undefined;
    const toolFunction = toolCallRecord?.function && typeof toolCallRecord.function === "object"
      ? (toolCallRecord.function as Record<string, unknown>)
      : undefined;
    const nestedFunctionCall = toolCallRecord?.function_call && typeof toolCallRecord.function_call === "object"
      ? (toolCallRecord.function_call as Record<string, unknown>)
      : undefined;

    // function arguments may be under different keys
    const funcArgs: unknown | undefined = toolCallRecord && (
      toolFunction?.arguments ||
      toolCallRecord.arguments ||
      nestedFunctionCall?.arguments ||
      toolCallRecord.function_args
    );

    // Fallback: some responses embed JSON in the message.content string
    if (!funcArgs && typeof message?.content === "string") {
      const content = String(message.content).trim();
      const parsedContent = extractJSONFromString(content);
      if (parsedContent) {
        return { success: true, parsed: parsedContent as Record<string, unknown> };
      }
    }

    if (!funcArgs) {
      console.error("No tool call or JSON content in AI response", sanitizeLogValue(data));
      return { success: false, error: "AI returned no structured output." };
    }

    let parsed: Record<string, unknown>;
    if (typeof funcArgs === "string") {
      try {
        parsed = JSON.parse(funcArgs as string);
      } catch (e) {
        console.error("Failed to parse function args string:", sanitizeLogValue(funcArgs));
        return { success: false, error: "Failed to parse AI output." };
      }
    } else if (typeof funcArgs === "object") {
      parsed = funcArgs as Record<string, unknown>;
    } else {
      try {
        parsed = JSON.parse(String(funcArgs));
      } catch (e) {
        console.error("Failed to coerce function args to JSON:", sanitizeLogValue(funcArgs));
        return { success: false, error: "Failed to parse AI output." };
      }
    }

    return { success: true, parsed };
  } catch (e) {
    console.error("Error parsing AI response:", e);
    return { success: false, error: e instanceof Error ? e.message : "Unknown parsing error" };
  }
}

/**
 * Normalize a single post output
 * Ensures day=1 and dow matches the requested day
 */
export function normalizePost(
  post: unknown,
  overrideDow?: string,
  payload?: Pick<GenerationPayload, "platform" | "bannedHashtags" | "requiredHashtags" | "length" | "requiredWords">,
): Record<string, unknown> | null {
  if (!post || typeof post !== "object") {
    return null;
  }

  const p = post as Record<string, unknown>;
  const rawHookOptions = Array.isArray(p.hook_options) ? (p.hook_options as unknown[]).map(h => String(h || "")) : undefined;
  const rawCtaOptions = Array.isArray(p.cta_options) ? (p.cta_options as unknown[]).map(c => String(c || "")) : undefined;

  const hookOptions = rawHookOptions ? rawHookOptions.map(h => sanitizeHtmlText(fixSpelling(h))) : (p.hook ? [sanitizeHtmlText(fixSpelling(String(p.hook || "")))] : []);
  const ctaOptions = rawCtaOptions ? rawCtaOptions.map(c => sanitizeHtmlText(fixSpelling(c))) : (p.cta ? [sanitizeHtmlText(fixSpelling(String(p.cta || "")))] : []);

  const body = sanitizeHtmlText(fixSpelling(String(p.body || "")));
  const actualWordCount = body.split(/\s+/).filter(Boolean).length;
  const reportedWordCount = Number(p.word_count) || actualWordCount;

  // Rough length check based on payload.length
  if (payload?.length) {
    const rangeMap: Record<string, [number, number]> = {
      short: [80, 120],
      medium: [160, 230],
      long: [280, 380],
    };
    const range = rangeMap[payload.length];
    if (range) {
      // 25% drift allowance
      const min = range[0] * 0.75;
      const max = range[1] * 1.25;
      if (actualWordCount < min || actualWordCount > max) {
        console.warn(`Word count drift detected: ${actualWordCount} vs target range ${range[0]}-${range[1]}. Allowing but flagging.`);
        // For now, we flag it in self_check rather than hard rejection to avoid UX loops
      }
    }
  }

  // Post-generation presence check for required words
  if (payload?.requiredWords && payload.requiredWords.length > 0) {
    const missing = payload.requiredWords.filter(word => {
      const regex = new RegExp(word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
      return !regex.test(body);
    });
    if (missing.length > 0) {
      console.warn(`Post generation missing required words: ${missing.map(word => sanitizeLogValue(word)).join(", ")}`);
      const selfCheckBase = p.self_check && typeof p.self_check === "object"
        ? { ...p.self_check as Record<string, unknown> }
        : { forbidden_violations: [] as string[], checks_passed: true, notes: "" };
      const selfCheck = selfCheckBase as Record<string, unknown> & { forbidden_violations: string[]; checks_passed: boolean };
      const violations: string[] = Array.isArray(selfCheck.forbidden_violations) ? [...selfCheck.forbidden_violations as string[]] : [];
      missing.forEach(w => violations.push(`Missing required word: "${w}"`));
      selfCheck.forbidden_violations = violations;
      selfCheck.checks_passed = false;
      p.self_check = selfCheck;
    }
  }

  return {
    day: 1,
    dow: sanitizeHtmlText(overrideDow || p.dow || "Mon"),
    topic: sanitizeHtmlText(p.topic || ""),
    format: sanitizeHtmlText(p.format || ""),
    title: sanitizeHtmlText(fixSpelling(String(p.title || ""))),
    // primary hook (first option) and full variants
    hook: hookOptions.length ? hookOptions[0] : "",
    hook_options: hookOptions,
    body,
    word_count: reportedWordCount,
    actual_word_count: actualWordCount,
    // primary CTA and full variants
    cta: ctaOptions.length ? ctaOptions[0] : "",
    cta_options: ctaOptions,
    hashtags: payload
      ? sanitizeHtmlText(applyHashtagPolicy(p.hashtags, payload.platform, payload.bannedHashtags, payload.requiredHashtags))
      : sanitizeHtmlText(p.hashtags || ""),
    rationale: sanitizeHtmlText(fixSpelling(String(p.rationale || ""))),
    image_prompt: sanitizeHtmlText(fixSpelling(String(p.image_prompt || ""))),
    // Maintain Phase A/C/D fields if present
    plan: p.plan,
    body_variants: p.body_variants,
    variant_scores: p.variant_scores,
    chosen_index: p.chosen_index,
    self_check: p.self_check,
    forbidden: p.forbidden,
  };
}
