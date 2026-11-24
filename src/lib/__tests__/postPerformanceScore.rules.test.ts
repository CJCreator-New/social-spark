import { describe, it, expect } from "vitest";
import type { Post } from "@/lib/calendarSchedule";
import {
  calculatePerformanceScore,
  getReadabilityLabel,
  getReadabilityScore,
  isLatinText,
  suggestBetterCta,
} from "../postPerformanceScore";

const basePost: Post = {
  day: 1,
  platform: "LinkedIn",
  topic: "Engineering",
  hook: "Did you know most teams ship slowly?",
  body: "Teams ship faster when they keep changes small and review them quickly. This is a longer paragraph of plain words.",
  cta: "Share your thoughts",
  hashtags: "#engineering",
} as unknown as Post;

const TAMIL = "செயற்கை நுண்ணறிவு இன்று எல்லா இடங்களிலும் பயன்படுத்தப்படுகிறது. டெவலப்பர்கள் சிறந்த குறியீட்டை எழுத இதைப் பயன்படுத்துகிறார்கள்.";

describe("postPerformanceScore word-boundary and language rules", () => {
  it("does not give the urgency bonus for 'know' but does for 'now'", () => {
    const know = calculatePerformanceScore({ ...basePost, cta: "Comment below with what we should know" }, "Engineering");
    const now = calculatePerformanceScore({ ...basePost, cta: "Comment below with what we should do now" }, "Engineering");
    const neutral = calculatePerformanceScore({ ...basePost, cta: "Comment below with what we should do" }, "Engineering");
    expect(know.ctaEffectiveness).toBe(neutral.ctaEffectiveness);
    expect(now.ctaEffectiveness).toBe(neutral.ctaEffectiveness + 1);
  });

  it("does not match 'ai' inside 'retail' or 'email' when suggesting a CTA", () => {
    const generic = suggestBetterCta("", "Plain topic", "Instagram");
    expect(suggestBetterCta("", "retail strategy", "Instagram")).toBe(generic);
    expect(suggestBetterCta("", "email newsletters", "Instagram")).toBe(generic);
    expect(suggestBetterCta("", "AI tools", "Instagram")).not.toBe(generic);
  });

  it("never treats a 1 to 2 character hashtag body as relevant", () => {
    for (const tag of ["#a", "#in", "#ai"]) {
      const score = calculatePerformanceScore({ ...basePost, hashtags: tag }, "AI Engineering");
      expect(score.hashtagRelevance).toBe(0);
    }
  });

  it("keeps the readability label and score aligned on band boundaries", () => {
    const expected: Array<[number, string, number]> = [
      [5, "Very Easy", 7],
      [6, "Easy", 8],
      [7, "Easy", 9],
      [8, "Ideal", 10],
      [12, "Ideal", 10],
      [13, "Challenging", 9],
      [14, "Challenging", 8],
      [15, "Very Difficult", 7],
    ];
    for (const [grade, label, score] of expected) {
      expect(getReadabilityLabel(grade)).toBe(label);
      expect(getReadabilityScore(grade)).toBe(score);
    }
    for (let g = 0; g <= 20; g++) {
      expect(getReadabilityLabel(g) === "Ideal").toBe(getReadabilityScore(g) === 10);
    }
  });

  it("isLatinText is true for English and false for Tamil", () => {
    expect(isLatinText("This is plain English text.")).toBe(true);
    expect(isLatinText(TAMIL)).toBe(false);
  });

  it("returns null readability and hashtag relevance for Tamil text, and still scores overall", () => {
    const score = calculatePerformanceScore(
      { ...basePost, body: TAMIL, hashtags: "#செயற்கை #நுண்ணறிவு", hook: "Did you know about this?" },
      "செயற்கை நுண்ணறிவு"
    );
    expect(score.readability).toBeNull();
    expect(score.hashtagRelevance).toBeNull();
    expect(score.overallScore).toBeGreaterThan(0);
    expect(score.overallScore).toBeLessThanOrEqual(10);
  });
});
