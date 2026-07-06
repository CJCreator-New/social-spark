import { describe, expect, it, vi, afterEach } from "vitest";
import { buildEngagementRules, buildPromptContext, buildCinematicImagePromptRules, cleanPayload, buildSystemMessage, buildUserMessage, shouldFallbackToUserKey, shouldUseUserKeyOnly, getProviderModel, clampMaxTokensForProvider, callAI, sanitizeLogValue, stripMarkdownFormatting } from "./promptHelpers.ts";

describe("stripMarkdownFormatting", () => {
  it("strips bold and italic emphasis without losing the wrapped text", () => {
    expect(stripMarkdownFormatting("This is **bold** and this is *italic*.")).toBe(
      "This is bold and this is italic."
    );
    expect(stripMarkdownFormatting("__bold underscore__ and _italic underscore_")).toBe(
      "bold underscore and italic underscore"
    );
  });

  it("strips strikethrough", () => {
    expect(stripMarkdownFormatting("~~deprecated~~ approach")).toBe("deprecated approach");
  });

  it("strips ATX headings", () => {
    expect(stripMarkdownFormatting("# Big Heading\nBody text")).toBe("Big Heading\nBody text");
    expect(stripMarkdownFormatting("### Smaller heading")).toBe("Smaller heading");
  });

  it("strips inline and fenced code", () => {
    expect(stripMarkdownFormatting("Use `npm install` to set up.")).toBe("Use npm install to set up.");
    expect(stripMarkdownFormatting("```\nconst x = 1;\n```")).toBe("\nconst x = 1;\n");
  });

  it("strips markdown links but keeps the link text", () => {
    expect(stripMarkdownFormatting("Check out [our blog](https://example.com) today.")).toBe(
      "Check out our blog today."
    );
  });

  it("leaves plain text and mid-word underscores/asterisks used as punctuation untouched", () => {
    expect(stripMarkdownFormatting("Plain text with no formatting.")).toBe("Plain text with no formatting.");
    expect(stripMarkdownFormatting("snake_case_variable and 5 * 3 = 15")).toBe(
      "snake_case_variable and 5 * 3 = 15"
    );
  });

  it("handles empty/nullish input safely", () => {
    expect(stripMarkdownFormatting("")).toBe("");
    expect(stripMarkdownFormatting(undefined)).toBe("");
    expect(stripMarkdownFormatting(null)).toBe("");
  });
});

