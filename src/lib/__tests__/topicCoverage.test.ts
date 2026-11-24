import { describe, it, expect } from "vitest";
import { isTopicCovered } from "../topicCoverage";

describe("isTopicCovered", () => {
  it("ignores case and punctuation", () => {
    expect(isTopicCovered("Summer Sale!", ["summer sale"])).toBe(true);
  });
  it("accepts a one-word rewording with enough overlap", () => {
    expect(isTopicCovered("Tips for growing your email list fast", ["Growing your email list tips"])).toBe(true);
  });
  it("rejects unrelated topics", () => {
    expect(isTopicCovered("Summer sale", ["Team culture spotlight"])).toBe(false);
  });
  it("rejects empty topic", () => {
    expect(isTopicCovered("", ["anything"])).toBe(false);
    expect(isTopicCovered("the of", ["the of"])).toBe(false);
  });
});
