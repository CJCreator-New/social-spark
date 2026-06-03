import { describe, it, expect } from "vitest";
import {
  calculatePerformanceScore,
  getWeakestPerformanceMetric,
  getScoreColor,
  getReadabilityLabel,
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

  describe("getWeakestPerformanceMetric", () => {
    it("should identify the weakest metric correctly", () => {
      const scores = {
        hookStrength: 2,
        ctaEffectiveness: 8,
        hashtagRelevance: 90,
        readability: 8,
        overallScore: 6,
        feedback: [],
      };
      const weakest = getWeakestPerformanceMetric(scores);
      expect(weakest).toBe("hookStrength");
    });
  });

  describe("getScoreColor", () => {
    it("should return correct colors for various score ranges", () => {
      expect(getScoreColor(9)).toBe("#c8f09a");
      expect(getScoreColor(7)).toBe("#ffd700");
      expect(getScoreColor(5)).toBe("#ff9500");
      expect(getScoreColor(2)).toBe("#ff6b6b");
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
