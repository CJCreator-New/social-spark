declare const Deno: any;

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
  buildCinematicImagePromptRules,
  buildSystemMessage,
  buildUserMessage,
  callAIGateway,
  parseAIResponse,
  normalizePost,
  scoreVariants,
  recordServerTelemetryEvent,
  getUserIdFromToken,
} from "../_shared/promptHelpers.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const payload = cleanPayload(body);
    if (!payload.topic) {
      console.info("generate-single-post: no topic provided; AI may infer topic from core idea or industry.", { industry: payload.industry, industryLabel: payload.industryLabel });
    }

    // Validate required fields (topic is optional — AI can infer a topic from core idea)
    if (!payload.coreIdea?.trim()) return jsonResponse({ error: "Missing core idea." }, 400);
    if (!VALID_DOW.has(payload.dow)) return jsonResponse({ error: "Invalid day-of-week." }, 400);

    // Rate limiting: 20 requests per minute per user (higher for single-post as it's faster)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const userId = getUserIdFromToken(token);
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
    // If no explicit topic was provided, allow the model to infer one from the core idea
    const contextLines = buildPromptContext(payload, { isSinglePost: true });

    const systemMsg = buildSystemMessage(payload, { isSinglePost: true });
    const userMsg = buildUserMessage(payload, { isSinglePost: true });

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
              image_prompt: { type: "string" },
            // New plan + variants + self-check schema (Phase A additions)
            plan: {
              type: "object",
              properties: {
                angle: { type: "string" },
                hook_thesis: { type: "string" },
                proof_points: { type: "array", items: { type: "string" } },
                cta_intent: { type: "string" },
              },
              additionalProperties: false,
            },
            body_variants: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 2 },
            chosen_index: { type: "number" },
            word_count: { type: "number", description: "Actual word count of the generated body." },
            self_check: {
              type: "object",
              properties: {
                forbidden_violations: { type: "array", items: { type: "string" } },
                checks_passed: { type: "boolean" },
                notes: { type: "string" },
              },
              additionalProperties: false,
            },
            forbidden: { type: "array", items: { type: "string" } },
            hashtags: {
              type: "string",
              description: isLongFormPlatform(payload.platform) ? "MUST be empty for Newsletter/Blog." : "3–6 hashtags, space-separated.",
            },
            rationale: { type: "string" },
          },
          required: ["day", "dow", "topic", "format", "title", "hook", "body", "cta", "hashtags", "rationale", "image_prompt"],
          additionalProperties: false,
        },
      },
    };

    // Choose defaults for model and temperature per route (Phase A)
    const model = payload.quality === "polished" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
    const temperature = payload.quality === "polished" ? 0.6 : 0.8;

    const aiRes = await callAIGateway(
      [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }],
      tool,
      LOVABLE_API_KEY,
      {
        model,
        temperature,
        userApiKey: payload.userApiKey,
        userApiProvider: payload.userApiProvider,
        quality: payload.quality,
        userToken: token || null,
        userIp: ipAddress,
        max_tokens: 8192
      }
    );
    if (aiRes.status !== 200) {
      return jsonResponse({ error: aiRes.error }, aiRes.status);
    }

    const parseResult = parseAIResponse(aiRes.data || {}, "return_post");
    if (!parseResult.success) {
      return jsonResponse({ error: parseResult.error }, 500);
    }

    let parsed = parseResult.parsed as Record<string, unknown>;

    // Task 4: LLM-as-judge scoring if variants exist
    const candidates = [String(parsed.body || "")];
    if (Array.isArray(parsed.body_variants)) {
      candidates.push(...parsed.body_variants.map(v => String(v || "")));
    }
    
    if (candidates.length > 1) {
      const judgeRes = await scoreVariants(candidates, payload, LOVABLE_API_KEY || "");
      parsed.variant_scores = judgeRes.scores;
      parsed.chosen_index = judgeRes.winner_index;
      // Auto-pick the winner
      if (judgeRes.winner_index > 0 && judgeRes.winner_index < candidates.length) {
        parsed.body = candidates[judgeRes.winner_index];
      }
    }

    let post = normalizePost(parsed, payload.dow, payload);
    if (!post) {
      return jsonResponse({ error: "Failed to normalize post response." }, 500);
    }

    // Attach scores to the final output
    post.variant_scores = parsed.variant_scores;

    // If user requested a polished output, do a concise self-critique + rewrite pass on the pro model
    if (payload.quality === "polished") {
      try {
        const polishSystem = systemMsg + "\n\nPOLISHING RUBRIC:\n- Remove any filler or vague language. \n- Strengthen hooks for curiosity and specificity.\n- Improve readability: shorter sentences, clearer verbs.\n- Ensure CTA is actionable and tied to the goal.\n- Preserve the core angle and facts.\n- Keep platform-native formatting.\n";
        const polishUser = `Please polish the following single post JSON to a higher-quality, publication-ready version using the rubric above. Return using the same function schema (return_post).\n\nCURRENT_POST_JSON:\n${JSON.stringify(parsed, null, 2)}`;

        const polishRes = await callAIGateway(
          [{ role: "system", content: polishSystem }, { role: "user", content: polishUser }],
          tool,
          LOVABLE_API_KEY,
          {
            model: "google/gemini-2.5-pro",
            temperature: 0.45,
            userApiKey: payload.userApiKey,
            userApiProvider: payload.userApiProvider,
            quality: payload.quality,
            userToken: token || null,
            userIp: ipAddress,
            max_tokens: 8192
          }
        );
        if (polishRes.status === 200) {
          const polishParse = parseAIResponse(polishRes.data || {}, "return_post");
          if (polishParse.success) {
            parsed = polishParse.parsed as Record<string, unknown>;
            const polished = normalizePost(parsed, payload.dow, payload);
            if (polished) post = polished;
          }
        }
      } catch (e) {
        console.warn("Polish pass failed, returning initial draft", e);
      }
    }

    const responseBody: Record<string, unknown> = { post };
    if ((payload as unknown as Record<string, unknown>).inferredTopics) {
      responseBody.meta = { inferredTopics: true };
      console.info("generate-single-post: marking response with meta.inferredTopics = true");
      await recordServerTelemetryEvent("generate_topics_inferred", {
        endpoint: "generate-single-post",
        mode: "single-day",
        platform: payload.platform,
        industry: payload.industryLabel || payload.industry,
        coreIdea: payload.coreIdea,
        dow: payload.dow,
      });
    }

    return jsonResponse(responseBody);
  } catch (e) {
    console.error("generate-single-post error", e instanceof Error ? e.stack : e);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});
