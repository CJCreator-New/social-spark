// Generate a 7-day content calendar via Lovable AI Gateway
import {
  corsHeaders,
  LENGTH_GUIDE_WEEK as LENGTH_GUIDE,
  STRUCTURE_GUIDE,
  bannedPhrasesBlock,
  isLongFormPlatform,
  buildHashtagInstr,
  buildCinematicImagePromptRules,
  jsonResponse,
  checkRateLimit,
  cleanPayload,
  buildPromptContext,
  enrichTopics,
  callAIGateway,
  buildSystemMessage,
  buildUserMessage,
  parseAIResponse,
  applyHashtagPolicy,
  scoreVariants,
  normalizePost,
  recordServerTelemetryEvent,
} from "../_shared/promptHelpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const payload = cleanPayload(body);
    if (!payload.topics || payload.topics.length === 0) {
      console.info("generate-calendar: no topics provided; AI should infer topics from core idea or industry.", { industry: payload.industry, industryLabel: payload.industryLabel });
    }

    // Validate required fields (topics are optional; if omitted, AI may infer sensible topics)
    if (!payload.coreIdea?.trim()) {
      return jsonResponse({ error: "Missing core idea." }, 400);
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

    // Phase D: Topic enrichment pre-call (calendar only)
    let enrichedPayload = { ...payload };
    if (payload.topics.length > 0 || payload.coreIdea) {
      const enrichedTopics = await enrichTopics(payload, LOVABLE_API_KEY);
      if (enrichedTopics && enrichedTopics.length >= 7) {
        enrichedPayload.topics = enrichedTopics;
      }
    }

    const lengthInstr = LENGTH_GUIDE[payload.length] || LENGTH_GUIDE.medium;
    const structureInstr = STRUCTURE_GUIDE[payload.structure] || STRUCTURE_GUIDE.mixed;
    const hashtagInstr = buildHashtagInstr(payload.platform, payload.bannedHashtags, payload.requiredHashtags, { every: true });

    const includeTopics = Array.isArray(enrichedPayload.topics) && enrichedPayload.topics.length > 0;
    const contextLines = buildPromptContext(enrichedPayload, { includeTopics });

    const systemMsg = buildSystemMessage(enrichedPayload, { includeTopics });
    const userMsg = buildUserMessage(enrichedPayload, { includeTopics });

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
                    hook_options: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
                  body: { type: "string" },
                    cta: { type: "string" },
                    cta_options: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
                    image_prompt: { type: "string" },
                  // Phase A additions: plan + variants + self-check
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
                    description: isLongFormPlatform(payload.platform)
                      ? "MUST be an empty string for Newsletter/Blog."
                      : "3–6 platform-native hashtags as a single space-separated string.",
                  },
                  rationale: { type: "string" },
                },
                  required: ["day", "dow", "topic", "format", "title", "hook", "body", "cta", "hashtags", "rationale", "image_prompt"],
                additionalProperties: false,
              },
            },
          },
          required: ["posts"],
          additionalProperties: false,
        },
      },
    };

    const model = payload.quality === "polished" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
    const temperature = payload.quality === "polished" ? 0.55 : 0.7;

    const aiRes = await callAIGateway([
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg },
    ], tool, LOVABLE_API_KEY, { model, temperature });
    if (aiRes.status !== 200) {
      return jsonResponse({ error: aiRes.error }, aiRes.status);
    }

    const parseResult = parseAIResponse(aiRes.data || {}, "return_calendar");
    if (!parseResult.success) {
      return jsonResponse({ error: parseResult.error }, 500);
    }

    let parsed = parseResult.parsed as Record<string, unknown>;
    let initialPosts = Array.isArray(parsed.posts) ? parsed.posts : [];
    
    // Task 4: LLM-as-judge scoring for each post in the calendar
    const scoredPosts = await Promise.all(initialPosts.map(async (p: any) => {
      const candidates = [String(p.body || "")];
      if (Array.isArray(p.body_variants)) {
        candidates.push(...p.body_variants.map((v: any) => String(v || "")));
      }
      
      if (candidates.length > 1) {
        const judgeRes = await scoreVariants(candidates, payload, LOVABLE_API_KEY || "");
        p.variant_scores = judgeRes.scores;
        p.chosen_index = judgeRes.winner_index;
        // Auto-pick the winner
        if (judgeRes.winner_index > 0 && judgeRes.winner_index < candidates.length) {
          p.body = candidates[judgeRes.winner_index];
        }
      }

      const normalized = normalizePost(p, p.dow, payload);
      return normalized || p;
    }));

    let posts = scoredPosts;
    if (posts.length === 0) {
      return jsonResponse({ error: "AI returned an empty calendar." }, 500);
    }

    // If polished quality requested, run a second pass to polish the whole calendar into a publication-ready week
    if (payload.quality === "polished") {
      try {
        const polishSystem = systemMsg + "\n\nPOLISHING RUBRIC:\n- Ensure each post opens with a strong, specific hook.\n- Tighten and clarify language; remove vague phrases.\n- Improve CTAs for clarity and action.\n- Preserve angles and avoid introducing new topics.\n- Apply consistent platform-native formatting across the week.";
        const polishUser = `Polish the following calendar JSON to a higher-quality, publication-ready week using the rubric above. Return using the same 'return_calendar' function schema.\n\nCURRENT_CALENDAR_JSON:\n${JSON.stringify({ posts }, null, 2)}`;

        const polishRes = await callAIGateway([
          { role: "system", content: polishSystem },
          { role: "user", content: polishUser },
        ], tool, LOVABLE_API_KEY, { model: "google/gemini-2.5-pro", temperature: 0.45 });

        if (polishRes.status === 200) {
          const polishParse = parseAIResponse(polishRes.data || {}, "return_calendar");
          if (polishParse.success) {
            const polishedParsed = polishParse.parsed as Record<string, unknown>;
            const polishedPosts = Array.isArray(polishedParsed.posts) ? polishedParsed.posts : null;
            if (polishedPosts) {
              posts = polishedPosts.map(p => normalizePost(p, (p as any).dow, payload) || p);
            }
          }
        }
      } catch (e) {
        console.warn("Calendar polish pass failed, returning initial draft", e);
      }
    }

    const responseBody: Record<string, unknown> = { posts };
    if ((payload as unknown as Record<string, unknown>).inferredTopics) {
      responseBody.meta = { inferredTopics: true };
      console.info("generate-calendar: marking response with meta.inferredTopics = true");
      await recordServerTelemetryEvent("generate_topics_inferred", {
        endpoint: "generate-calendar",
        mode: "full-week",
        platform: payload.platform,
        industry: payload.industryLabel || payload.industry,
        coreIdea: payload.coreIdea,
      });
    }

    return jsonResponse(responseBody);
  } catch (e) {
    console.error("generate-calendar error", e, e instanceof Error ? e.stack : undefined);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500
    );
  }
});
