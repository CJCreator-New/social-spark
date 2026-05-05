// Generate a SINGLE post (one chosen day) via Lovable AI Gateway.
import {
  corsHeaders,
  VALID_DOW,
  LENGTH_GUIDE_SINGLE as LENGTH_GUIDE,
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
  topic?: string;
  dow?: string;
  date?: string;
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
      topic = "",
      dow = "Mon",
      date = "",
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

    if (!coreIdea.trim()) {
      return new Response(JSON.stringify({ error: "Missing core idea." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!topic.trim()) {
      return new Response(JSON.stringify({ error: "Missing topic." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!VALID_DOW.has(dow)) {
      return new Response(JSON.stringify({ error: "Invalid day-of-week." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const cleanBanned = (bannedWords || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 20);
    const cleanRequired = (requiredWords || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 10);
    const normTag = (s: string) => `#${String(s || "").trim().replace(/^#+/, "").replace(/[^\w]/g, "").toLowerCase()}`;
    const cleanBannedTags = (bannedHashtags || []).map(normTag).filter((t) => t.length > 1).slice(0, 30);
    const cleanRequiredTags = (requiredHashtags || []).map(normTag).filter((t) => t.length > 1).slice(0, 10);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI is not configured." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const lengthInstr = LENGTH_GUIDE[length] || LENGTH_GUIDE.medium;
    const structureInstr = STRUCTURE_GUIDE[structure] || STRUCTURE_GUIDE.mixed;

    const longFormPlatform = platform === "Newsletter" || platform === "Blog";
    const baseHashtagInstr = longFormPlatform
      ? `HASHTAGS: This is a ${platform} post — return an EMPTY string ("") for the hashtags field.`
      : `HASHTAGS: Provide 3–6 platform-native hashtags as a single space-separated string (e.g. "#AI #ProductOps #SaaS"). Mix one broad, two niche, and one trending where relevant.`;
    const bannedTagInstr = !longFormPlatform && cleanBannedTags.length
      ? `\n  HASHTAG BAN — NEVER use these hashtags or close variants: ${cleanBannedTags.join(" ")}`
      : "";
    const requiredTagInstr = !longFormPlatform && cleanRequiredTags.length
      ? `\n  HASHTAG REQUIREMENT — INCLUDE at least one of these brand hashtags: ${cleanRequiredTags.join(" ")}`
      : "";
    const hashtagInstr = baseHashtagInstr + bannedTagInstr + requiredTagInstr;

    const prompt = `You are a world-class ${platform} content strategist specialising in ${industryLabel || industry} content.

Write a SINGLE high-impact ${platform} post for ${dow}${date ? ` (${date})` : ""}.
- Industry / niche: ${industryLabel || industry}
- Core idea: ${coreIdea}
- Audience: ${audiences.length ? audiences.join(", ") : "industry professionals"}
- Voice / tone: ${voice || "conversational and professional"}
- Writing style: ${style || "balanced"}
- Goals: ${goals.join(", ") || "Awareness, Engagement"}
- Topic for this post: ${topic}
- Post format: ${format}
- CTA approach: ${cta}
- POST LENGTH: ${lengthInstr}
- POST STRUCTURE: ${structureInstr}
${extra ? `- Extra instructions: ${extra}` : ""}
${cleanBanned.length ? `- NEVER SAY (hard ban — do not use these words or close variants): ${cleanBanned.join(", ")}` : ""}
${cleanRequired.length ? `- TRY TO MENTION (weave in naturally if it fits): ${cleanRequired.join(", ")}` : ""}

HARD RULES:
1. Stay specific to the ${industryLabel || industry} space — real terminology, real platforms, real trends.
2. Follow the POST LENGTH and POST STRUCTURE rules exactly.
3. ${hashtagInstr}
4. The "dow" field MUST be exactly "${dow}" and "day" MUST be 1.
5. In the "format" field, append the structure used (e.g. "How-to — hybrid").
6. Include at least one concrete number, percentage, year, or named statistic in the body or hook (realistic, defensible).

BANNED PHRASES — do NOT use these or close variants:
- "in today's fast-paced world" / "in the ever-evolving landscape"
- "game-changer" / "revolutionize" / "unlock the power of"
- "take it to the next level" / "leverage synergies"
- "let's dive in" / "let's dive into" / "at the end of the day"
Open with a specific observation, number, or contrarian claim — not hype.`;

    const tool = {
      type: "function",
      function: {
        name: "return_post",
        description: "Return a single platform-native post.",
        parameters: {
          type: "object",
          properties: {
            day: { type: "number" },
            dow: { type: "string", enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
            topic: { type: "string" },
            format: { type: "string" },
            title: { type: "string" },
            hook: { type: "string" },
            body: { type: "string" },
            cta: { type: "string" },
            hashtags: {
              type: "string",
              description: longFormPlatform ? "MUST be empty for Newsletter/Blog." : "3–6 hashtags, space-separated.",
            },
            rationale: { type: "string" },
          },
          required: ["day", "dow", "topic", "format", "title", "hook", "body", "cta", "hashtags", "rationale"],
          additionalProperties: false,
        },
      },
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "return_post" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit hit. Please wait a moment and try again." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return new Response(JSON.stringify({ error: `AI error: ${aiRes.status}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiRes.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "AI returned no structured output." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse tool args", e);
      return new Response(JSON.stringify({ error: "Failed to parse AI output." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Defensive: force day=1 and dow to caller's choice.
    parsed.day = 1;
    parsed.dow = dow;

    return new Response(JSON.stringify({ post: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-single-post error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
