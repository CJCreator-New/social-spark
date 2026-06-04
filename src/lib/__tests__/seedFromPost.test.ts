import { describe, it, expect } from "vitest";
import { createSeedFromPost } from "../seedFromPost";
import { Post } from "../../components/wizard/constants";

describe("seedFromPost library helpers", () => {
  it("should create derivative seed with cleaned and truncated hook", () => {
    const post: Post = {
      id: "p1",
      day: 1,
      dow: "Mon",
      topic: "Tech Leadership",
      format: "Short text",
      title: "My title",
      hook: "🚀 In the fast-paced world of technology, leadership is about empathy first.",
      body: "Lorem ipsum...",
      cta: "What do you think?",
      hashtags: "#leadership",
      rationale: "Rationale",
      platform: "LinkedIn"
    };

    const seed = createSeedFromPost(post, "Twitter");
    
    expect(seed.topic).toBe("Tech Leadership");
    expect(seed.platform).toBe("Twitter");
    expect(seed.coreIdea).toContain("In the fast-paced world of technology");
    expect(seed.coreIdea).not.toContain("🚀");
  });
});
