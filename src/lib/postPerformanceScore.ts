import { Post } from "@/lib/calendarSchedule";
import { WARM_PALETTE } from "@/lib/theme";

export interface PerformanceScore {
  hookStrength: number; // 1-10: Does opening line create curiosity?
  ctaEffectiveness: number; // 1-10: Specific question or vague?
  hashtagRelevance: number | null; // 0-100: % of hashtags related to topic; null when not scored (non-Latin text)
  readability: number | null; // Flesch-Kincaid grade level (8-12 ideal); null when not scored (non-Latin text)
  brandCompliance: number; // 1-10: absence of forbidden terms and hashtag violations
  brandViolations: string[]; // List of found forbidden phrases/terms
  overallScore: number; // 1-10: Average of all metrics (rounded, for display)
  rawOverallScore?: number; // 1-10: Unrounded average, used for bucketing thresholds
  feedback: string[]; // Actionable suggestions
}

export type PerformanceFocusMetric =
  "hookStrength" | "ctaEffectiveness" | "hashtagRelevance" | "readability" | "brandCompliance";

/**
 * True when at least 80% of the letter characters are Latin script (or when
 * there are no letters at all). English-only heuristics (syllables, stems) are
 * meaningless for other scripts, so callers skip those metrics.
 */
export function isLatinText(text: string): boolean {
  const letters = (text || "").match(/\p{L}/gu);
  if (!letters || letters.length === 0) return true;
  const latin = letters.filter((ch) => /\p{Script=Latin}/u.test(ch)).length;
  return latin / letters.length >= 0.8;
}

/** Lowercased word tokens (letters/digits only). */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0);
}

/**
 * Whole-word match for a keyword. Short keywords (<= 3 chars) must match a
 * whole word (optionally plural); longer ones match at a word start so
 * "build" still matches "building" but "ai" never matches "retail".
 */
function hasTerm(textLower: string, term: string): boolean {
  // Terms are fixed lowercase literals from this file (no regex metacharacters).
  const pattern =
    term.length <= 3
      ? `(?<![\\p{L}\\p{N}])${term}s?(?![\\p{L}\\p{N}])`
      : `(?<![\\p{L}\\p{N}])${term}`;
  return new RegExp(pattern, "u").test(textLower);
}

/**
 * Detect if a hook creates curiosity (starts with stat, question, or strong verb)
 */
function scoreHookStrength(hook: string, platform?: string): number {
  if (!hook || hook.length < 10) return 3; // Too short = weak

  const hookLower = hook.toLowerCase();
  const plat = (platform || "").toLowerCase();

  // High-engagement openers
  const strongOpeners = [
    /^did you know/i,
    /^what if/i,
    /^here's the thing/i,
    /^\d+%\s/,
    /^\d+\s(of|in)\s/,
    /^imagine/i,
    /^here's why/i,
    /^the truth is/i,
    /^most people don't/i,
    /^never realized/i,
    /^most .+ (are|don't|never)/i,
    /^stop/i,
    /^the (real|truth|problem)/i,
  ];

  let score = 5; // Baseline

  if (strongOpeners.some((pattern) => pattern.test(hookLower))) {
    score = 8;
  } else if (/[?!]$/.test(hook)) {
    // Ends with question or exclamation
    score = 7;
  } else if (hookLower.split(" ").length < 5) {
    // Very short hooks often punchy
    score = 6;
  }

  // Platform specific adjustments
  if (plat === "twitter" || plat === "x") {
    if (hook.length >= 20 && hook.length <= 100) {
      score += 1;
    } else if (hook.length > 140) {
      score -= 2;
    }
  } else {
    if (hook.length >= 35 && hook.length <= 180) {
      score += 1;
    }
  }

  // Bonus for specificity (numbers, named entities)
  if (/\d+/.test(hook)) score += 1;

  // Penalty for generic phrases
  if (/^in this post|^this is about|^let me tell you/i.test(hookLower)) {
    score = Math.max(score - 2, 2);
  }

  return Math.min(score, 10);
}

/**
 * Common English stopwords that carry no topical meaning on their own.
 * Excluded before matching topic words against CTA/hashtag text, so a topic
 * like "The future of AI" doesn't award a bonus for "the" or "of" appearing
 * incidentally in unrelated CTA/hashtag text.
 */
const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "for", "to", "and", "or", "is", "are",
  "was", "were", "be", "been", "being", "this", "that", "these", "those",
  "with", "from", "by", "as", "at", "it", "its", "your", "you", "our", "we",
  "how", "what", "why", "who", "which",
]);

