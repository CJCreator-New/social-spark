import { Post } from "@/lib/calendarSchedule";

export interface PerformanceScore {
  hookStrength: number; // 1-10: Does opening line create curiosity?
  ctaEffectiveness: number; // 1-10: Specific question or vague?
  hashtagRelevance: number; // 0-100: % of hashtags related to topic
  readability: number; // Flesch-Kincaid grade level (lower is better, 8-12 ideal)
  overallScore: number; // 1-10: Average of all metrics
  feedback: string[]; // Actionable suggestions
}

/**
 * Detect if a hook creates curiosity (starts with stat, question, or strong verb)
 */
function scoreHookStrength(hook: string): number {
  if (!hook || hook.length < 10) return 3; // Too short = weak

  const hookLower = hook.toLowerCase();

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

  // Bonus for specificity (numbers, named entities)
  if (/\d+/.test(hook)) score += 1;

  // Penalty for generic phrases
  if (/^in this post|^this is about|^let me tell you/i.test(hookLower)) {
    score = Math.max(score - 2, 2);
  }

  return Math.min(score, 10);
}

/**
 * Score CTA effectiveness (specific action vs vague engagement)
 */
function scoreCtaEffectiveness(cta: string, topic: string): number {
  if (!cta || cta.length < 5) return 2; // No CTA

  const ctaLower = cta.toLowerCase();
  const topicLower = topic.toLowerCase();

  // Highest value: specific, topic-related CTAs
  const specificity = [
    /share.*thoughts|what.*you/i,
    /comment.*below|let.*know/i,
    /tag.*friend|forward.*to/i,
    /share.*experience|your story/i,
    /react.*with|vote|poll/i,
  ];

  let score = 4; // Baseline for generic CTAs

  // Check if CTA is specific and action-oriented
  if (specificity.some((pattern) => pattern.test(ctaLower))) {
    score = 7;
  }

  // Bonus if CTA relates to topic
  if (topicLower && ctaLower.includes(topicLower.split(" ")[0])) {
    score += 2;
  }

  // Penalty for weak CTAs ("let me know", "just saying")
  if (/just saying|thanks for reading|let me know/i.test(ctaLower)) {
    score = Math.max(score - 1, 3);
  }

  // Bonus for urgency/specificity
  if (/now|today|this week|don't miss/i.test(ctaLower)) {
    score += 1;
  }

  return Math.min(score, 10);
}

/**
 * Score hashtag relevance: % of hashtags that relate to the topic
 */
function scoreHashtagRelevance(hashtags: string, topic: string): number {
  if (!hashtags) return 0;

  const hashtagList = hashtags
    .split(/\s+/)
    .filter((tag) => tag.startsWith("#"))
    .map((tag) => tag.toLowerCase());

  if (hashtagList.length === 0) return 0;

  const topicWords = topic
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const relatedTags = hashtagList.filter((tag) =>
    topicWords.some((word) => tag.includes(word) || word.includes(tag))
  );

  return Math.round((relatedTags.length / hashtagList.length) * 100);
}

/**
 * Estimate Flesch-Kincaid Grade Level
 * 0-6 = easy, 7-8 = ideal for social, 9-12 = moderate, 13+ = difficult
 */
function estimateReadability(text: string): number {
  if (!text || text.length < 20) return 0;

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length || 1;
  const words = text.split(/\s+/).filter((w) => w.trim().length > 0).length;
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
    feedback.push("💡 Hook: Try starting with a question, stat, or surprising statement to grab attention.");
  }

  if (!scores.ctaEffectiveness || scores.ctaEffectiveness < 5) {
    feedback.push("📞 CTA: Make it specific—ask a direct question or request a concrete action.");
  }

  if (scores.hashtagRelevance !== undefined && scores.hashtagRelevance < 50) {
    feedback.push(
      `#️⃣ Hashtags: Only ${scores.hashtagRelevance}% relate to your topic. Make them more specific.`
    );
  }

  if (scores.readability !== undefined && scores.readability > 12) {
    feedback.push(
      `📖 Readability: Grade ${scores.readability} is complex. Use shorter sentences and simpler words.`
    );
  } else if (scores.readability !== undefined && scores.readability < 6) {
    feedback.push(
      `📖 Readability: Grade ${scores.readability} might be too basic. Add depth or complexity.`
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
 * Calculate complete performance score for a post
 */
export function calculatePerformanceScore(post: Post, topic: string = ""): PerformanceScore {
  const hookStrength = scoreHookStrength(post.hook);
  const ctaEffectiveness = scoreCtaEffectiveness(post.cta, topic);
  const hashtagRelevance = scoreHashtagRelevance(post.hashtags, topic || post.topic);
  const readability = estimateReadability(post.body);

  const overallScore = Math.round(
    (hookStrength + ctaEffectiveness + (hashtagRelevance / 10)) / 3
  );

  const feedback = generateFeedback(
    { hookStrength, ctaEffectiveness, hashtagRelevance, readability },
    post
  );

  return {
    hookStrength,
    ctaEffectiveness,
    hashtagRelevance,
    readability,
    overallScore,
    feedback,
  };
}

/**
 * Get color indicator for score (1-10)
 */
export function getScoreColor(score: number): string {
  if (score >= 8) return "#c8f09a"; // Accent green
  if (score >= 6) return "#ffd700"; // Golden
  if (score >= 4) return "#ff9500"; // Orange
  return "#ff6b6b"; // Red
}

/**
 * Get label for readability grade
 */
export function getReadabilityLabel(grade: number): string {
  if (grade < 6) return "Very Easy";
  if (grade < 8) return "Easy";
  if (grade < 10) return "Ideal";
  if (grade < 12) return "Moderate";
  if (grade < 14) return "Challenging";
  return "Very Difficult";
}
