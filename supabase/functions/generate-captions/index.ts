import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  brief: string;
  platforms: string[];
  tone: string;
  template: string;
  variationsPerPlatform?: number;
}

const platformRules: Record<string, { charLimit: number; hashtagCount: number; style: string }> = {
  facebook: {
    charLimit: 500,
    hashtagCount: 3,
    style: "conversational, engaging, can include questions to drive comments"
  },
  instagram: {
    charLimit: 300,
    hashtagCount: 5,
    style: "visual-focused, use emojis liberally, include call-to-action, trendy"
  },
  linkedin: {
    charLimit: 700,
    hashtagCount: 4,
    style: "professional, thought leadership, storytelling, include insights and takeaways"
  },
  twitter: {
    charLimit: 280,
    hashtagCount: 2,
    style: "punchy, concise, hook-driven, thread-friendly"
  }
};

const toneDescriptions: Record<string, string> = {
  professional: "formal, authoritative, expert voice",
  conversational: "friendly, relatable, approachable",
  humorous: "witty, playful, entertaining",
  persuasive: "action-oriented, compelling, sales-focused"
};

const templateFormats: Record<string, string> = {
  promo: "promotional content highlighting value proposition and benefits",
  announcement: "news or update announcement with excitement and key details",
  story: "narrative storytelling with personal touch and emotional connection",
  carousel: "multi-slide content with hook, body points, and CTA (format as numbered slides)",
  thread: "thread format with numbered parts, each building on the previous",
  "thought-leadership": "insightful perspective sharing expertise and unique viewpoint"
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brief, platforms, tone, template, variationsPerPlatform = 3 } = await req.json() as GenerateRequest;
    
    console.log("Generating captions for:", { brief, platforms, tone, template });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const results: Record<string, Array<{ content: string; hashtags: string[] }>> = {};

    // Generate captions for each platform
    for (const platform of platforms) {
      const rules = platformRules[platform] || platformRules.facebook;
      const toneDesc = toneDescriptions[tone] || toneDescriptions.conversational;
      const templateDesc = templateFormats[template] || templateFormats.promo;

      const systemPrompt = `You are an expert social media content creator specializing in ${platform}. 
Your task is to create high-performing, engaging posts that drive engagement.

Platform: ${platform.toUpperCase()}
- Character limit: ${rules.charLimit} characters
- Recommended hashtags: ${rules.hashtagCount}
- Style: ${rules.style}

Tone: ${toneDesc}
Format: ${templateDesc}

IMPORTANT RULES:
1. Create exactly ${variationsPerPlatform} unique variations
2. Each variation must be different in approach while maintaining the core message
3. Stay within character limits
4. Include appropriate emojis for the platform
5. Generate relevant, trending hashtags
6. Make posts scroll-stopping and engagement-worthy

Respond in JSON format:
{
  "variations": [
    {
      "content": "The post content without hashtags",
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3"]
    }
  ]
}`;

      const userPrompt = `Create ${variationsPerPlatform} ${platform} posts based on this brief:

"${brief}"

Remember to make each variation unique and optimized for ${platform}'s algorithm and audience.`;

      console.log(`Generating ${variationsPerPlatform} captions for ${platform}...`);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI gateway error for ${platform}:`, response.status, errorText);
        
        if (response.status === 429) {
          return new Response(JSON.stringify({ 
            error: "Rate limit exceeded. Please try again in a moment." 
          }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        if (response.status === 402) {
          return new Response(JSON.stringify({ 
            error: "AI credits exhausted. Please add credits to continue." 
          }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const aiContent = data.choices?.[0]?.message?.content;
      
      console.log(`Raw AI response for ${platform}:`, aiContent?.substring(0, 200));

      // Parse the JSON response
      try {
        // Clean the response - remove markdown code blocks if present
        let cleanedContent = aiContent.trim();
        if (cleanedContent.startsWith("```json")) {
          cleanedContent = cleanedContent.slice(7);
        }
        if (cleanedContent.startsWith("```")) {
          cleanedContent = cleanedContent.slice(3);
        }
        if (cleanedContent.endsWith("```")) {
          cleanedContent = cleanedContent.slice(0, -3);
        }
        
        const parsed = JSON.parse(cleanedContent.trim());
        results[platform] = parsed.variations || [];
      } catch (parseError) {
        console.error(`Failed to parse AI response for ${platform}:`, parseError);
        // Fallback: create a simple caption from the raw response
        results[platform] = [{
          content: aiContent?.substring(0, rules.charLimit) || "Unable to generate caption",
          hashtags: ["#socialmedia", "#content", "#viral"]
        }];
      }
    }

    console.log("Successfully generated captions for all platforms");

    return new Response(JSON.stringify({ captions: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in generate-captions function:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to generate captions" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
