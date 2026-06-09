import { describe, expect, it } from "vitest";
import { buildEngagementRules, buildPromptContext, buildCinematicImagePromptRules, cleanPayload, buildSystemMessage, buildUserMessage } from "./promptHelpers.ts";

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

  describe("getUserIdFromToken", () => {
    it("returns JWT sub claim if valid token is provided", () => {
      // Mock valid JWT with sub = "user-123-abc"
      // Header: {"alg":"HS256","typ":"JWT"}
      // Payload: {"sub":"user-123-abc","exp":1718292837}
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMy1hYmMiLCJleHAiOjE3MTgyOTI4Mzd9.signature";
      const { getUserIdFromToken } = require("./promptHelpers.ts");
      expect(getUserIdFromToken(token)).toBe("user-123-abc");
    });

    it("falls back to sliced token if no sub is present", () => {
      const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiJEb2UifQ.signature";
      const { getUserIdFromToken } = require("./promptHelpers.ts");
      expect(getUserIdFromToken(token)).toBe(token.slice(0, 32));
    });

    it("returns anonymous if token is null, empty or undefined", () => {
      const { getUserIdFromToken } = require("./promptHelpers.ts");
      expect(getUserIdFromToken(null)).toBe("anonymous");
      expect(getUserIdFromToken(undefined)).toBe("anonymous");
      expect(getUserIdFromToken("")).toBe("anonymous");
    });
  });

  describe("requiredWords", () => {
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
