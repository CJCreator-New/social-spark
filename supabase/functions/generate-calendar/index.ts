// Generate a 7-day content calendar via Lovable AI Gateway
import {
  corsHeaders,
  LENGTH_GUIDE_WEEK as LENGTH_GUIDE,
  STRUCTURE_GUIDE,
  bannedPhrasesBlock,
  cleanList,
  cleanTagList,
  buildHashtagInstr,
  jsonResponse,
} from "../_shared/promptHelpers.ts";

interface Payload {
  industry?: string;
  industryLabel?: string;
  platform?: string;
  coreIdea?: string;
  audiences?: string[];
  voice?: string;
  style?: string;
  goals?: string[];
  topics?: string[];
  format?: string;
  cta?: string;
  length?: string;
  structure?: string;
  extra?: string;
  bannedWords?: string[];
  requiredWords?: string[];
  bannedHashtags?: string[];
  requiredHashtags?: string[];
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: Payload = await req.json();
    const {
      industry = "",
      industryLabel = "",
      platform = "LinkedIn",
      coreIdea = "",
      audiences = [],
      voice = "",
      style = "",
      goals = [],
      topics = [],
      format = "Balanced mix",
      cta = "Share & repost bait",
      length = "medium",
      structure = "mixed",
      extra = "",
      bannedWords = [],
      requiredWords = [],
      bannedHashtags = [],
      requiredHashtags = [],
    } = body;

    const cleanBanned = cleanList(bannedWords, 20);
    const cleanRequired = cleanList(requiredWords, 10);
    const cleanBannedTags = cleanTagList(bannedHashtags, 30);
    const cleanRequiredTags = cleanTagList(requiredHashtags, 10);

    if (!coreIdea.trim() || topics.length === 0) {
      return jsonResponse({ error: "Missing core idea or topics." }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "AI is not configured." }, 500);
    }

    const lengthInstr = LENGTH_GUIDE[length] || LENGTH_GUIDE.medium;
    const structureInstr = STRUCTURE_GUIDE[structure] || STRUCTURE_GUIDE.mixed;
    const hashtagInstr = buildHashtagInstr(platform, cleanBannedTags, cleanRequiredTags, { every: true });

    const prompt = `You are a world-class ${platform} content strategist specialising in ${industryLabel || industry} content.

Create a complete 7-day ${platform} content calendar for this creator:
- Industry / niche: ${industryLabel || industry}
- Core idea: ${coreIdea}
- Audience: ${audiences.length ? audiences.join(", ") : "industry professionals"}
- Voice / tone: ${voice || "conversational and professional"}
- Writing style: ${style || "balanced"}
- Goals: ${goals.join(", ") || "Awareness, Engagement"}
- Topics to cover (1 per day; use a wrap-up or adjacent topic for day 7 if fewer than 7 topics): ${topics.join(", ")}
- Post format mix: ${format}
- CTA approach: ${cta}
- POST LENGTH: ${lengthInstr}
- POST STRUCTURE: ${structureInstr}
${extra ? `- Extra instructions: ${extra}` : ""}
${cleanBanned.length ? `- NEVER SAY (hard ban — do not use these words or close variants in any post): ${cleanBanned.join(", ")}` : ""}
${cleanRequired.length ? `- MUST MENTION (each of these terms must appear naturally in AT LEAST ONE post across the week): ${cleanRequired.join(", ")}` : ""}

HARD RULES (follow strictly):
1. Generate content that is genuinely specific to the ${industryLabel || industry} space — use real terminology, real platforms, real trends, real names where relevant. Do NOT write generic content.
2. Strictly follow the POST LENGTH and POST STRUCTURE rules above for the body of every post.
3. In the "format" field of each post, append the structure used (e.g. "List post — bullets", "Storytelling — paragraphs", "How-to — hybrid") so the user can see the mix at a glance.
4. ${hashtagInstr}
5. The chosen format mix "${format}" must drive AT LEAST 4 of the 7 posts. The remaining 3 may vary for rhythm.
6. AT LEAST 3 of the 7 posts must include a concrete number, percentage, year, dollar figure, or named statistic embedded in the body or hook (not made-up — use realistic, defensible figures from the ${industryLabel || industry} space).
7. The "dow" field MUST be exactly one of: "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" — and the 7 posts must be ordered Mon → Sun, with "day" 1..7 matching that order.

${bannedPhrasesBlock()}`;

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
                  body: { type: "string" },
                  cta: { type: "string" },
                  hashtags: {
                    type: "string",
                    description: longFormPlatform
                      ? "MUST be an empty string for Newsletter/Blog."
                      : "3–6 platform-native hashtags as a single space-separated string.",
                  },
                  rationale: { type: "string" },
                },
                required: ["day", "dow", "topic", "format", "title", "hook", "body", "cta", "hashtags", "rationale"],
                additionalProperties: false,
              },
            },
          },
          required: ["posts"],
          additionalProperties: false,
        },
      },
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "return_calendar" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit hit. Please wait a moment and try again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiRes.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return new Response(
        JSON.stringify({ error: `AI error: ${aiRes.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await aiRes.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "AI returned no structured output." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let parsed: { posts?: unknown };
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse tool args", e);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI output." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const posts = Array.isArray(parsed.posts) ? parsed.posts : [];
    if (posts.length === 0) {
      return new Response(
        JSON.stringify({ error: "AI returned an empty calendar." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ posts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-calendar error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
