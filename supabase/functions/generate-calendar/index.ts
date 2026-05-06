// Generate a 7-day content calendar via Lovable AI Gateway
import {
  corsHeaders,
  LENGTH_GUIDE_WEEK as LENGTH_GUIDE,
  STRUCTURE_GUIDE,
  bannedPhrasesBlock,
  isLongFormPlatform,
  buildHashtagInstr,
  jsonResponse,
  checkRateLimit,
  cleanPayload,
  buildPromptContext,
  callAIGateway,
  parseAIResponse,
  applyHashtagPolicy,
} from "../_shared/promptHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const payload = cleanPayload(body);

    // Validate required fields
    if (!payload.coreIdea?.trim() || payload.topics.length === 0) {
      return jsonResponse({ error: "Missing core idea or topics." }, 400);
    }

    // Rate limiting: 10 requests per minute per user
    const authHeader = req.headers.get("authorization") || "anonymous";
    const userId = authHeader.replace("Bearer ", "").slice(0, 32) || "anonymous";
    const rateLimitCheck = await checkRateLimit(userId, "generate-calendar", {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return jsonResponse(
        { error: "Rate limit exceeded. Please wait a moment before trying again." },
        429
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "AI is not configured." }, 500);
    }

    const longFormPlatform = isLongFormPlatform(payload.platform);
    const lengthInstr = LENGTH_GUIDE[payload.length] || LENGTH_GUIDE.medium;
    const structureInstr = STRUCTURE_GUIDE[payload.structure] || STRUCTURE_GUIDE.mixed;
    const hashtagInstr = buildHashtagInstr(payload.platform, payload.bannedHashtags, payload.requiredHashtags, { every: true });

    const contextLines = buildPromptContext(payload, { includeTopics: true });

    const prompt = `You are a world-class ${payload.platform} content strategist specialising in ${payload.industryLabel || payload.industry} content.

Create a complete 7-day ${payload.platform} content calendar for this creator:
${contextLines}
- POST LENGTH: ${lengthInstr}
- POST STRUCTURE: ${structureInstr}
${payload.extra ? `- Extra instructions: ${payload.extra}` : ""}
${payload.bannedWords.length ? `- NEVER SAY (hard ban — do not use these words or close variants in any post): ${payload.bannedWords.join(", ")}` : ""}
${payload.requiredWords.length ? `- MUST MENTION (each of these terms must appear naturally in AT LEAST ONE post across the week): ${payload.requiredWords.join(", ")}` : ""}

HARD RULES (follow strictly):
1. Generate content that is genuinely specific to the ${payload.industryLabel || payload.industry} space — use real terminology, real platforms, real trends, real names where relevant. Do NOT write generic content.
2. Strictly follow the POST LENGTH and POST STRUCTURE rules above for the body of every post.
3. In the "format" field of each post, append the structure used (e.g. "List post — bullets", "Storytelling — paragraphs", "How-to — hybrid") so the user can see the mix at a glance.
4. ${hashtagInstr}
5. The chosen format mix "${payload.format}" must drive AT LEAST 4 of the 7 posts. The remaining 3 may vary for rhythm.
6. AT LEAST 3 of the 7 posts must include a concrete number, percentage, year, dollar figure, or named statistic embedded in the body or hook (not made-up — use realistic, defensible figures from the ${payload.industryLabel || payload.industry} space).
7. The "dow" field MUST be exactly one of: "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" — and the 7 posts must be ordered Mon → Sun, with "day" 1..7 matching that order.

${bannedPhrasesBlock()}`;

    const tool = {
      type: "function",
      function: {
        name: "return_calendar",
        description: "Return a 7-day content calendar as a structured array, ordered Mon → Sun.",
        parameters: {
          type: "object",
          properties: {
            posts: {
              type: "array",
              minItems: 7,
              maxItems: 7,
              items: {
                type: "object",
                properties: {
                  day: { type: "number", description: "1..7, matching Mon..Sun order" },
                  dow: {
                    type: "string",
                    enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                  },
                  topic: { type: "string" },
                  format: { type: "string" },
                  title: { type: "string" },
                  hook: { type: "string" },
                  body: { type: "string" },
                  cta: { type: "string" },
                  hashtags: {
                    type: "string",
                    description: longFormPlatform
                      ? "MUST be an empty string for Newsletter/Blog."
                      : "3–6 platform-native hashtags as a single space-separated string.",
                  },
                  rationale: { type: "string" },
                },
                required: ["day", "dow", "topic", "format", "title", "hook", "body", "cta", "hashtags", "rationale"],
                additionalProperties: false,
              },
            },
          },
          required: ["posts"],
          additionalProperties: false,
        },
      },
    };

    const aiRes = await callAIGateway(prompt, tool, LOVABLE_API_KEY);
    if (aiRes.status !== 200) {
      return jsonResponse({ error: aiRes.error }, aiRes.status);
    }

    const parseResult = parseAIResponse(aiRes.data || {}, "return_calendar");
    if (!parseResult.success) {
      return jsonResponse({ error: parseResult.error }, 500);
    }

    const parsed = parseResult.parsed as Record<string, unknown>;
    const posts = Array.isArray(parsed.posts)
      ? parsed.posts.map(post => {
          if (!post || typeof post !== "object") return post;
          const p = post as Record<string, unknown>;
          return {
            ...p,
            hashtags: applyHashtagPolicy(p.hashtags, payload.platform, payload.bannedHashtags, payload.requiredHashtags),
          };
        })
      : [];
    if (posts.length === 0) {
      return jsonResponse({ error: "AI returned an empty calendar." }, 500);
    }

    return jsonResponse({ posts });
  } catch (e) {
    console.error("generate-calendar error", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500
    );
  }
});
