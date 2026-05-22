import { describe, expect, it } from "vitest";
import { buildEngagementRules, buildPromptContext, cleanPayload } from "./promptHelpers.ts";

describe("promptHelpers engagement guidance", () => {
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
});
