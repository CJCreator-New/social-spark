// Regenerate a single post in a 7-day calendar via Lovable AI Gateway.
import {
  corsHeaders,
  LENGTH_GUIDE_SINGLE as LENGTH_GUIDE,
  STRUCTURE_GUIDE,
  bannedPhrasesBlock,
  cleanList,
  cleanTagList,
  buildHashtagInstr,
  jsonResponse,
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

interface Payload {
  industry?: string;
  industryLabel?: string;
  platform?: string;
  coreIdea?: string;
  audiences?: string[];
  voice?: string;
  style?: string;
  goals?: string[];
  format?: string;
  cta?: string;
  length?: string;
  structure?: string;
  extra?: string;
  bannedWords?: string[];
  requiredWords?: string[];
  bannedHashtags?: string[];
  requiredHashtags?: string[];
  // Single-post context
  post: ExistingPost;
  // Other 6 posts so AI doesn't duplicate angles/openers
  siblings?: ExistingPost[];
  // Optional override topic (defaults to post.topic)
  newTopic?: string;
  // Optional tweak directive — keeps the angle, applies a small transform
  tweak?: "shorter" | "punchier" | "add-stat" | "remove-emoji" | "more-personal";
}

const TWEAK_INSTRUCTIONS: Record<string, string> = {
  "shorter": "TWEAK: Keep the same angle, hook, and CTA, but cut the body length by ~35%. Tighten every sentence. Remove anything not load-bearing.",
  "punchier": "TWEAK: Keep the same angle, but rewrite for more impact — shorter sentences, stronger verbs, sharper opener. No fluff.",
  "add-stat": "TWEAK: Keep the same angle, but weave in 1–2 specific, plausible statistics or concrete numbers (e.g. percentages, dollar figures, time spans). Cite them as 'roughly' or 'around' if you can't be sure.",
  "remove-emoji": "TWEAK: Keep the same angle and structure, but remove ALL emojis from the title, hook, body, and CTA. Replace with plain punctuation.",
  "more-personal": "TWEAK: Keep the same angle, but rewrite in first-person with a small, specific personal anecdote or observation in the hook. Make it feel like a human wrote it, not a brand.",
};


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
      format = "Balanced mix",
      cta = "Share & repost bait",
      length = "medium",
      structure = "mixed",
      extra = "",
      bannedWords = [],
      requiredWords = [],
      bannedHashtags = [],
      requiredHashtags = [],
      post,
      siblings = [],
      newTopic,
      tweak,
    } = body;

    const cleanBanned = cleanList(bannedWords, 20);
    const cleanRequired = cleanList(requiredWords, 10);
    const cleanBannedTags = cleanTagList(bannedHashtags, 30);
    const cleanRequiredTags = cleanTagList(requiredHashtags, 10);

    if (!post || typeof post.day !== "number" || !post.dow) {
      return jsonResponse({ error: "Missing post context (day/dow required)." }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI is not configured." }, 500);

    const targetTopic = (newTopic && newTopic.trim()) || post.topic || "general topic";
    const lengthInstr = LENGTH_GUIDE[length] || LENGTH_GUIDE.medium;
    const structureInstr = STRUCTURE_GUIDE[structure] || STRUCTURE_GUIDE.mixed;
    const tweakInstr = (tweak && TWEAK_INSTRUCTIONS[tweak]) || "";
    const hashtagInstr = buildHashtagInstr(platform, cleanBannedTags, cleanRequiredTags, { every: false });

    const siblingSummary = siblings
      .filter(s => s && s.day !== post.day)
      .map(s => `- Day ${s.day} (${s.dow}) · "${s.topic}" — opener: "${(s.hook || s.title || "").slice(0, 100)}"`)
      .join("\n");

    const prompt = `You are a world-class ${platform} content strategist specialising in ${industryLabel || industry} content.

Re-write a SINGLE post (Day ${post.day} — ${post.dow}) in an existing 7-day ${platform} content calendar. The other 6 posts are unchanged — your post must feel fresh and complementary, not duplicative.

CONTEXT:
- Industry / niche: ${industryLabel || industry}
- Core idea: ${coreIdea}
- Audience: ${audiences.length ? audiences.join(", ") : "industry professionals"}
- Voice / tone: ${voice || "conversational and professional"}
- Writing style: ${style || "balanced"}
- Goals: ${goals.join(", ") || "Awareness, Engagement"}
- Post format mix: ${format}
- CTA approach: ${cta}
- POST LENGTH: ${lengthInstr}
- POST STRUCTURE: ${structureInstr}
${extra ? `- Extra instructions: ${extra}` : ""}
${cleanBanned.length ? `- NEVER SAY (hard ban — do not use these words or close variants): ${cleanBanned.join(", ")}` : ""}
${cleanRequired.length ? `- TRY TO MENTION (prefer naturally weaving in at least one of these if it fits the topic): ${cleanRequired.join(", ")}` : ""}

THIS POST:
- Day: ${post.day} (${post.dow})
- Topic: ${targetTopic}
${tweakInstr ? "" : (post.title ? `- Previous title (do NOT reuse): "${post.title}"` : "")}
${tweakInstr ? "" : (post.hook ? `- Previous hook (do NOT reuse opener): "${post.hook.slice(0, 120)}"` : "")}
${tweakInstr ? `\nCURRENT VERSION TO TWEAK (preserve angle, transform per tweak instruction):\n- Title: "${post.title || ""}"\n- Hook: "${post.hook || ""}"\n- Body: "${(post.body || "").slice(0, 600)}"\n- CTA: "${post.cta || ""}"\n` : ""}
${tweakInstr ? tweakInstr + "\n" : ""}
OTHER POSTS IN THIS WEEK (do NOT duplicate angles, openers, statistics, or examples):
${siblingSummary || "(none provided)"}

HARD RULES:
1. ${tweakInstr ? `Apply the TWEAK above to the current version. Keep the same core angle and topic.` : `Write a genuinely fresh take on "${targetTopic}" that does NOT repeat the previous title/hook above.`}
2. Stay specific to the ${industryLabel || industry} space — real terminology, real platforms, real trends.
3. Follow the POST LENGTH and POST STRUCTURE rules exactly${tweakInstr === TWEAK_INSTRUCTIONS.shorter ? " (the 'shorter' tweak overrides the length target)" : ""}.
4. ${hashtagInstr}
5. The "dow" field MUST be "${post.dow}" and "day" MUST be ${post.day}.
6. In the "format" field, append the structure used (e.g. "How-to — hybrid").

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
            body: { type: "string" },
            cta: { type: "string" },
            hashtags: {
              type: "string",
              description: longFormPlatform
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

    let parsed: ExistingPost;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse tool args", e);
      return new Response(JSON.stringify({ error: "Failed to parse AI output." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Force day/dow to match the slot (defensive)
    parsed.day = post.day;
    parsed.dow = post.dow;

    return new Response(JSON.stringify({ post: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("regenerate-post error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
