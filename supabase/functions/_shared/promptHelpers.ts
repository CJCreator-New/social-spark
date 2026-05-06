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

// ─── PAYLOAD NORMALIZATION & CONTEXT BUILDING ─────────────────────────────

/**
 * Standardized payload structure shared across all generation functions
 */
export interface GenerationPayload {
  industry?: string;
  industryLabel?: string;
  platform?: string;
  coreIdea?: string;
  audiences?: string[];
  voice?: string;
  style?: string;
  goals?: string[];
  topic?: string;           // Single-post only
  topics?: string[];         // Calendar only
  dow?: string;              // Single-post only
  date?: string;             // Single-post only
  format?: string;
  cta?: string;
  length?: string;
  structure?: string;
  extra?: string;
  bannedWords?: string[];
  requiredWords?: string[];
  bannedHashtags?: string[];
  requiredHashtags?: string[];
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
    platform: String(payload.platform || "LinkedIn").trim(),
    coreIdea: String(payload.coreIdea || "").trim() || "",
    audiences: cleanList(payload.audiences, 10),
    voice: String(payload.voice || "").trim() || "",
    style: String(payload.style || "").trim() || "",
    goals: cleanList(payload.goals, 10),
    topic: String(payload.topic || "").trim() || "",
    topics: cleanList(payload.topics, 7),
    dow: String(payload.dow || "Mon").trim(),
    date: String(payload.date || "").trim() || "",
    format: String(payload.format || "Balanced mix").trim(),
    cta: String(payload.cta || "Share & repost bait").trim(),
    length: String(payload.length || "medium").trim(),
    structure: String(payload.structure || "mixed").trim(),
    extra: String(payload.extra || "").trim() || "",
    bannedWords: cleanList(payload.bannedWords, 20),
    requiredWords: cleanList(payload.requiredWords, 10),
    bannedHashtags: cleanTagList(payload.bannedHashtags, 30),
    requiredHashtags: cleanTagList(payload.requiredHashtags, 10),
  };
}

/**
 * Get payload with all default values
 */
export function getPayloadDefaults(): GenerationPayload {
  return {
    industry: "",
    industryLabel: "",
    platform: "LinkedIn",
    coreIdea: "",
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
    bannedWords: [],
    requiredWords: [],
    bannedHashtags: [],
    requiredHashtags: [],
  };
}

/**
 * Build the common prompt context lines (repeated in all functions)
 */
export function buildPromptContext(
  payload: GenerationPayload,
  opts: { includeTopics?: boolean; isSinglePost?: boolean } = {}
): string {
  const label = payload.industryLabel || payload.industry;
  const audiences = payload.audiences.length ? payload.audiences.join(", ") : "industry professionals";
  const voice = payload.voice || "conversational and professional";
  const style = payload.style || "balanced";
  const goals = payload.goals.length ? payload.goals.join(", ") : "Awareness, Engagement";

  let topicLine = "";
  if (opts.isSinglePost) {
    topicLine = `- Topic for this post: ${payload.topic}\n`;
  } else if (opts.includeTopics && payload.topics.length) {
    topicLine = `- Topics to cover (1 per day; use a wrap-up or adjacent topic for day 7 if fewer than 7 topics): ${payload.topics.join(", ")}\n`;
  }

  const dateNote = payload.date ? ` (${payload.date})` : "";

  const context = `- Industry / niche: ${label}
- Core idea: ${payload.coreIdea}
- Audience: ${audiences}
- Voice / tone: ${voice}
- Writing style: ${style}
- Goals: ${goals}
${topicLine}- Post format mix: ${payload.format}
- CTA approach: ${payload.cta}`;

  return context;
}

/**
 * Call the Lovable AI Gateway with unified error handling
 */
export async function callAIGateway(
  prompt: string,
  tool: Record<string, unknown>,
  apiKey: string,
  timeoutMs: number = 90000
): Promise<{ status: number; data?: Record<string, unknown>; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [tool],
        tool_choice: { type: "function", function: { name: tool.function?.name } },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 429) {
      return {
        status: 429,
        error: "Rate limit hit. Please wait a moment and try again.",
      };
    }

    if (res.status === 402) {
      return {
        status: 402,
        error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage.",
      };
    }

    if (!res.ok) {
      const text = await res.text();
      console.error(`AI gateway error ${res.status}:`, text);
      return {
        status: res.status || 500,
        error: `AI error: ${res.status}`,
      };
    }

    const data = await res.json();
    return { status: 200, data };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      console.error("AI request timeout");
      return { status: 500, error: "AI request timeout" };
    }
    console.error("AI gateway call failed:", e);
    return { status: 500, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/**
 * Parse and extract tool call from AI response
 */
export function parseAIResponse(
  data: Record<string, unknown>,
  toolName: string
): { success: boolean; parsed?: Record<string, unknown>; error?: string } {
  try {
    const toolCall = (data?.choices?.[0] as Record<string, unknown>)?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.error("No tool call in response", JSON.stringify(data));
      return { success: false, error: "AI returned no structured output." };
    }

    const funcArgs = (toolCall as Record<string, unknown>)?.function?.arguments;
    if (!funcArgs) {
      console.error("No function arguments in tool call", JSON.stringify(toolCall));
      return { success: false, error: "AI returned incomplete output." };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(String(funcArgs));
    } catch (e) {
      console.error("Failed to parse tool args:", e);
      return { success: false, error: "Failed to parse AI output." };
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
  overrideDow?: string
): Record<string, unknown> | null {
  if (!post || typeof post !== "object") {
    return null;
  }

  const p = post as Record<string, unknown>;
  return {
    day: 1,
    dow: overrideDow || p.dow || "Mon",
    topic: p.topic || "",
    format: p.format || "",
    title: p.title || "",
    hook: p.hook || "",
    body: p.body || "",
    cta: p.cta || "",
    hashtags: p.hashtags || "",
    rationale: p.rationale || "",
  };
}
