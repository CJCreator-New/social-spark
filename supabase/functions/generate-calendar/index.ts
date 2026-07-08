declare const Deno: any;

// Generate a 7-day content calendar via Lovable AI Gateway
import {
  getCorsHeaders,
  LENGTH_GUIDE_WEEK as LENGTH_GUIDE,
  STRUCTURE_GUIDE,
  bannedPhrasesBlock,
  isLongFormPlatform,
  buildHashtagInstr,
  buildCinematicImagePromptRules,
  jsonResponse,
  checkContentLength,
  checkRateLimit,
  cleanPayload,
  buildPromptContext,
  enrichTopics,
  getTrendingTopics,
  callAIGateway,
  buildSystemMessage,
  buildUserMessage,
  parseAIResponse,
  applyHashtagPolicy,
  normalizePost,
  recordServerTelemetryEvent,
  getVerifiedUserId,
  errorResponse,
  checkQuota,
  incrementGenerationCount,
  quotaExceededMessage,
} from "../_shared/promptHelpers.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req.headers.get("origin")) });
  }

  try {
    const sizeError = checkContentLength(req);
    if (sizeError) return sizeError;

    const body = await req.json();
    const payload = cleanPayload(body);
    if (!payload.topics || payload.topics.length === 0) {
      console.info(
        "generate-calendar: no topics provided; AI should infer topics from core idea or industry.",
        { industry: payload.industry, industryLabel: payload.industryLabel }
      );
    }

    // Validate required fields (topics are optional; if omitted, AI may infer sensible topics)
    if (!payload.coreIdea?.trim()) {
      return jsonResponse({ error: "Missing core idea." }, 400);
    }

    // Rate limiting: 10 requests per minute per user
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const userId = await getVerifiedUserId(token);
    if (!userId) return jsonResponse({ error: "Sign in required." }, 401);
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

    const quota = await checkQuota(userId);

    const usingSharedKey = !payload.userApiKey && !(quota.useOwnKey && quota.keyMode === "always");
    if (usingSharedKey && !quota.allowed) {
      return jsonResponse(
        {
          error: "QUOTA_EXCEEDED",
          message: quotaExceededMessage(quota.tier),
          quota: { used: quota.used, limit: quota.limit },
        },
        402
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error(
        "LOVABLE_API_KEY environment variable is not set. Please set it in Supabase Dashboard → Edge Functions → Manage secrets."
      );
      return jsonResponse(
        {
          error: "AI is not configured.",
          message:
            "The LOVABLE_API_KEY environment variable is not set. Please configure it in Supabase Dashboard → Edge Functions → Manage secrets.",
        },
        500
      );
    }

    // Trend-aware generation: fetch top trending topics for this industry/platform
    const dbTrending = await getTrendingTopics(payload.industry, payload.platform);
    const trendingTopics = (payload.trendingTopics && payload.trendingTopics.length > 0)
      ? payload.trendingTopics
      : dbTrending;

    // Phase D: Topic enrichment pre-call (calendar only)
    const enrichedPayload = { ...payload, trendingTopics };
    if (payload.topics.length > 0 || payload.coreIdea) {
      const enrichedTopics = await enrichTopics(payload, LOVABLE_API_KEY);
      if (enrichedTopics && enrichedTopics.length >= 7) {
        enrichedPayload.topics = enrichedTopics;
      }
    }

    const lengthInstr = LENGTH_GUIDE[payload.length] || LENGTH_GUIDE.medium;
    const structureInstr = STRUCTURE_GUIDE[payload.structure] || STRUCTURE_GUIDE.mixed;
    const hashtagInstr = buildHashtagInstr(
      payload.platform,
      payload.bannedHashtags,
      payload.requiredHashtags,
      { every: true }
    );

    const includeTopics =
      Array.isArray(enrichedPayload.topics) && enrichedPayload.topics.length > 0;
    const contextLines = buildPromptContext(enrichedPayload, { includeTopics });

    const systemMsg = buildSystemMessage(enrichedPayload, { includeTopics });
    const userMsg = buildUserMessage(enrichedPayload, { includeTopics, leanOutput: true });

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
                  hook_options: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 1,
                    maxItems: 5,
                  },
                  body: { type: "string" },
                  cta: { type: "string" },
                  cta_options: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 1,
                    maxItems: 5,
                  },
                  image_prompt: { type: "string" },
                  // NOTE: plan/body_variants/self_check/etc. were removed from the
                  // 7-post calendar schema. Combined with the large per-post schema,
                  // they made Gemini's forced tool-call fail with an upstream 400
                  // (reproduced deterministically against the AI gateway).
                  // Variant scoring degrades gracefully when body_variants is absent.
                  hashtags: {
                    type: "string",
                    description: isLongFormPlatform(payload.platform)
                      ? "MUST be an empty string for Newsletter/Blog."
                      : "3–6 platform-native hashtags as a single space-separated string.",
                  },
                  rationale: { type: "string" },
                },
                required: [
                  "day",
                  "dow",
                  "topic",
                  "format",
                  "title",
                  "hook",
                  "body",
                  "cta",
                  "hashtags",
                  "rationale",
                  "image_prompt",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["posts"],
          additionalProperties: false,
        },
      },
    };

    const model =
      payload.quality === "polished" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
    const temperature = payload.quality === "polished" ? 0.55 : 0.7;

    const aiRes = await callAIGateway(
      [
        { role: "system", content: systemMsg },
        { role: "user", content: userMsg },
      ],
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
        max_tokens: 8000,
      }
    );
    if (aiRes.status !== 200) {
      if (aiRes.status === 503) {
        return jsonResponse(
          {
            error: "PLATFORM_UNAVAILABLE",
            message:
              "Our AI providers are temporarily overloaded. Please try again in a moment, or add your own API key in Profile → API Keys to generate without platform limits.",
          },
          503
        );
      }
      return jsonResponse({ error: aiRes.error }, aiRes.status);
    }

    if (usingSharedKey) {
      await incrementGenerationCount(userId);
    }

    const parseResult = parseAIResponse(aiRes.data || {}, "return_calendar");
    if (!parseResult.success) {
      return jsonResponse({ error: parseResult.error }, 500);
    }

    const parsed = parseResult.parsed as Record<string, unknown>;
    const initialPosts = Array.isArray(parsed.posts) ? parsed.posts : [];

    // Calendar posts are intentionally single-shot: body_variants was removed
    // from the return_calendar tool schema (see comment above) because the
    // larger per-post schema plus variant fields made Gemini's forced tool-call
    // fail with an upstream 400. There is no candidate set to run the
    // LLM-as-judge scorer (scoreVariants) against here, unlike
    // generate-single-post/regenerate-post/repurpose-post, which do request
    // variants and score them.
    let posts = initialPosts.map((p: any) => normalizePost(p, p.dow, payload) || p);
    if (posts.length === 0) {
      return jsonResponse({ error: "AI returned an empty calendar." }, 500);
    }

    // If polished quality requested, run a second pass to polish the whole calendar into a publication-ready week
    if (payload.quality === "polished") {
      try {
        const polishSystem =
          systemMsg +
          "\n\nPOLISHING RUBRIC:\n- Ensure each post opens with a strong, specific hook.\n- Tighten and clarify language; remove vague phrases.\n- Improve CTAs for clarity and action.\n- Preserve angles and avoid introducing new topics.\n- Apply consistent platform-native formatting across the week.";
        const polishUser = `Polish the following calendar JSON to a higher-quality, publication-ready week using the rubric above. Return using the same 'return_calendar' function schema.\n\nCURRENT_CALENDAR_JSON:\n${JSON.stringify({ posts }, null, 2)}`;

        const polishRes = await callAIGateway(
          [
            { role: "system", content: polishSystem },
            { role: "user", content: polishUser },
          ],
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
            max_tokens: 8000,
          }
        );

        if (polishRes.status === 200) {
          const polishParse = parseAIResponse(polishRes.data || {}, "return_calendar");
          if (polishParse.success) {
            const polishedParsed = polishParse.parsed as Record<string, unknown>;
            const polishedPosts = Array.isArray(polishedParsed.posts) ? polishedParsed.posts : null;
            if (polishedPosts) {
              posts = polishedPosts.map((p) => normalizePost(p, (p as any).dow, payload) || p);
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
    return errorResponse("generate-calendar", e);
  }
});
