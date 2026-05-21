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
      default:
        return "Native to the platform. Match the platform's expectations and keep the tone natural.";
    }
  })();

  return `\nENGAGEMENT RULES:\n- Open with a strong hook in the first line, not a summary.\n- Focus on one clear idea only.\n- Use concrete examples, numbers, or short stories whenever possible.\n- Avoid vague hype, filler, and overused marketing phrases.\n- End with a CTA that matches the goal: question, invitation, comment prompt, save/share prompt, or next step.\n- ${platformGuidance}`;
}

export function getPlatformPreset(platform: string): string {
  switch (platform) {
    case "LinkedIn":
      return `\nPLATFORM PRESCRIPT: LinkedIn posts should open with a professional insight or data point, include a short explanation, and end with a discussion prompt. Example hook: "70% of startups fail because..."`;
    case "Instagram":
      return `\nPLATFORM PRESCRIPT: Instagram captions should start with a scroll-stopping line, include a 1-2 sentence micro-story or vivid image, and a short CTA like "Save this" or "Share your story".`;
    case "X":
      return `\nPLATFORM PRESCRIPT: X posts must be concise (one to three short sentences), bold in opinion, and formatted for quick replies and retweets. Avoid long explanations.`;
    case "Facebook":
      return `\nPLATFORM PRESCRIPT: Facebook posts can be slightly longer, warm, and community-focused. Invite comments and sharing; include a clear question.`;
    default:
      return `\nPLATFORM PRESCRIPT: Match the platform's native style.`;
  }
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
function buildContentRules(platform: string): string {
  return `\nCONTENT RULES:\n- Do not use markdown syntax in post text: no **bold**, *italic*, headings, or inline code.\n- Use plain-text bullets only (• or →). Do not combine bullets with markdown formatting.\n- Rotate CTA verbs across the week; do not repeat the same CTA verb on every post.\n- Stay tightly within the user's stated topic angle; do not introduce tangential sub-topics unless requested.\n- Keep the post platform-native: LinkedIn = insight-led, Instagram = visual/story-driven, X = concise/opinionated, Facebook = warm/community-first.\n- If the topic is India-specific, incorporate current Indian trends (Digital India, EV adoption, startup ecosystem), regional contexts (South/North/East/West differences), and cultural references (jugaad innovation, dharma/responsibility themes) where relevant.\n- Reference upcoming festivals (Diwali, Holi, Durga Puja) and national events (Republic Day) in seasonal content.\n- Use American English spelling: optimizing, organizing, recognizing, analyzing, utilizing, emphasizing.\n- Avoid British spellings such as organising, optimising, recognising, analysing, utilising, emphasising.${buildEngagementRules(platform)}`;
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
- CTA approach: ${payload.cta}${buildContentRules(payload.platform)}`;

  // Append a short platform preset to help the model match native conventions
  return context + getPlatformPreset(payload.platform);
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
  overrideDow?: string,
  payload?: Pick<GenerationPayload, "platform" | "bannedHashtags" | "requiredHashtags">,
): Record<string, unknown> | null {
  if (!post || typeof post !== "object") {
    return null;
  }

  const p = post as Record<string, unknown>;
  const rawHookOptions = Array.isArray(p.hook_options) ? (p.hook_options as unknown[]).map(h => String(h || "")) : undefined;
  const rawCtaOptions = Array.isArray(p.cta_options) ? (p.cta_options as unknown[]).map(c => String(c || "")) : undefined;

  const hookOptions = rawHookOptions ? rawHookOptions.map(h => fixSpelling(h)) : (p.hook ? [fixSpelling(String(p.hook || ""))] : []);
  const ctaOptions = rawCtaOptions ? rawCtaOptions.map(c => fixSpelling(c)) : (p.cta ? [fixSpelling(String(p.cta || ""))] : []);

  return {
    day: 1,
    dow: overrideDow || p.dow || "Mon",
    topic: p.topic || "",
    format: p.format || "",
    title: fixSpelling(String(p.title || "")),
    // primary hook (first option) and full variants
    hook: hookOptions.length ? hookOptions[0] : "",
    hook_options: hookOptions,
    body: fixSpelling(String(p.body || "")),
    // primary CTA and full variants
    cta: ctaOptions.length ? ctaOptions[0] : "",
    cta_options: ctaOptions,
    hashtags: payload
      ? applyHashtagPolicy(p.hashtags, payload.platform, payload.bannedHashtags, payload.requiredHashtags)
      : p.hashtags || "",
    rationale: fixSpelling(String(p.rationale || "")),
  };
}