/** Non-stopword topic tokens, lowercased. */
function meaningfulTopicWords(topic: string): string[] {
  return topic
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
}

/**
 * Score CTA effectiveness (specific action vs vague engagement)
 */
function scoreCtaEffectiveness(cta: string, topic: string, platform?: string): number {
  if (!cta || cta.length < 5) return 2; // No CTA

  const ctaLower = cta.toLowerCase();
  const plat = (platform || "").toLowerCase();

  // Highest value: specific, topic-related CTAs
  const specificity = [
    /share.*thoughts|what.*you/i,
    /comment.*below|let.*know/i,
    /tag.*friend|forward.*to/i,
    /share.*experience|your story/i,
    /react.*with|\b(vote|poll)\b/i,
  ];

  let score = 4; // Baseline for generic CTAs

  // Check if CTA is specific and action-oriented
  if (specificity.some((pattern) => pattern.test(ctaLower))) {
    score = 7;
  }

  // Bonus if CTA relates to a meaningful (non-stopword) topic word
  const topicWords = meaningfulTopicWords(topic);
  const ctaStems = tokenize(ctaLower).map(stem);
  if (topicWords.some((word) => ctaStems.includes(stem(word)))) {
    score += 2;
  }

  // Penalty for weak CTAs ("let me know", "just saying")
  if (/just saying|thanks for reading|let me know/i.test(ctaLower)) {
    score = Math.max(score - 1, 3);
  }

  // Platform specific adjustments
  if (plat === "twitter" || plat === "x") {
    if (cta.length > 80) {
      score = Math.max(score - 1, 3);
    } else {
      score += 1;
    }
  } else if (plat === "linkedin") {
    if (/thought|opinion|agree|disagree|experience/i.test(ctaLower)) {
      score += 1;
    }
  }

  // Bonus for urgency/specificity
  if (/\b(now|today|this week|don't miss)\b/i.test(ctaLower)) {
    score += 1;
  }

  return Math.min(score, 10);
}

/**
 * Strip common suffixes so word forms like "strategy"/"strategies",
 * "marketing"/"marketed", "growing"/"growth", "warmth"/"warm", or
 * "happiness"/"happy" are recognized as related.
 */
function stem(word: string): string {
  return word
    .replace(/(ies)$/, "y")
    .replace(/(ness)$/, "")
    .replace(/(tion|sion)$/, "t")
    .replace(/(th)$/, "")
    .replace(/(ing|ers|er|ed|es|s)$/, "");
}

/**
 * Score hashtag relevance: % of hashtags that relate to the topic
 */
const MIN_HASHTAG_BODY_LENGTH = 3;

function scoreHashtagRelevance(hashtags: string, topic: string): number | null {
  // English stems/topic words are meaningless for other scripts: don't score.
  if (!isLatinText(`${hashtags || ""} ${topic || ""}`)) return null;
  if (!hashtags) return 0;

  const hashtagList = hashtags
    .split(/\s+/)
    .filter((tag) => tag.startsWith("#"))
    .map((tag) => tag.toLowerCase());

  if (hashtagList.length === 0) return 0;

  const topicWords = meaningfulTopicWords(topic).filter((w) => w.length > 3);
  const topicStems = topicWords.map(stem);

  const relatedTags = hashtagList.filter((tag) => {
    const tagBody = tag.replace(/^#/, "");
    // Very short tags (#a, #in) are never treated as topic-relevant.
    if (tagBody.length < MIN_HASHTAG_BODY_LENGTH) return false;
    const tagStem = stem(tagBody);
    return topicWords.some((word, i) => {
      // Whole-token match, or the tag is a compound containing the (4+ char) topic word.
      if (tagBody === word || tagBody.includes(word)) return true;
      const wordStem = topicStems[i];
      if (tagStem === wordStem) return true;
      return wordStem.length >= 4 && tagStem.includes(wordStem);
    });
  });

  return Math.round((relatedTags.length / hashtagList.length) * 100);
}

/**
 * Estimate Flesch-Kincaid Grade Level
 * 0-6 = easy, 7-8 = ideal for social, 9-12 = moderate, 13+ = difficult
 */
function estimateReadability(text: string): number | null {
  // The syllable counter is English-only: don't score other scripts.
  if (!isLatinText(text)) return null;
  if (!text || text.length < 20) return 0;

  const sentences = text.split(/[.!?;\n]+|\s+—\s+|--/).filter((s) => s.trim().length > 0).length || 1;
  const words = text.split(/\s+/).filter((w) => w.trim().length > 0).length;
  if (words === 0) return 0;
  const syllables = estimateSyllables(text);

  // Flesch-Kincaid Grade = 0.39(W/S) + 11.8(Sy/W) - 15.59
  const grade = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;

  return Math.max(Math.round(grade), 0);
}

/**
 * Rough syllable estimation (useful for readability scoring)
 */
function estimateSyllables(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  let count = 0;

  for (const word of words) {
    // Count vowel groups
    const vowelGroups = (word.match(/[aeiouy]+/g) || []).length;
    // Adjust for silent 'e' and other rules
    count += Math.max(1, vowelGroups - (word.endsWith("e") ? 1 : 0));
  }

  return Math.max(count, 1);
}

/**
 * Generate actionable feedback based on scores
 */
function generateFeedback(scores: Partial<PerformanceScore>, post: Post): string[] {
  const feedback: string[] = [];

  if (!scores.hookStrength || scores.hookStrength < 5) {
    feedback.push(
      "💡 Hook: Try starting with a question, stat, or surprising statement to grab attention."
    );
  }

  if (!scores.ctaEffectiveness || scores.ctaEffectiveness < 5) {
    feedback.push("📞 CTA: Make it specific—ask a direct question or request a concrete action.");
  }

  if (typeof scores.hashtagRelevance === "number" && scores.hashtagRelevance < 50) {
    feedback.push(
      `#️⃣ Hashtags: Only ${scores.hashtagRelevance}% relate to your topic. Make them more specific.`
    );
  }

  if (typeof scores.readability === "number" && scores.readability > 12) {
    feedback.push(
      `📖 Readability: Grade ${scores.readability} is complex. Use shorter sentences and simpler words.`
    );
  } else if (typeof scores.readability === "number" && scores.readability < 6) {
    feedback.push(
      `📖 Readability: Grade ${scores.readability} might be too basic. Add depth or complexity.`
    );
  }

  if (
    "brandViolations" in scores &&
    Array.isArray((scores as any).brandViolations) &&
    (scores as any).brandViolations.length > 0
  ) {
    const violations = (scores as any).brandViolations as string[];
    feedback.push(
      "🚫 Brand: Forbidden term(s) found: " + violations.join(", ") + ". Remove before publishing."
    );
  }

  if (post.body && post.body.split(/\s+/).length < 30) {
    feedback.push("✍️ Length: Consider expanding the body for more depth and value.");
  }

  if (!post.hashtags || post.hashtags.trim().length === 0) {
    feedback.push("#️⃣ Add 3–5 relevant hashtags to increase discoverability.");
  }

  return feedback;
}

/**
 * Single source of truth for readability grade bands. Both the label shown to
 * the user and the 0-10 score are derived from this table so they agree.
 * `below` is the exclusive upper grade bound; `ideal` bands score a full 10.
 */
const READABILITY_BANDS: ReadonlyArray<{ below: number; label: string; ideal: boolean }> = [
  { below: 6, label: "Very Easy", ideal: false },
  { below: 8, label: "Easy", ideal: false },
  { below: 13, label: "Ideal", ideal: true }, // grades 8-12
  { below: 15, label: "Challenging", ideal: false },
  { below: Infinity, label: "Very Difficult", ideal: false },
];

function getReadabilityBand(grade: number) {
  return READABILITY_BANDS.find((b) => grade < b.below) ?? READABILITY_BANDS[READABILITY_BANDS.length - 1];
}

/**
 * Normalize readability grade to a 0-10 score
 */
function scoreReadability(grade: number): number {
  if (getReadabilityBand(grade).ideal) return 10;
  if (grade < 8) return Math.max(0, 10 - (8 - grade));
  return Math.max(0, 10 - (grade - 12));
}

/**
 * Score brand compliance: checks for forbidden phrases and hashtags
 */
export function scoreBrandCompliance(
  postText: string,
  hashtags: string,
  forbiddenPhrases: string[],
  forbiddenHashtags: string[]
): { score: number; violations: string[] } {
  const violations: string[] = [];
  const textLower = (postText || "").toLowerCase();
  const hashtagsLower = (hashtags || "").toLowerCase();

  for (const phrase of forbiddenPhrases) {
    if (phrase && textLower.includes(phrase.toLowerCase())) {
      violations.push(phrase);
    }
  }

  for (const tag of forbiddenHashtags) {
    if (tag && hashtagsLower.includes(tag.toLowerCase())) {
      violations.push(tag);
    }
  }

  return { score: Math.max(0, 10 - violations.length * 2), violations };
}

/**
 * Calculate complete performance score for a post
 */
export function calculatePerformanceScore(
  post: Post,
  topic: string = "",
  platform?: string,
  forbiddenPhrases: string[] = [],
  forbiddenHashtags: string[] = []
): PerformanceScore {
  const plat = platform || post.platform || "";
  const hookStrength = scoreHookStrength(post.hook, plat);
  const ctaEffectiveness = scoreCtaEffectiveness(post.cta, topic, plat);
  const hashtagRelevance = scoreHashtagRelevance(post.hashtags, topic || post.topic);
  const readability = estimateReadability(post.body);
  const readabilityScoreVal = readability === null ? null : scoreReadability(readability);

  const { score: brandCompliance, violations: brandViolations } = scoreBrandCompliance(
    (post.hook || "") + " " + (post.body || "") + " " + (post.cta || ""),
    post.hashtags || "",
    forbiddenPhrases,
    forbiddenHashtags
  );

  // Weight formula: hook 30%, CTA 25%, hashtags 20%, readability 15%, brandCompliance 10%
  // Unscored (null) metrics are dropped and the remaining weights renormalised.
  const weighted: Array<[number | null, number]> = [
    [hookStrength, 0.3],
    [ctaEffectiveness, 0.25],
    [hashtagRelevance === null ? null : hashtagRelevance / 10, 0.2],
    [readabilityScoreVal, 0.15],
    [brandCompliance, 0.1],
  ];
  let weightSum = 0;
  let weightedTotal = 0;
  for (const [val, w] of weighted) {
    if (val === null) continue;
    weightSum += w;
    weightedTotal += val * w;
  }
  const rawOverallScore = weightedTotal / weightSum;
  const overallScore = Math.round(rawOverallScore);

  const feedback = generateFeedback(
    { hookStrength, ctaEffectiveness, hashtagRelevance, readability, brandViolations } as any,
    post
  );

  return {
    hookStrength,
    ctaEffectiveness,
    hashtagRelevance,
    readability,
    brandCompliance,
    brandViolations,
    overallScore,
    rawOverallScore,
    feedback,
  };
}

export function getWeakestPerformanceMetric(score: PerformanceScore): PerformanceFocusMetric {
  const candidates: Array<{ metric: PerformanceFocusMetric; gap: number }> = [
    { metric: "hookStrength", gap: 10 - score.hookStrength },
    { metric: "ctaEffectiveness", gap: 10 - score.ctaEffectiveness },
    { metric: "brandCompliance", gap: 10 - score.brandCompliance },
  ];
  if (score.hashtagRelevance !== null) {
    candidates.push({ metric: "hashtagRelevance", gap: 10 - score.hashtagRelevance / 10 });
  }
  if (score.readability !== null) {
    candidates.push({ metric: "readability", gap: 10 - scoreReadability(score.readability) });
  }

  return candidates.sort((a, b) => b.gap - a.gap)[0]?.metric || "hookStrength";
}

/**
 * Get color indicator for score (1-10)
 */
export function getScoreColor(score: number): string {
  if (score >= 8) return WARM_PALETTE.scoreHigh;
  if (score >= 6) return WARM_PALETTE.scoreGold; // Golden
  if (score >= 4) return WARM_PALETTE.scoreMed;
  return WARM_PALETTE.scoreLow;
}

/**
 * Get label for readability grade
 */
export function getReadabilityLabel(grade: number): string {
  return getReadabilityBand(grade).label;
}

/** 0-10 readability score for a grade, using the same bands as the label. */
export function getReadabilityScore(grade: number): number {
  return scoreReadability(grade);
}

/**
 * Maps a performance focus metric to targeted instructions.
 */
export function getRegenerationGuidance(metric: PerformanceFocusMetric): string {
  switch (metric) {
    case "hookStrength":
      return "Make the opening line (hook) significantly stronger and more engaging. Start with a compelling question, a counter-intuitive stat, or a bold assertion to immediately capture attention.";
    case "ctaEffectiveness":
      return "Refine the call-to-action (CTA) to be more specific, actionable, and clear. Encourage direct conversation, a clear next step, or a response to a specific question rather than a generic prompt.";
    case "hashtagRelevance":
      return "Optimize the hashtags to be highly relevant to the core topic. Remove generic tags and include standard, search-friendly terms matching the subject matter.";
    case "readability":
      return "Improve readability by using shorter sentences, simpler words, and clear formatting (bullet points, line breaks). Aim for an accessible Flesch-Kincaid style.";
    case "brandCompliance":
      return "Remove any forbidden terms, phrases, or hashtags flagged by the brand compliance check before publishing.";
    default:
      return "";
  }
}

/**
 * Returns all weak metrics below a certain threshold.
 */
export function getWeakestMetrics(
  score: PerformanceScore,
  threshold: number = 6
): PerformanceFocusMetric[] {
  const candidates: Array<{ metric: PerformanceFocusMetric; gap: number; scoreVal: number }> = [
    { metric: "hookStrength", gap: 10 - score.hookStrength, scoreVal: score.hookStrength },
    {
      metric: "ctaEffectiveness",
      gap: 10 - score.ctaEffectiveness,
      scoreVal: score.ctaEffectiveness,
    },
    { metric: "brandCompliance", gap: 10 - score.brandCompliance, scoreVal: score.brandCompliance },
  ];
  if (score.hashtagRelevance !== null) {
    const v = score.hashtagRelevance / 10;
    candidates.push({ metric: "hashtagRelevance", gap: 10 - v, scoreVal: v });
  }
  if (score.readability !== null) {
    const v = scoreReadability(score.readability);
    candidates.push({ metric: "readability", gap: 10 - v, scoreVal: v });
  }

  return candidates
    .filter((c) => c.scoreVal < threshold)
    .sort((a, b) => b.gap - a.gap)
    .map((c) => c.metric);
}

/**
 * Suggests a stronger CTA based on the topic and platform.
 */
export function suggestBetterCta(currentCta: string, topic: string, platform?: string): string {
  const topicLower = topic.toLowerCase();
  const has = (...terms: string[]) => terms.some((t) => hasTerm(topicLower, t));

  if (has("tech", "code", "build", "ai")) {
    return "What's in your current tech stack? Drop a comment below! 👇";
  }
  if (has("growth", "marketing", "sales", "audience")) {
    return "What is your main growth channel right now? Let's discuss in the comments!";
  }
  if (has("design", "ux", "art")) {
    return "Which design trend are you loving (or hating) lately? Comment below!";
  }
  if (has("productivity", "routine", "habit")) {
    return "What is the single best productivity hack you've adopted this year? 👇";
  }
  if (has("career", "job", "hiring")) {
    return "What is the biggest lesson you've learned in your career journey? Tell me below!";
  }

  if (platform?.toLowerCase() === "linkedin") {
    return "Agree or disagree? Share your thoughts in the comments. 👇";
  }
  if (platform?.toLowerCase() === "twitter" || platform?.toLowerCase() === "x") {
    return "Reply with your thoughts below!";
  }

  return "What is your #1 takeaway from this? Let me know in the comments! 👇";
}

/**
 * Feature: Engagement Prediction Badge
 * Returns a simple High/Medium/Low prediction for use on the WeekStrip
 */
export function getEngagementPrediction(
  post: Post,
  platform: string = ""
): "High" | "Medium" | "Low" {
  const score = calculatePerformanceScore(post, post.topic || "", platform);
  const bucketScore = score.rawOverallScore ?? score.overallScore;
  if (bucketScore >= 7) return "High";
  if (bucketScore >= 5) return "Medium";
  return "Low";
}

export type EngagementLevel = "High" | "Medium" | "Low";

export const ENGAGEMENT_BADGE: Record<
  EngagementLevel,
  { emoji: string; color: string; bg: string }
> = {
  High: { emoji: "🟢", color: WARM_PALETTE.scoreHigh, bg: "rgba(21,128,61,0.10)" },
  Medium: { emoji: "🟡", color: WARM_PALETTE.scoreMed, bg: "rgba(180,83,9,0.10)" },
  Low: { emoji: "🔴", color: WARM_PALETTE.scoreLow, bg: "rgba(185,28,28,0.10)" },
};
