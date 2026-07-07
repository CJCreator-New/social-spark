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
  checkQuota,
  incrementGenerationCount,
  quotaExceededMessage,
} from "../_shared/promptHelpers.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: getCorsHeaders(req.headers.get("origin")) });

  const contentLengthError = checkContentLength(req);
  if (contentLengthError) return contentLengthError;

  try {
    const body = await req.json().catch(() => ({}));
    const payload = cleanPayload(body);
    const industry = String(body.industry || "").trim();
    const platform = String(body.platform || "LinkedIn").trim();

    if (!industry) {
      return jsonResponse({ error: "Missing industry parameter." }, 400);
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const userId = await getVerifiedUserId(token);
    if (!userId) return jsonResponse({ error: "Sign in required." }, 401);

    const rateLimitCheck = await checkRateLimit(userId, "generate-trends", {
      maxRequests: 30,
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
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI not configured." }, 500);

    const systemMsg = `[ROLE]
You are a senior social media market analyst and trend spotter.

[CONTEXT]
We need to generate a list of 6 highly realistic, current, and engaging trending topics/angles for a specific industry and social media platform. These topics will be surfaced to creators to help them write relevant content.

[INSTRUCTIONS]
Generate exactly 6 trending topic ideas or discussion angles tailored to the given industry and platform.
Ensure the topics are specific, professional, and sound like real-world discussions happening this week.

[CONSTRAINTS]
- Do not return empty categories or topics.
- Return only the structured topics list through the tool.`;

    const userMsg = `Generate 6 trending topics for:
Industry: ${industry}
Platform: ${platform}`;

    const tool = {
      type: "function",
      function: {
        name: "return_trends",
        description: "Return a list of trending topics.",
        parameters: {
          type: "object",
          properties: {
            trends: {
              type: "array",
              minItems: 6,
              maxItems: 6,
              items: {
                type: "object",
                properties: {
                  topic: {
                    type: "string",
                    description: "Short topic name or angle (e.g. 'AI Agents in SaaS')",
                  },
                  category: { type: "string", description: "Broad subcategory (e.g. 'AI & ML')" },
                  trending: { type: "boolean" },
                  posts: {
                    type: "number",
                    description: "Approximate post count (e.g. 500 to 1500)",
                  },
                },
                required: ["topic", "category", "trending", "posts"],
              },
            },
          },
          required: ["trends"],
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
        temperature: 0.7,
        userApiKey: payload.userApiKey,
        userApiProvider: payload.userApiProvider,
        userToken: token || null,
        userIp: ipAddress,
        max_tokens: 4096,
      }
    );

    if (aiRes.status !== 200) return jsonResponse({ error: aiRes.error }, aiRes.status);

    if (usingSharedKey) {
      await incrementGenerationCount(userId);
    }

    const parseResult = parseAIResponse(aiRes.data || {}, "return_trends");
    if (!parseResult.success) return jsonResponse({ error: parseResult.error }, 500);

    const trends = parseResult.parsed?.trends || [];
    return jsonResponse({ trends });
  } catch (e) {
    return errorResponse("generate-trends", e);
  }
});
