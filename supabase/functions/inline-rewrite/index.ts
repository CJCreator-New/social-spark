import {
  corsHeaders,
  jsonResponse,
  checkRateLimit,
  callAIGateway,
  parseAIResponse,
} from "../_shared/promptHelpers.ts";

const INSTRUCTIONS: Record<string, string> = {
  punchier: "Rewrite the selected text to be punchier, tighter, and more memorable.",
  "add-stat": "Rewrite the selected text by adding one plausible, clearly framed stat or metric. If no specific stat is known, use a careful benchmark-style phrase instead of fabricating a precise source.",
  question: "Rewrite the selected text as a crisp question that creates curiosity.",
  simpler: "Rewrite the selected text in simpler, clearer language while preserving the meaning.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
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
    const userId = token.slice(0, 32) || "anonymous";
    const rateLimitCheck = await checkRateLimit(userId, "inline-rewrite", {
      maxRequests: 20,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) return jsonResponse({ error: "Rate limit exceeded." }, 429);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI not configured." }, 500);

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

    const userApiKey = body.userApiKey ? String(body.userApiKey).trim() : undefined;
    const userApiProvider = body.userApiProvider ? String(body.userApiProvider).trim() : undefined;

    const aiRes = await callAIGateway(
      [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }],
      tool,
      LOVABLE_API_KEY,
      {
        model: "google/gemini-2.5-flash",
        temperature: 0.55,
        userApiKey,
        userApiProvider,
        userToken: token || null,
        userIp: ipAddress
      }
    );

    if (aiRes.status !== 200) return jsonResponse({ error: aiRes.error }, aiRes.status);
    const parseResult = parseAIResponse(aiRes.data || {}, "return_rewrite");
    if (!parseResult.success) return jsonResponse({ error: parseResult.error }, 500);

    const rewrittenText = String(parseResult.parsed?.rewrittenText || "").trim();
    if (!rewrittenText) return jsonResponse({ error: "Rewrite returned empty text." }, 500);
    return jsonResponse({ rewrittenText });
  } catch (e) {
    console.error("inline-rewrite error", e instanceof Error ? e.stack : e);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});
