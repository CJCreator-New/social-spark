declare const Deno: any;

// Regenerate a single post in a 7-day calendar via Lovable AI Gateway.
import {
  corsHeaders,
  LENGTH_GUIDE_SINGLE as LENGTH_GUIDE,
  STRUCTURE_GUIDE,
  bannedPhrasesBlock,
  buildEngagementRules,
  isLongFormPlatform,
  buildHashtagInstr,
  getStylePreset,
  jsonResponse,
  checkRateLimit,
  cleanPayload,
  normalizePost,
  scoreVariants,
  callAIGateway,
  parseAIResponse,
  buildSystemMessage,
  buildUserMessage,
  getUserIdFromToken,
  errorResponse,
  checkQuota,
  incrementGenerationCount,
  quotaExceededMessage,
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
  "enhance": "TWEAK: Improve this post for engagement based on performance metrics — strengthen the hook (make it shorter, punchier, and curiosity-driving), sharpen the CTA to invite replies, increase hashtag relevance (add 1–2 targeted tags), and simplify any long sentences to improve readability. Preserve the core angle and avoid introducing new topics.",
};

const ENHANCE_FOCUS_INSTRUCTIONS: Record<string, string> = {
  hookStrength: "FOCUS: The hook is the weakest area. Rebuild the opening line to create curiosity faster, preferably with a specific claim, question, or sharp contrast.",
  ctaEffectiveness: "FOCUS: The CTA is the weakest area. Make the call to action more specific, easier to answer, and more clearly connected to the topic.",
  hashtagRelevance: "FOCUS: Hashtag relevance is weakest. Replace generic tags with fewer, more specific platform-native tags tied to the topic and audience.",
  readability: "FOCUS: Readability is weakest. Shorten long sentences, reduce complexity, and make the post easier to scan without losing substance.",
};

function buildEnhanceTweakInstruction(focusMetric?: string): string {
  const focus = focusMetric ? ENHANCE_FOCUS_INSTRUCTIONS[focusMetric] : "";
  return [TWEAK_INSTRUCTIONS.enhance, focus].filter(Boolean).join("\n");
}

