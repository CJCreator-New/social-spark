/**
 * Plan coverage matching: decides whether a planned topic is already covered by
 * any post topic, using normalised token overlap instead of exact string match.
 */

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in",
  "is", "it", "of", "on", "or", "our", "that", "the", "this", "to", "we", "with",
  "your", "you", "why", "what", "when", "about", "into", "my",
]);

export const COVERAGE_THRESHOLD = 0.6;

export function tokenizeTopic(text: string | null | undefined): string[] {
  if (!text) return [];
  const tokens = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t && !STOP_WORDS.has(t));
  return Array.from(new Set(tokens));
}

/** True when >= 60% of the planned topic's significant tokens appear in one post topic. */
export function isTopicCovered(
  topic: string | null | undefined,
  postTopics: Array<string | null | undefined>
): boolean {
  const wanted = tokenizeTopic(topic);
  if (wanted.length === 0) return false;
  return postTopics.some((pt) => {
    const have = new Set(tokenizeTopic(pt));
    if (have.size === 0) return false;
    const hits = wanted.filter((t) => have.has(t)).length;
    return hits / wanted.length >= COVERAGE_THRESHOLD;
  });
}
