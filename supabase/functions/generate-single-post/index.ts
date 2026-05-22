// Generate a SINGLE post (one chosen day) via Lovable AI Gateway.
import {
  corsHeaders,
  VALID_DOW,
  LENGTH_GUIDE_SINGLE as LENGTH_GUIDE,
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
  normalizePost,
} from "../_shared/promptHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const payload = cleanPayload(body);

    // Validate required fields
    if (!payload.coreIdea?.trim()) return jsonResponse({ error: "Missing core idea." }, 400);
    if (!payload.topic?.trim()) return jsonResponse({ error: "Missing topic." }, 400);
    if (!VALID_DOW.has(payload.dow)) return jsonResponse({ error: "Invalid day-of-week." }, 400);

    // Rate limiting: 20 requests per minute per user (higher for single-post as it's faster)
    const authHeader = req.headers.get("authorization") || "anonymous";
    const userId = authHeader.replace("Bearer ", "").slice(0, 32) || "anonymous";
    const rateLimitCheck = await checkRateLimit(userId, "generate-single-post", {
      maxRequests: 20,
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

    const lengthInstr = LENGTH_GUIDE[payload.length] || LENGTH_GUIDE.medium;
    const structureInstr = STRUCTURE_GUIDE[payload.structure] || STRUCTURE_GUIDE.mixed;
    const hashtagInstr = buildHashtagInstr(payload.platform, payload.bannedHashtags, payload.requiredHashtags, { every: false });

    const dateNote = payload.date ? ` (${payload.date})` : "";
    const contextLines = buildPromptContext(payload, { isSinglePost: true });

    const prompt = `You are a world-class ${payload.platform} content strategist specialising in ${payload.industryLabel || payload.industry} content.

Write a SINGLE high-impact ${payload.platform} post for ${payload.dow}${dateNote}.
${contextLines}
- POST LENGTH: ${lengthInstr}
- POST STRUCTURE: ${structureInstr}
${payload.extra ? `- Extra instructions: ${payload.extra}` : ""}
${payload.bannedWords.length ? `- NEVER SAY (hard ban — do not use these words or close variants): ${payload.bannedWords.join(", ")}` : ""}
${payload.requiredWords.length ? `- TRY TO MENTION (weave in naturally if it fits): ${payload.requiredWords.join(", ")}` : ""}

OUTPUT VARIANTS:
- Provide 3 distinct hook options and 2 CTA variants. Place them in the structured fields hook_options (array) and cta_options (array). The primary hook and cta may be the first items from those arrays.

HARD RULES:
1. Stay specific to the ${payload.industryLabel || payload.industry} space — real terminology, real platforms, real trends.
2. Follow the POST LENGTH and POST STRUCTURE rules exactly.
3. ${hashtagInstr}
4. The "dow" field MUST be exactly "${payload.dow}" and "day" MUST be 1.
5. In the "format" field, append the structure used (e.g. "How-to — hybrid").
6. Include at least one concrete number, percentage, year, or named statistic in the body or hook (realistic, defensible).

${bannedPhrasesBlock()}`;

    const tool = {
      type: "function",
      function: {
        name: "return_post",
        description: "Return a single platform-native post.",
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
              description: isLongFormPlatform(payload.platform) ? "MUST be empty for Newsletter/Blog." : "3–6 hashtags, space-separated.",
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
    const post = normalizePost(parsed, payload.dow, payload);
    if (!post) {
      return jsonResponse({ error: "Failed to normalize post response." }, 500);
    }

    return jsonResponse({ post });
  } catch (e) {
    console.error("generate-single-post error", e, e?.stack);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500
    );
  }
});
