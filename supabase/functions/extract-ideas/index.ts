declare const Deno: any;

// extract-ideas/index.ts
// Analyzes pasted long-form source material and extracts N distinct,
// high-potential post ideas mapped to proven high-engagement formats.
import {
  getCorsHeaders,
  jsonResponse,
  checkRateLimit,
  checkContentLength,
  cleanPayload,
  callAIGateway,
  parseAIResponse,
  getVerifiedUserId,
  errorResponse,
  checkQuota,
  incrementGenerationCount,
  quotaExceededMessage,
} from "../_shared/promptHelpers.ts";

const SOURCE_MIN_CHARS = 200;
const SOURCE_MAX_CHARS = 20000;
const IDEAS_MIN = 3;
const IDEAS_MAX = 10;

const ENGAGEMENT_FORMATS = [
  "Contrarian take",
  "How-to breakdown",
  "Personal story",
  "Listicle",
  "Myth-busting",
  "Case study / results",
  "Question / discussion prompt",
  "Carousel script",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: getCorsHeaders(req.headers.get("origin")) });

  const contentLengthError = checkContentLength(req);
  if (contentLengthError) return contentLengthError;

  try {
    const body = await req.json();
    const payload = cleanPayload(body);
    const source = String(body.source || "").trim();
    const count = Math.min(
      IDEAS_MAX,
      Math.max(IDEAS_MIN, Math.round(Number(body.count) || 5))
    );

    if (source.length < SOURCE_MIN_CHARS) {
      return jsonResponse(
        { error: `Source material must be at least ${SOURCE_MIN_CHARS} characters.` },
        400
      );
    }
    if (source.length > SOURCE_MAX_CHARS) {
      return jsonResponse(
        { error: `Source material must be under ${SOURCE_MAX_CHARS} characters.` },
        400
      );
    }

    // Rate limiting
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const userId = await getVerifiedUserId(token);
    if (!userId) return jsonResponse({ error: "Sign in required." }, 401);
    const rateLimitCheck = await checkRateLimit(userId, "extract-ideas", {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return jsonResponse({ error: "Rate limit exceeded." }, 429);
    }

    const quota = await checkQuota(userId);
    const usingSharedKey =
      !payload.userApiKey && !(quota.useOwnKey && quota.keyMode === "always");
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

    const platform = payload.platform || "LinkedIn";
    let brandConstraint = "";
    if (payload.brandMemory) {
      brandConstraint += `\nBRAND CONTEXT:\n${payload.brandMemory}`;
    }
    if (payload.bannedWords && payload.bannedWords.length > 0) {
      brandConstraint += `\nBANNED WORDS (Do NOT use any of these words in your output):\n${payload.bannedWords.map((w) => `- ${w}`).join("\n")}`;
    }
    if (payload.forbiddenPhrases && payload.forbiddenPhrases.length > 0) {
      brandConstraint += `\nFORBIDDEN PHRASES (Do NOT use any of these phrases in your output):\n${payload.forbiddenPhrases.map((p) => `- ${p}`).join("\n")}`;
    }

    const systemMsg = `You are a senior social media strategist. You extract distinct, high-potential post ideas from long-form source material for ${platform}. Every idea must be grounded ONLY in facts present in the source — never invent statistics, names, or claims that are not there. Ideas must not overlap: each must take a clearly different angle on the material. Do not use markdown bold or italic markers (** or *) in any output text.${brandConstraint}`;

    const userMsg = `SOURCE MATERIAL:
"""
${source}
"""

TASK:
Extract exactly ${count} distinct post ideas from the source material above, targeting ${platform}.

Rules:
- Prioritize angles that map to proven high-engagement formats. Choose each idea's format from this list: ${ENGAGEMENT_FORMATS.join(", ")}.
- Rank ideas by expected engagement (strongest first).
- Each idea must be self-contained: its key_points must carry every fact from the source needed to write the post, so the post can be written without re-reading the source.
- De-duplicate overlapping angles; each idea must be understandable on its own.
- Only use facts present in the source.

Return the result using return_ideas.`;

    const tool = {
      type: "function",
      function: {
        name: "return_ideas",
        description: "Return the extracted post ideas, strongest expected engagement first.",
        parameters: {
          type: "object",
          properties: {
            ideas: {
              type: "array",
              minItems: count,
              items: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "High-impact specific hook title.",
                  },
                  format: {
                    type: "string",
                    description: "Form/angle chosen from list.",
                  },
                  rationale: {
                    type: "string",
                    description: "Why this angle is strong.",
                  },
                  key_points: {
                    type: "string",
                    description: "Key fact bullets required to write the post.",
                  },
                },
                required: ["title", "format", "rationale", "key_points"],
              },
            },
          },
          required: ["ideas"],
        },
      },
    };

    let ideas: any[] = [];
    let attempts = 0;

    while (attempts < 2 && ideas.length < 3) {
      attempts++;
      const aiRes = await callAIGateway(
        [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
        tool,
        LOVABLE_API_KEY,
        {
          provider: payload.userApiProvider || "lovable",
          quality: payload.quality,
          model: payload.userApiKey ? undefined : "google/gemini-2.5-flash",
          userApiKey: payload.userApiKey,
          userApiProvider: payload.userApiProvider,
          temperature: 0.2, // Low temp for extraction precision
        }
      );

      if (aiRes.status !== 200) {
        if (attempts === 1) continue;
        return jsonResponse({ error: aiRes.error }, aiRes.status);
      }

      if (usingSharedKey && attempts === 1) {
        await incrementGenerationCount(userId);
      }

      const parseResult = parseAIResponse(aiRes.data || {}, "return_ideas");
      if (!parseResult.success) {
        if (attempts === 1) continue;
        return jsonResponse({ error: parseResult.error }, 500);
      }

      const parsed = parseResult.parsed as { ideas?: unknown };
      const rawIdeas = Array.isArray(parsed.ideas) ? parsed.ideas : [];

      const stripMarkdown = (s: unknown) => String(s || "").replace(/\*\*?/g, "").trim();
      const seen = new Set<string>();

      const combinedForbidden = [
        ...(payload.bannedWords || []),
        ...(payload.forbiddenPhrases || []),
      ];
      const hasBrandViolation = (text: string) => {
        return combinedForbidden.some((phrase) => {
          const regex = new RegExp(phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "i");
          return regex.test(text);
        });
      };

      ideas = rawIdeas
        .map((raw) => {
          const idea = (raw || {}) as Record<string, unknown>;
          return {
            title: stripMarkdown(idea.title),
            format: stripMarkdown(idea.format) || "Balanced mix",
            rationale: stripMarkdown(idea.rationale),
            key_points: stripMarkdown(idea.key_points),
          };
        })
        .filter((idea) => {
          if (!idea.title || !idea.key_points) return false;
          if (hasBrandViolation(`${idea.title} ${idea.rationale} ${idea.key_points}`)) {
            console.warn(`Filtering out extracted idea due to brand policy violation: ${idea.title}`);
            return false;
          }
          const key = idea.title.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, count);
    }

    if (ideas.length === 0) {
      return jsonResponse(
        { error: "The AI could not extract usable ideas from this material. Try pasting a longer or more substantive source." },
        500
      );
    }

    const partial = ideas.length < 3;
    return jsonResponse({ ideas, requested: count, ...(partial ? { partial: true } : {}) });
  } catch (e) {
    return errorResponse("extract-ideas", e);
  }
});
