declare const Deno: any;

import {
  corsHeaders,
  jsonResponse,
  checkRateLimit,
  callAIGateway,
  parseAIResponse,
  cleanPayload,
  getUserIdFromToken,
  errorResponse,
} from "../_shared/promptHelpers.ts";

const INSTRUCTIONS: Record<string, string> = {
  punchier: "Rewrite the selected text to be punchier, tighter, and more memorable.",
  "add-stat": "Rewrite the selected text by adding one plausible, clearly framed stat or metric. If no specific stat is known, use a careful benchmark-style phrase instead of fabricating a precise source.",
  question: "Rewrite the selected text as a crisp question that creates curiosity.",
  simpler: "Rewrite the selected text in simpler, clearer language while preserving the meaning.",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const payload = cleanPayload(body);
    const text = String(body.text || "").trim();
    const instructionKey = String(body.instruction || "");
    const instruction = INSTRUCTIONS[instructionKey] || instructionKey;
    const field = String(body.field || "body");
    const platform = String(body.platform || "LinkedIn");

    if (!text || !instruction) {
      return jsonResponse({ error: "Missing selected text or rewrite instruction." }, 400);
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const userId = getUserIdFromToken(token);
    if (!userId || userId === "anonymous") return jsonResponse({ error: "Sign in required." }, 401);
    const rateLimitCheck = await checkRateLimit(userId, "inline-rewrite", {
      maxRequests: 20,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) return jsonResponse({ error: "Rate limit exceeded." }, 429);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY environment variable is not set. Please set it in Supabase Dashboard → Edge Functions → Manage secrets.");
      return jsonResponse({
        error: "AI is not configured.",
        message: "The LOVABLE_API_KEY environment variable is not set. Please configure it in Supabase Dashboard → Edge Functions → Manage secrets."
      }, 500);
    }

    const post = body.post || {};
    const systemMsg = `[ROLE]
You are an expert social-media editor.

[CONTEXT]
We are doing an inline rewrite of a draft post's field selection.

[INSTRUCTIONS]
Rewrite ONLY the selected text according to the user's instruction. Keep the user's voice and preserve factual meaning.

[CONSTRAINTS]
- Avoid adding markdown wrappers.
- Do not output headers or commentary.
- Return only the rewritten selection through the tool.`;

    const userMsg = `Rewrite this selected ${field} text for ${platform}.

Instruction: ${instruction}

Post context:
Title: ${post.title || ""}
Hook: ${post.hook || ""}
CTA: ${post.cta || ""}

Selected text:
${text}`;

    const tool = {
      type: "function",
      function: {
        name: "return_rewrite",
        description: "Return the rewritten selected text.",
        parameters: {
          type: "object",
          properties: {
            rewrittenText: { type: "string" },
          },
          required: ["rewrittenText"],
        },
      },
    };

    const aiRes = await callAIGateway(
      [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }],
      tool,
      LOVABLE_API_KEY,
      {
        model: "google/gemini-2.5-flash",
        temperature: 0.55,
        userApiKey: payload.userApiKey,
        userApiProvider: payload.userApiProvider,
        userToken: token || null,
        userIp: ipAddress,
        max_tokens: 8192,
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
    const parseResult = parseAIResponse(aiRes.data || {}, "return_rewrite");
    if (!parseResult.success) return jsonResponse({ error: parseResult.error }, 500);

    const rewrittenText = String(parseResult.parsed?.rewrittenText || "").trim();
    if (!rewrittenText) return jsonResponse({ error: "Rewrite returned empty text." }, 500);
    return jsonResponse({ rewrittenText });
  } catch (e) {
    return errorResponse("inline-rewrite", e);
  }
});