describe("promptHelpers engagement guidance", () => {
  it("adds a core-idea framework that locks the output to one angle", () => {
    const payload = cleanPayload({
      industry: "SaaS",
      niche: "Customer onboarding",
      coreIdea: "Better onboarding",
      platform: "LinkedIn",
      audiences: ["Founders", "Product teams"],
      voice: "clear",
      style: "how-to guide",
      goals: ["Awareness"],
      format: "Balanced mix",
      cta: "Comment below",
    });

    const context = buildPromptContext(payload, { isSinglePost: true });

    expect(context).toContain("PROMPT FRAMEWORK");
    expect(context).toContain("CORE IDEA LOCK");
    expect(context).toContain("Core idea / central angle: Better onboarding");
    expect(context).toContain("Niche: narrow the frame to Customer onboarding without widening the topic");
    expect(context).toContain("If a variable conflicts with the core idea, the core idea wins");
    expect(context).toContain("Reject any draft that feels broad, generic, or off-angle");
  });

  it("adds platform-specific guidance for LinkedIn", () => {
    const rules = buildEngagementRules("LinkedIn");

    expect(rules).toContain("Thoughtful, credible, insight-led");
    expect(rules).toContain("Open with a strong hook in the first line");
  });

  it("keeps prompt context specific and engagement-focused", () => {
    const payload = cleanPayload({
      industry: "SaaS",
      coreIdea: "Better onboarding",
      platform: "Instagram",
      audiences: ["Founders"],
      voice: "friendly",
      style: "story-driven",
      goals: ["Engagement"],
      format: "Mixed",
      cta: "Comment below",
    });

    const context = buildPromptContext(payload, { isSinglePost: true });

    expect(context).toContain("Keep the post platform-native");
    expect(context).toContain("ENGAGEMENT RULES");
    expect(context).toContain("Instagram = visual/story-driven");
    expect(context).toContain("PLATFORM PRESCRIPT: Instagram captions");
  });

  it("adds Tamil language guidance when requested", () => {
    const payload = cleanPayload({
      industry: "Education",
      coreIdea: "Helping students study better",
      platform: "LinkedIn",
      language: "Tamil",
      audiences: ["Students"],
      voice: "clear",
      style: "conversational",
      goals: ["Awareness"],
      format: "Balanced mix",
      cta: "Share your thoughts",
    });

    const context = buildPromptContext(payload, { isSinglePost: true });

    expect(context).toContain("Output language: Tamil");
    expect(context).toContain("natural Tamil script");
    expect(context).toContain("Do not transliterate Tamil into English letters");
  });

  it("adds explicit style guidance for named styles", () => {
    const payload = cleanPayload({
      industry: "Marketing",
      coreIdea: "Smarter content systems",
      platform: "LinkedIn",
      audiences: ["Founders"],
      voice: "data-driven",
      style: "Stats-led",
      goals: ["Thought leadership"],
      format: "Balanced mix",
      cta: "Comment below",
    });

    const context = buildPromptContext(payload, { isSinglePost: true });

    expect(context).toContain("STYLE PRESCRIPT");
    expect(context).toContain("Lead with a concrete number, percentage, or metric");
  });

  it("adds cinematic image prompt guidance for visual generation", () => {
    const payload = cleanPayload({
      industry: "SaaS",
      coreIdea: "Better onboarding",
      topic: "First-run experience",
      platform: "Instagram",
      audiences: ["Founders"],
      voice: "cinematic",
      style: "editorial",
    });

    const guidance = buildCinematicImagePromptRules(payload);

    expect(guidance).toContain("image_prompt");
    expect(guidance).toContain("artistic style, lighting, composition, color palette, textures, depth, and atmospheric details");
    expect(guidance).toContain("film still, key art, dramatic framing");
    expect(guidance).toContain("Avoid text overlays, watermarks, UI mockups");
  });

  it("builds system and user messages for calls", () => {
    const payload = cleanPayload({ industry: "SaaS", coreIdea: "Better onboarding", platform: "LinkedIn", audiences: ["Founders"] });
    const sys = buildSystemMessage(payload, { isSinglePost: true });
    const usr = buildUserMessage(payload, { isSinglePost: true });

    expect(sys).toContain("You are a senior LinkedIn content strategist");
    expect(sys).toContain("PROMPT FRAMEWORK");
    expect(usr).toContain("BRIEF:");
    expect(usr).toContain("Return the result via the provided function tool");
  });

  it("defaults quality to draft in cleaned payloads", () => {
    const p = cleanPayload({ industry: "SaaS", coreIdea: "x" });
    expect(p.quality).toBe("draft");
  });

  describe("getVerifiedUserId", () => {
    it("returns null when no token is provided", async () => {
      const { getVerifiedUserId } = require("./promptHelpers.ts");
      expect(await getVerifiedUserId(null)).toBeNull();
      expect(await getVerifiedUserId(undefined)).toBeNull();
      expect(await getVerifiedUserId("")).toBeNull();
    });

    it("does not trust an unsigned token payload", async () => {
      // A signature-verified lookup must not simply echo back a forged `sub`
      // claim without checking Supabase Auth (outside a Deno runtime this
      // resolves to null since there is no SUPABASE_URL/anon key).
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMy1hYmMiLCJleHAiOjE3MTgyOTI4Mzd9.signature";
      const { getVerifiedUserId } = require("./promptHelpers.ts");
      expect(await getVerifiedUserId(token)).toBeNull();
    });
  });

  describe("requiredWords", () => {
    it("sanitizes values used in logs", () => {
      expect(sanitizeLogValue("ok\r\ninjected: true\tend")).toBe("ok  injected: true end");
    });

    it("builds required words prompt block correctly", () => {
      const { buildRequiredWordsBlock } = require("./promptHelpers.ts");
      const block = buildRequiredWordsBlock(["growth", "startup"]);
      expect(block).toContain("REQUIRED WORDS");
      expect(block).toContain("- \"growth\"");
      expect(block).toContain("- \"startup\"");
    });

    it("flags missing required words in normalizePost", () => {
      const { normalizePost } = require("./promptHelpers.ts");
      const post = {
        title: "Growth tips",
        hook: "How to grow",
        body: "We built a great product.",
        cta: "Comment",
        hashtags: "#startup",
        dow: "Mon",
        day: 1
      };
      
      const payload = {
        platform: "LinkedIn",
        bannedHashtags: [],
        requiredHashtags: [],
        length: "medium",
        requiredWords: ["scaleup", "retention"]
      };

      const result = normalizePost(post, "Mon", payload);
      expect(result.self_check.checks_passed).toBe(false);
      expect(result.self_check.forbidden_violations).toContain('Missing required word: "scaleup"');
      expect(result.self_check.forbidden_violations).toContain('Missing required word: "retention"');
    });

    it("does not HTML-entity-encode normalized AI-generated post fields (plain-text output only)", () => {
      // normalizePost output is always consumed as plain text (React text nodes,
      // clipboard copy, Markdown/PDF export, image-generation prompts) — never
      // as raw HTML — so it must NOT be HTML-entity-encoded. Encoding here would
      // leak literal "&#39;", "&amp;", etc. into copy-pasted and exported text.
      const { normalizePost } = require("./promptHelpers.ts");
      const result = normalizePost({
        title: "India's <startup> ecosystem",
        hook: "They're not just flagging issues",
        body: "This isn't future-gazing; it's happening now. R&D matters.",
        cta: "Click here",
        hashtags: "#safe",
        dow: "Mon",
      }, "Mon");

      expect(result.title).toBe("India's <startup> ecosystem");
      expect(result.hook).toContain("They're");
      expect(result.body).toContain("isn't");
      expect(result.body).toContain("R&D");
      expect(result.cta).toBe("Click here");
      expect(result.title).not.toContain("&#39;");
      expect(result.body).not.toContain("&#39;");
      expect(result.body).not.toContain("&amp;");
    });
  });

  describe("BYOK routing helpers", () => {
    it("uses own key only when mode is always", () => {
      expect(shouldUseUserKeyOnly("always")).toBe(true);
      expect(shouldUseUserKeyOnly("fallback")).toBe(false);
    });

    it("falls back to the own key only for platform-unavailable statuses", () => {
      expect(shouldFallbackToUserKey(429)).toBe(true);
      expect(shouldFallbackToUserKey(402)).toBe(true);
      expect(shouldFallbackToUserKey(503)).toBe(true);
      expect(shouldFallbackToUserKey(500)).toBe(false);
    });
  });

  describe("new BYOK direct providers (gemini, kimi, glm)", () => {
    it("getProviderModel returns sensible draft/polished defaults", () => {
      expect(getProviderModel("gemini", "draft")).toBe("gemini-2.5-flash");
      expect(getProviderModel("gemini", "polished")).toBe("gemini-2.5-pro");
      expect(getProviderModel("kimi", "draft")).toBe("moonshot-v1-8k");
      expect(getProviderModel("kimi", "polished")).toBe("kimi-k2-0905-preview");
      expect(getProviderModel("glm", "draft")).toBe("glm-4.5-air");
      expect(getProviderModel("glm", "polished")).toBe("glm-4.6");
    });

    it("clamps max_tokens for direct gemini calls, not just lovable/openrouter", () => {
      expect(clampMaxTokensForProvider("gemini", "gemini-2.5-pro", 16000)).toBe(8000);
      expect(clampMaxTokensForProvider("kimi", "moonshot-v1-8k", 16000)).toBe(16000);
      expect(clampMaxTokensForProvider("glm", "glm-4.6", 16000)).toBe(16000);
    });

    describe("callAI dispatch", () => {
      afterEach(() => {
        vi.restoreAllMocks();
      });

      function mockFetchOk() {
        return vi.spyOn(globalThis, "fetch").mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ choices: [{ message: { content: "{}" } }] }),
        } as Response);
      }

      it("routes gemini to the Gemini OpenAI-compatible endpoint", async () => {
        const fetchSpy = mockFetchOk();
        await callAI([{ role: "user", content: "hi" }], null, "AIzafakekey", { provider: "gemini" });
        const [url] = fetchSpy.mock.calls[0] as [string];
        expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
      });

      it("routes kimi to the Moonshot endpoint", async () => {
        const fetchSpy = mockFetchOk();
        await callAI([{ role: "user", content: "hi" }], null, "sk-fakekey", { provider: "kimi" });
        const [url] = fetchSpy.mock.calls[0] as [string];
        expect(url).toBe("https://api.moonshot.ai/v1/chat/completions");
      });

      it("routes glm to the Zhipu endpoint", async () => {
        const fetchSpy = mockFetchOk();
        await callAI([{ role: "user", content: "hi" }], null, "id.secret", { provider: "glm" });
        const [url] = fetchSpy.mock.calls[0] as [string];
        expect(url).toBe("https://open.bigmodel.cn/api/paas/v4/chat/completions");
      });
    });
  });

  describe("padTopics padding", () => {
    it("pads short topics list to exactly 7 items", () => {
      const { padTopics } = require("./promptHelpers.ts");
      const topics = ["AI", "SaaS"];
      const padded = padTopics(topics, "Core Idea");
      expect(padded).toHaveLength(7);
      expect(padded.slice(0, 2)).toEqual(["AI", "SaaS"]);
      expect(padded[2]).toContain("AI");
      expect(padded[3]).toContain("SaaS");
    });
  });
});