Deno.serve(async (req: Request) => {
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
    const tweak = body.tweak as "shorter" | "punchier" | "add-stat" | "remove-emoji" | "more-personal" | "enhance" | undefined;
    const focusMetric = typeof body.focusMetric === "string" ? body.focusMetric : "";

    if (!post || typeof post.day !== "number" || !post.dow) {
      return jsonResponse({ error: "Missing post context (day/dow required)." }, 400);
    }

    // Rate limiting: 30 requests per minute per user (regenerate is frequent)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const userId = getUserIdFromToken(token);
    if (!userId || userId === "anonymous") return jsonResponse({ error: "Sign in required." }, 401);
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

    // Quota: a regenerate counts as one generation (same gate as generate-*).
    const quota = await checkQuota(userId);

    const usingSharedKey = !payload.userApiKey && !(quota.useOwnKey && quota.keyMode === "always");
    if (usingSharedKey && !quota.allowed) {
      return jsonResponse({
        error: "QUOTA_EXCEEDED",
        message: quotaExceededMessage(quota.tier),
        quota: { used: quota.used, limit: quota.limit },
      }, 402);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI is not configured." }, 500);

    const targetTopic = (newTopic && newTopic.trim()) || post.topic || "general topic";
    const lengthInstr = LENGTH_GUIDE[payload.length] || LENGTH_GUIDE.medium;
    const structureInstr = STRUCTURE_GUIDE[payload.structure] || STRUCTURE_GUIDE.mixed;
    const tweakInstr = tweak === "enhance"
      ? buildEnhanceTweakInstruction(focusMetric)
      : (tweak && TWEAK_INSTRUCTIONS[tweak]) || "";
    const hashtagInstr = buildHashtagInstr(payload.platform, payload.bannedHashtags, payload.requiredHashtags, { every: false });

    const siblingSummary = siblings
      .filter(s => s && s.day !== post.day)
      .map(s => `- Day ${s.day} (${s.dow}) · "${s.topic}" — opener: "${(s.hook || s.title || "").slice(0, 100)}"`)
      .join("\n");

    const systemMsg = buildSystemMessage(payload, { isSinglePost: true });
    
    // Phase D: Diff-aware regen logic
    // Construct a specific comparison if a tweak is provided
    let diffContext = "";
    if (tweakInstr) {
      diffContext = `
CRITIQUE & REWRITE GUIDANCE:
1. Identify the parts of the CURRENT VERSION below that fail the TWEAK instruction.
2. Formulate a plan to fix only those parts while preserving the core value of the post.
3. Rewrite the post, ensuring the specific instruction ("${tweak}") is fully executed.
`;
    }

    const userMsg = buildUserMessage(payload, { isSinglePost: true }) + 
      `\n\nREWRITE CONTEXT:\n- Day: ${post.day} (${post.dow})\n- Topic: ${targetTopic}` +
      (post.title ? `\n- Previous Title Ref: "${post.title}"` : "") +
      `\n\nCURRENT VERSION:\n- Title: "${post.title || ''}"\n- Hook: "${post.hook || ''}"\n- Body: "${(post.body || '').slice(0, 800)}"\n- CTA: "${post.cta || ''}"\n` +
      `\nUSER INSTRUCTION / TWEAK:\n${tweakInstr || "General variety improvement"}\n` +
      diffContext +
      `\nOTHER POSTS IN THIS WEEK (For context/variety reference):\n${siblingSummary || '(none provided)'}\n\n` +
      `HARD RULES: Return the full post object. Fix exactly what was requested. If a tweak is provided, prioritize it over generic platform rules.`;

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

    const model = payload.quality === "polished" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
    const temperature = payload.quality === "polished" ? 0.45 : 0.5;

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

    // A successful regenerate counts as one generation against the quota.
    if (usingSharedKey) {
      await incrementGenerationCount(userId);
    }

    const parseResult = parseAIResponse(aiRes.data || {}, "return_post");
    if (!parseResult.success) {
      return jsonResponse({ error: parseResult.error }, 500);
    }

    let parsed = parseResult.parsed as Record<string, unknown>;

    // Task 4: LLM-as-judge scoring
    const candidates = [String(parsed.body || "")];
    if (Array.isArray(parsed.body_variants)) {
      candidates.push(...parsed.body_variants.map(v => String(v || "")));
    }
    
    if (candidates.length > 1) {
      const judgeRes = await scoreVariants(candidates, payload, LOVABLE_API_KEY || "");
      parsed.variant_scores = judgeRes.scores;
      parsed.chosen_index = judgeRes.winner_index;
      if (judgeRes.winner_index > 0 && judgeRes.winner_index < candidates.length) {
        parsed.body = candidates[judgeRes.winner_index];
      }
    }

    let regenerated = normalizePost(parsed, post.dow, payload);
    if (!regenerated) {
      return jsonResponse({ error: "Failed to normalize post response." }, 500);
    }
    
    // Attach scores
    regenerated.variant_scores = parsed.variant_scores;

    // Force day to match the original slot
    regenerated.day = post.day;

    // If polished quality requested, run a focused polish pass (critique + rewrite)
    if (payload.quality === "polished") {
      try {
        const polishSystem = systemMsg + "\n\nPOLISHING RUBRIC:\n- Improve hook specificity and curiosity.\n- Tighten body language and remove vague claims.\n- Strengthen CTA clarity and actionability.\n- Preserve angle and do not introduce new topics.";
        const polishUser = `Polish the following post JSON to a publication-ready version using the rubric above. Return using the same 'return_post' function schema.\n\nCURRENT_POST_JSON:\n${JSON.stringify(parsed, null, 2)}`;

        const polishRes = await callAIGateway([
          { role: "system", content: polishSystem },
          { role: "user", content: polishUser },
        ], tool, LOVABLE_API_KEY, {
          model: "google/gemini-2.5-pro",
          temperature: 0.4,
          userApiKey: payload.userApiKey,
          userApiProvider: payload.userApiProvider,
          quality: payload.quality,
          userToken: token || null,
          userIp: ipAddress,
          max_tokens: 8192
        });

        if (polishRes.status === 200) {
          const polishParse = parseAIResponse(polishRes.data || {}, "return_post");
          if (polishParse.success) {
            parsed = polishParse.parsed as Record<string, unknown>;
            const polished = normalizePost(parsed, post.dow, payload);
            if (polished) regenerated = polished;
          }
        }
      } catch (e) {
        console.warn("Regenerate polish pass failed, returning initial rewrite", e);
      }
    }

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
    return errorResponse("regenerate-post", e);
  }
});
