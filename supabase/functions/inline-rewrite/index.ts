declare const Deno: any;

import {
  getCorsHeaders,
  jsonResponse,
  checkRateLimit,
  checkContentLength,
  callAIGateway,
  parseAIResponse,
  cleanPayload,
  getVerifiedUserId,
  errorResponse,
  stripMarkdownFormatting,
  checkQuota,
  incrementGenerationCount,
  quotaExceededMessage,
} from "../_shared/promptHelpers.ts";

const INSTRUCTIONS: Record<string, string> = {
  punchier: "Rewrite the selected text to be punchier, tighter, and more memorable.",
  "add-stat":
    "Rewrite the selected text by adding one plausible, clearly framed stat or metric. If no specific stat is known, use a careful benchmark-style phrase instead of fabricating a precise source.",
  question: "Rewrite the selected text as a crisp question that creates curiosity.",
  simpler: "Rewrite the selected text in simpler, clearer language while preserving the meaning.",
};

// Exported for Vitest (see inline-rewrite.test.ts); Deno.serve is guarded below,
// same pattern as telemetry/index.ts and verify-payment/index.ts.
export async function handleInlineRewrite(req: Request): Promise<Response> {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: getCorsHeaders(req.headers.get("origin")) });

  const contentLengthError = checkContentLength(req);
  if (contentLengthError) return contentLengthError;

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
    const userId = await getVerifiedUserId(token);
    if (!userId) return jsonResponse({ error: "Sign in required." }, 401);
    const rateLimitCheck = await checkRateLimit(userId, "inline-rewrite", {
      maxRequests: 20,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) return jsonResponse({ error: "Rate limit exceeded." }, 429);

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

    const post = body.post || {};
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

    const systemMsg = `[ROLE]
You are an expert social-media editor.

[CONTEXT]
We are doing an inline rewrite of a draft post's field selection.

[INSTRUCTIONS]
Rewrite ONLY the selected text according to the user's instruction. Keep the user's voice and preserve factual meaning.

[CONSTRAINTS]
- Avoid adding markdown wrappers.
- Do not output headers or commentary.
- Return only the rewritten selection through the tool.
${brandConstraint}`;

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
      [
        { role: "system", content: systemMsg },
        { role: "user", content: userMsg },
      ],
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

    const parseResult = parseAIResponse(aiRes.data || {}, "return_rewrite");
    if (!parseResult.success) return jsonResponse({ error: parseResult.error }, 500);

    const rewrittenText = stripMarkdownFormatting(parseResult.parsed?.rewrittenText || "").trim();
    if (!rewrittenText) return jsonResponse({ error: "Rewrite returned empty text." }, 500);

    const combinedForbidden = [
      ...(payload.bannedWords || []),
      ...(payload.forbiddenPhrases || []),
    ];
    const forbiddenViolations: string[] = [];
    if (combinedForbidden.length > 0) {
      combinedForbidden.forEach((phrase) => {
        const regex = new RegExp(phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "i");
        if (regex.test(rewrittenText)) {
          forbiddenViolations.push(`Contains forbidden brand term: "${phrase}"`);
        }
      });
    }

    const selfCheck = {
      forbidden_violations: forbiddenViolations,
      checks_passed: forbiddenViolations.length === 0,
      notes: forbiddenViolations.length > 0 ? "Contains brand violations" : "",
    };

    return jsonResponse({ rewrittenText, self_check: selfCheck });
  } catch (e) {
    return errorResponse("inline-rewrite", e);
  }
}

if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve(handleInlineRewrite);
}
