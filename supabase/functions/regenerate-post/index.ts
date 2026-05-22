// Regenerate a single post in a 7-day calendar via Lovable AI Gateway.
import {
  corsHeaders,
  LENGTH_GUIDE_SINGLE as LENGTH_GUIDE,
  STRUCTURE_GUIDE,
  bannedPhrasesBlock,
  buildEngagementRules,
  isLongFormPlatform,
  buildHashtagInstr,
  jsonResponse,
  checkRateLimit,
  cleanPayload,
  normalizePost,
} from "../_shared/promptHelpers.ts";

interface ExistingPost {
  day: number;
  dow: string;
  topic: string;
  format?: string;
  title?: string;
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string;
  rationale?: string;
}

const TWEAK_INSTRUCTIONS: Record<string, string> = {
  "shorter": "TWEAK: Keep the same angle, hook, and CTA, but cut the body length by ~35%. Tighten every sentence. Remove anything not load-bearing.",
  "punchier": "TWEAK: Keep the same angle, but rewrite for more impact — shorter sentences, stronger verbs, sharper opener. No fluff.",
  "add-stat": "TWEAK: Keep the same angle, but weave in 1–2 specific, plausible statistics or concrete numbers (e.g. percentages, dollar figures, time spans). Cite them as 'roughly' or 'around' if you can't be sure.",
  "remove-emoji": "TWEAK: Keep the same angle and structure, but remove ALL emojis from the title, hook, body, and CTA. Replace with plain punctuation.",
  "more-personal": "TWEAK: Keep the same angle, but rewrite in first-person with a small, specific personal anecdote or observation in the hook. Make it feel like a human wrote it, not a brand.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const payload = cleanPayload(body);

    // Extract post-specific fields
    const post = body.post as ExistingPost | undefined;
    const siblings = (body.siblings as ExistingPost[] | undefined) || [];
    const newTopic = body.newTopic as string | undefined;
    const tweak = body.tweak as "shorter" | "punchier" | "add-stat" | "remove-emoji" | "more-personal" | undefined;

    if (!post || typeof post.day !== "number" || !post.dow) {
      return jsonResponse({ error: "Missing post context (day/dow required)." }, 400);
    }

    // Rate limiting: 30 requests per minute per user (regenerate is frequent)
    const authHeader = req.headers.get("authorization") || "anonymous";
    const userId = authHeader.replace("Bearer ", "").slice(0, 32) || "anonymous";
    const rateLimitCheck = await checkRateLimit(userId, "regenerate-post", {
      maxRequests: 30,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return jsonResponse(
        { error: "Rate limit exceeded. Please wait a moment before trying again." },
        429
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI is not configured." }, 500);

    const longFormPlatform = isLongFormPlatform(payload.platform);
    const targetTopic = (newTopic && newTopic.trim()) || post.topic || "general topic";
    const lengthInstr = LENGTH_GUIDE[payload.length] || LENGTH_GUIDE.medium;
    const structureInstr = STRUCTURE_GUIDE[payload.structure] || STRUCTURE_GUIDE.mixed;
    const tweakInstr = (tweak && TWEAK_INSTRUCTIONS[tweak]) || "";
    const hashtagInstr = buildHashtagInstr(payload.platform, payload.bannedHashtags, payload.requiredHashtags, { every: false });

    const siblingSummary = siblings
      .filter(s => s && s.day !== post.day)
      .map(s => `- Day ${s.day} (${s.dow}) · "${s.topic}" — opener: "${(s.hook || s.title || "").slice(0, 100)}"`)
      .join("\n");

    const prompt = `You are a world-class ${payload.platform} content strategist specialising in ${payload.industryLabel || payload.industry} content.

Re-write a SINGLE post (Day ${post.day} — ${post.dow}) in an existing 7-day ${payload.platform} content calendar. The other 6 posts are unchanged — your post must feel fresh and complementary, not duplicative.

CONTEXT:
- Industry / niche: ${payload.industryLabel || payload.industry}
- Core idea: ${payload.coreIdea}
- Audience: ${payload.audiences.length ? payload.audiences.join(", ") : "industry professionals"}
- Voice / tone: ${payload.voice || "conversational and professional"}
- Writing style: ${payload.style || "balanced"}
- Goals: ${payload.goals.join(", ") || "Awareness, Engagement"}
- Post format mix: ${payload.format}
- CTA approach: ${payload.cta}
- POST LENGTH: ${lengthInstr}
- POST STRUCTURE: ${structureInstr}
${payload.extra ? `- Extra instructions: ${payload.extra}` : ""}
${payload.bannedWords.length ? `- NEVER SAY (hard ban — do not use these words or close variants): ${payload.bannedWords.join(", ")}` : ""}
${payload.requiredWords.length ? `- TRY TO MENTION (prefer naturally weaving in at least one of these if it fits the topic): ${payload.requiredWords.join(", ")}` : ""}


${buildEngagementRules(payload.platform)}

OUTPUT VARIANTS:
- Provide 3 distinct hook options and 2 CTA variants. Place them in the structured fields hook_options and cta_options. The primary hook and cta may be the first items from those arrays.

THIS POST:
- Day: ${post.day} (${post.dow})
- Topic: ${targetTopic}
${tweakInstr ? "" : (post.title ? `- Previous title (do NOT reuse): "${post.title}"` : "")}
${tweakInstr ? "" : (post.hook ? `- Previous hook (do NOT reuse opener): "${post.hook.slice(0, 120)}"` : "")}
${tweakInstr ? `\nCURRENT VERSION TO TWEAK (preserve angle, transform per tweak instruction):\n- Title: "${post.title || ""}"\n- Hook: "${post.hook || ""}"\n- Body: "${(post.body || "").slice(0, 600)}"\n- CTA: "${post.cta || ""}"\n` : ""}
${tweakInstr ? tweakInstr + "\n" : ""}
OTHER POSTS IN THIS WEEK (do NOT duplicate angles, openers, statistics, or examples):
${siblingSummary || "(none provided)"}

HARD RULES:
1. ${tweakInstr ? `Apply the TWEAK above to the current version. Keep the same core angle and topic.` : `Write a genuinely fresh take on "${targetTopic}" that does NOT repeat the previous title/hook above.`}
2. Stay specific to the ${payload.industryLabel || payload.industry} space — real terminology, real platforms, real trends.
3. Follow the POST LENGTH and POST STRUCTURE rules exactly${tweakInstr === TWEAK_INSTRUCTIONS.shorter ? " (the 'shorter' tweak overrides the length target)" : ""}.
4. ${hashtagInstr}
5. The "dow" field MUST be "${post.dow}" and "day" MUST be ${post.day}.
6. In the "format" field, append the structure used (e.g. "How-to — hybrid").

${bannedPhrasesBlock()}`;

    const tool = {
      type: "function",
      function: {
        name: "return_post",
        description: "Return a single re-written post with full structure.",
        parameters: {
          type: "object",
          properties: {
            day: { type: "number" },
            dow: { type: "string", enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
            topic: { type: "string" },
            format: { type: "string" },
            title: { type: "string" },
              hook: { type: "string" },
              hook_options: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
            body: { type: "string" },
              cta: { type: "string" },
              cta_options: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
            hashtags: {
              type: "string",
              description: longFormPlatform
                ? "MUST be empty string for Newsletter/Blog."
                : "3–6 platform-native hashtags space-separated.",
            },
            rationale: { type: "string" },
          },
          required: ["day", "dow", "topic", "format", "title", "hook", "body", "cta", "hashtags", "rationale"],
          additionalProperties: false,
        },
      },
    };

    const aiRes = await callAIGateway(prompt, tool, LOVABLE_API_KEY);
    if (aiRes.status !== 200) {
      return jsonResponse({ error: aiRes.error }, aiRes.status);
    }

    const parseResult = parseAIResponse(aiRes.data || {}, "return_post");
    if (!parseResult.success) {
      return jsonResponse({ error: parseResult.error }, 500);
    }

    const parsed = parseResult.parsed as Record<string, unknown>;
    const regenerated = normalizePost(parsed, post.dow, payload);
    if (!regenerated) {
      return jsonResponse({ error: "Failed to normalize post response." }, 500);
    }

    // Force day to match the original slot
    regenerated.day = post.day;

    // If feedback was provided, try to store it for later review/analytics
    try {
      const feedbackText = (body.feedback as string | undefined) || body.feedbackText || null;
      const feedbackCategory = (body.feedbackCategory as string | undefined) || null;
      const feedbackRating = typeof body.feedbackRating === "number" ? body.feedbackRating : null;
      const calendarId = (body.calendarId as string | undefined) || null;
      if (feedbackText) {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (SUPABASE_URL && SUPABASE_KEY) {
          const row = {
            calendar_id: calendarId,
            day: post.day,
            dow: post.dow,
            platform: payload.platform || null,
            feedback: feedbackText,
            category: feedbackCategory,
            rating: feedbackRating,
            tweak: tweak || null,
            ts: new Date().toISOString(),
          } as Record<string, unknown>;
          // best-effort insert via REST
          fetch(`${SUPABASE_URL}/rest/v1/regenerate_feedback`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              Prefer: "return=representation",
            },
            body: JSON.stringify(row),
          }).catch(e => console.warn("Failed to record regenerate feedback", e));
        }
      }
    } catch (e) {
      console.warn("Error while storing feedback", e);
    }

    return jsonResponse({ post: regenerated });
  } catch (e) {
    console.error("regenerate-post error", e, e?.stack);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500
    );
  }
});
