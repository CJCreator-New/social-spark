import { describe, it, expect } from "vitest";
import {
  calculatePerformanceScore,
  getWeakestPerformanceMetric,
  getScoreColor,
  getReadabilityLabel,
  getRegenerationGuidance,
  getWeakestMetrics,
  suggestBetterCta,
} from "../postPerformanceScore";
import { Post } from "../calendarSchedule";

describe("postPerformanceScore tests", () => {
  const samplePost: Post = {
    day: 1,
    dow: "Mon",
    topic: "AI Engineering",
    title: "Awesome AI Title",
    hook: "Did you know that 90% of developers use AI tools?",
    body: "AI engineering is taking the world by storm. Developers are using modern tools to write better code and speed up their productivity. Here is a long paragraph that has enough words to score well in readability and length tests.",
    cta: "Share your thoughts in the comment section below!",
    hashtags: "#ai #engineering #coding #developer #software",
  };

  describe("calculatePerformanceScore", () => {
    it("should score a strong post high", () => {
      const score = calculatePerformanceScore(samplePost, "AI Engineering");
      expect(score.hookStrength).toBeGreaterThanOrEqual(7);
      expect(score.ctaEffectiveness).toBeGreaterThanOrEqual(7);
      expect(score.overallScore).toBeGreaterThanOrEqual(5);
      expect(score.feedback.length).toBeLessThan(4);
    });

    it("should score a weak post low", () => {
      const weakPost: Post = {
        day: 1,
        dow: "Mon",
        topic: "AI Engineering",
        title: "",
        hook: "Generic title.",
        body: "Short body.",
        cta: "Thanks.",
        hashtags: "#unrelated",
      };
      const score = calculatePerformanceScore(weakPost, "AI Engineering");
      expect(score.hookStrength).toBeLessThan(7);
      expect(score.ctaEffectiveness).toBeLessThan(5);
      expect(score.overallScore).toBeLessThan(6);
      expect(score.feedback.length).toBeGreaterThan(0);
    });

    it("should handle empty or missing inputs gracefully", () => {
      const emptyPost: Post = {
        day: 1,
        dow: "Mon",
        topic: "",
        title: "",
        hook: "",
        body: "",
        cta: "",
        hashtags: "",
      };
      const score = calculatePerformanceScore(emptyPost, "");
      expect(score.hookStrength).toBe(3);
      expect(score.ctaEffectiveness).toBe(2);
      expect(score.overallScore).toBeLessThan(5);
    });
  });

  describe("calculatePerformanceScore edge cases (discriminating fixtures)", () => {
    it("scores hashtagRelevance as 0 when hashtags is an empty string", () => {
      const post: Post = { ...samplePost, hashtags: "" };
      const score = calculatePerformanceScore(post, "AI Engineering");
      expect(score.hashtagRelevance).toBe(0);
    });

    it("scores hashtagRelevance as 0 when hashtags contains only unrelated tags", () => {
      const post: Post = { ...samplePost, hashtags: "#unrelatedtopic #randomstuff" };
      const score = calculatePerformanceScore(post, "AI Engineering");
      expect(score.hashtagRelevance).toBe(0);
    });

    it("scores hashtagRelevance high when all tags relate to the topic", () => {
      const post: Post = { ...samplePost, hashtags: "#engineering #engineered" };
      const score = calculatePerformanceScore(post, "AI Engineering");
      expect(score.hashtagRelevance).toBe(100);
    });

    it("scores a CTA with no actionable verb lower than a specific, action-oriented CTA", () => {
      const noVerbCta: Post = { ...samplePost, cta: "Thanks for reading." };
      const actionCta: Post = {
        ...samplePost,
        cta: "Comment below with your favorite AI Engineering tool!",
      };
      const weakScore = calculatePerformanceScore(noVerbCta, "AI Engineering");
      const strongScore = calculatePerformanceScore(actionCta, "AI Engineering");
      expect(weakScore.ctaEffectiveness).toBeLessThan(strongScore.ctaEffectiveness);
    });

    it("does not crash on non-English (non-Latin script) body text and returns a finite readability grade", () => {
      const nonEnglishPost: Post = {
        ...samplePost,
        body: "कृत्रिम बुद्धिमत्ता आजकल हर जगह इस्तेमाल हो रही है। डेवलपर्स इसका उपयोग बेहतर कोड लिखने के लिए करते हैं।",
      };
      const score = calculatePerformanceScore(nonEnglishPost, "AI Engineering");
      expect(Number.isFinite(score.readability)).toBe(true);
      expect(score.readability).toBeGreaterThanOrEqual(0);
    });
  });

  describe("F-013: scoring heuristic false positive/negative fixes", () => {
    it("does not award a topic-match CTA bonus from a leading stopword (e.g. 'The future of AI')", () => {
      const stopwordTopicPost: Post = {
        ...samplePost,
        topic: "The future of AI",
        cta: "The best way to learn is by doing.",
      };
      const unrelatedTopicPost: Post = {
        ...samplePost,
        topic: "Personal finance",
        cta: "The best way to learn is by doing.",
      };
      const stopwordScore = calculatePerformanceScore(stopwordTopicPost, "The future of AI");
      const unrelatedScore = calculatePerformanceScore(unrelatedTopicPost, "Personal finance");
      // Both CTAs share no meaningful topic word — scores should match instead
      // of the "The future of AI" topic getting a false +2 bonus from "the".
      expect(stopwordScore.ctaEffectiveness).toBe(unrelatedScore.ctaEffectiveness);
    });

    it("still awards the CTA topic-match bonus for a real, non-stopword topic word", () => {
      const post: Post = {
        ...samplePost,
        topic: "The future of AI",
        cta: "What's your take on AI?",
      };
      const noMatchPost: Post = {
        ...samplePost,
        topic: "The future of AI",
        cta: "What's your take on this?",
      };
      const scoreWithMatch = calculatePerformanceScore(post, "The future of AI");
      const scoreNoMatch = calculatePerformanceScore(noMatchPost, "The future of AI");
      expect(scoreWithMatch.ctaEffectiveness).toBeGreaterThan(scoreNoMatch.ctaEffectiveness);
    });

    it("recognizes #growing as related to topic 'growth' (stem false negative)", () => {
      const post: Post = { ...samplePost, topic: "Business growth", hashtags: "#growing" };
      const score = calculatePerformanceScore(post, "Business growth");
      expect(score.hashtagRelevance).toBe(100);
    });

    it("splits sentences on semicolons and newlines instead of inflating the readability grade", () => {
      const semicolonBody =
        "Short point one; short point two; short point three; short point four.";
      const singleSentenceEquivalent = "Short point one. Short point two. Short point three. Short point four.";
      const semicolonPost: Post = { ...samplePost, body: semicolonBody };
      const dottedPost: Post = { ...samplePost, body: singleSentenceEquivalent };
      const semicolonScore = calculatePerformanceScore(semicolonPost, "AI Engineering");
      const dottedScore = calculatePerformanceScore(dottedPost, "AI Engineering");
      // Treating ';' as a sentence boundary like '.' should produce the same grade.
      expect(semicolonScore.readability).toBe(dottedScore.readability);
    });
  });

  describe("getWeakestPerformanceMetric", () => {
    it("should identify the weakest metric correctly", () => {
      const scores = {
        hookStrength: 2,
        ctaEffectiveness: 8,
        hashtagRelevance: 90,
        readability: 8,
        overallScore: 6,
        feedback: [],
        brandCompliance: 100,
        brandViolations: [],
      };
      const weakest = getWeakestPerformanceMetric(scores);
      expect(weakest).toBe("hookStrength");
    });
  });

  describe("getWeakestMetrics", () => {
    it("should return sorted metrics based on lowest scores", () => {
      const scores = {
        hookStrength: 4,
        ctaEffectiveness: 2,
        hashtagRelevance: 90,
        readability: 8,
        overallScore: 6,
        feedback: [],
        brandCompliance: 100,
        brandViolations: [],
      };
      const weakestList = getWeakestMetrics(scores);
      expect(weakestList[0]).toBe("ctaEffectiveness");
      expect(weakestList[1]).toBe("hookStrength");
    });
  });

  describe("getRegenerationGuidance", () => {
    it("should return guidance text for each focus metric", () => {
      expect(getRegenerationGuidance("hookStrength")).toContain("hook");
      expect(getRegenerationGuidance("ctaEffectiveness")).toContain("call-to-action");
    });
  });

  describe("suggestBetterCta", () => {
    it("should suggest platform-specific CTA", () => {
      const suggestion = suggestBetterCta("Click here", "SaaS Growth", "twitter");
      expect(suggestion).toBeTruthy();
      expect(typeof suggestion).toBe("string");
    });
  });

  describe("getScoreColor", () => {
    it("should return correct colors for various score ranges", () => {
      expect(getScoreColor(9)).toBe("#15803d");
      expect(getScoreColor(7)).toBe("#ffd700");
      expect(getScoreColor(5)).toBe("#b45309");
      expect(getScoreColor(2)).toBe("#b91c1c");
    });
  });

  describe("getReadabilityLabel", () => {
    it("should label grades correctly", () => {
      expect(getReadabilityLabel(4)).toBe("Very Easy");
      expect(getReadabilityLabel(7)).toBe("Easy");
      expect(getReadabilityLabel(9)).toBe("Ideal");
      expect(getReadabilityLabel(11)).toBe("Moderate");
      expect(getReadabilityLabel(13)).toBe("Challenging");
      expect(getReadabilityLabel(15)).toBe("Very Difficult");
    });
  });
});
