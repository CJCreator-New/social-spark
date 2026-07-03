declare const Deno: any;

// repurpose-post/index.ts
// Takes an existing post and rewrites it for a DIFFERENT target platform.
import {
  corsHeaders,
  jsonResponse,
  checkRateLimit,
  cleanPayload,
  buildSystemMessage,
  callAIGateway,
  parseAIResponse,
  normalizePost,
  getVerifiedUserId,
  scoreVariants,
  errorResponse,
} from "../_shared/promptHelpers.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const payload = cleanPayload(body);
    const { post, targetPlatform } = body;
    const sourcePlatform = String(body.platform || payload.platform || post?.platform || "LinkedIn");

    if (!post || !targetPlatform) {
      return jsonResponse({ error: "Missing source post or target platform." }, 400);
    }

    // Rate limiting
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const userId = await getVerifiedUserId(token);
    if (!userId) return jsonResponse({ error: "Sign in required." }, 401);
    const rateLimitCheck = await checkRateLimit(userId, "repurpose-post", {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return jsonResponse({ error: "Rate limit exceeded." }, 429);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY environment variable is not set. Please set it in Supabase Dashboard → Edge Functions → Manage secrets.");
      return jsonResponse({
        error: "AI is not configured.",
        message: "The LOVABLE_API_KEY environment variable is not set. Please configure it in Supabase Dashboard → Edge Functions → Manage secrets."
      }, 500);
    }

    // Prepare the payload for the target platform
    const targetPayload = {
      ...payload,
      platform: targetPlatform,
      sourcePlatform,
    };

    const systemMsg = buildSystemMessage(targetPayload, { isSinglePost: true });

    const userMsg = `REPURPOSE INSTRUCTION:
Take the following ${sourcePlatform} post and rewrite it specifically for ${targetPlatform}.

SOURCE POST (${sourcePlatform}):
Title: ${post.title || ""}
Hook: ${post.hook || ""}
Body: ${post.body || ""}
CTA: ${post.cta || ""}
Hashtags: ${post.hashtags || ""}

PLATFORM SPECIFICS:
- If target is X: Create a concise, high-impact single post. Do NOT write a thread; keep it fully within one post body.
- If target is Instagram: Focus on a "Carousel Script" format - Slide 1 (Hook), Slides 2-4 (Value points), Slide 5 (CTA).
- If target is Facebook: Warm, community-focused, and conversational.
- If target is LinkedIn: Insight-led, professional, and formatted with white space.
- If target is Newsletter: Expand slightly, add a personal introduction, and make the CTA specific to a "Read more" or "Reply" action.

Keep the same strategic angle, but do not copy the source wording line-for-line. Regenerate hashtags and image_prompt for the target platform.
Return the result as a single post object using return_post.`;

    const tool = {
      type: "function",
      function: {
        name: "return_post",
        description: "Return the repurposed post.",
        parameters: {
          type: "object",
          properties: {
            day: { type: "number" },
            dow: { type: "string" },
            topic: { type: "string" },
            format: { type: "string" },
            title: { type: "string" },
            hook: { type: "string" },
            body: { type: "string" },
            cta: { type: "string" },
            hashtags: { type: "string" },
            rationale: { type: "string" },
            image_prompt: { type: "string" },
            body_variants: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 2 },
          },
          required: ["topic", "format", "title", "hook", "body", "cta", "hashtags", "rationale", "image_prompt"],
        },
      },
    };

    const model = targetPayload.quality === "polished" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
    const temperature = targetPayload.quality === "polished" ? 0.6 : 0.8;

    const aiRes = await callAIGateway(
      [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }],
      tool,
      LOVABLE_API_KEY,
      {
        model,
        temperature,
        userApiKey: targetPayload.userApiKey,
        userApiProvider: targetPayload.userApiProvider,
        quality: targetPayload.quality,
        userToken: token || null,
        userIp: ipAddress,
        max_tokens: 8192
      }
    );

    if (aiRes.status !== 200) {
      if (aiRes.status === 503) {
        return jsonResponse({
          error: "PLATFORM_UNAVAILABLE",
          message: "Our AI providers are temporarily overloaded. Please try again in a moment, or add your own API key in Profile → API Keys to generate without platform limits.",
        }, 503);
      }
      return jsonResponse({ error: aiRes.error }, aiRes.status);
    }

    const parseResult = parseAIResponse(aiRes.data || {}, "return_post");
    if (!parseResult.success) return jsonResponse({ error: parseResult.error }, 500);

    let parsed = parseResult.parsed as Record<string, unknown>;

    // Variant scoring block
    const candidates = [String(parsed.body || "")];
    if (Array.isArray(parsed.body_variants)) {
      candidates.push(...parsed.body_variants.map(v => String(v || "")));
    }

    if (candidates.length > 1) {
      const judgeRes = await scoreVariants(candidates, targetPayload, LOVABLE_API_KEY || "");
      parsed.variant_scores = judgeRes.scores;
      parsed.chosen_index = judgeRes.winner_index;
      if (judgeRes.winner_index > 0 && judgeRes.winner_index < candidates.length) {
        parsed.body = candidates[judgeRes.winner_index];
      }
    }

    const normalized = normalizePost(parsed, post.dow, targetPayload);
    if (normalized) {
      normalized.variant_scores = parsed.variant_scores;
      normalized.chosen_index = parsed.chosen_index;
    }
    return jsonResponse({ post: normalized });

  } catch (e) {
    return errorResponse("repurpose-post", e);
  }
});
