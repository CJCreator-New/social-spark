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
} from "../_shared/promptHelpers.ts";

Deno.serve(async (req) => {
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
    const authHeader = req.headers.get("authorization") || "anonymous";
    const userId = authHeader.replace("Bearer ", "").slice(0, 32) || "anonymous";
    const rateLimitCheck = await checkRateLimit(userId, "repurpose-post", {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return jsonResponse({ error: "Rate limit exceeded." }, 429);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI not configured." }, 500);

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
- If target is X: Create a concise, high-impact version. If the source is long, break it into a short 3-5 post thread format.
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
          },
          required: ["topic", "format", "title", "hook", "body", "cta", "hashtags", "rationale"],
        },
      },
    };

    const aiRes = await callAIGateway(
      [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }],
      tool,
      LOVABLE_API_KEY,
      { model: "google/gemini-2.5-flash", temperature: 0.7 }
    );

    if (aiRes.status !== 200) return jsonResponse({ error: aiRes.error }, aiRes.status);

    const parseResult = parseAIResponse(aiRes.data || {}, "return_post");
    if (!parseResult.success) return jsonResponse({ error: parseResult.error }, 500);

    const normalized = normalizePost(parseResult.parsed, post.dow, targetPayload);
    return jsonResponse({ post: normalized });

  } catch (e) {
    console.error("repurpose-post error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
