import { z } from "zod";

/**
 * Centralized configuration for Social Spark
 *
 * This module contains all hardcoded values, rate limits, timeouts, and feature flags.
 * Maintaining a single config file enables:
 * - Easy A/B testing without code changes
 * - Quick tuning of performance parameters
 * - Consistent values across frontend and backend
 * - Clear documentation of all app constants
 *
 * Usage:
 * ```typescript
 * import { RATE_LIMITS, PLATFORM_LIMITS, validateConfig } from '@/lib/config';
 *
 * // Validate on app startup
 * validateConfig();
 *
 * // Use config values
 * const twitterLimit = getPlatformLimit('twitter');
 * ```
 */

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Rate limit configuration per endpoint (requests per window).
 * Used to prevent abuse and throttle AI service calls.
 *
 * Tuning guidelines:
 * - generate-calendar: Slower (30-90s), so lower limit (10/min)
 * - generate-single-post: Faster (5-15s), higher limit (20/min)
 * - regenerate-post: Very fast (2-5s), highest limit (30/min)
 *
 * These values assume 1000 concurrent users — adjust based on load testing.
 */
export const RATE_LIMITS = {
  generateCalendar: {
    limit: 10,
    windowSeconds: 60,
  },
  generateSinglePost: {
    limit: 20,
    windowSeconds: 60,
  },
  regeneratePost: {
    limit: 30,
    windowSeconds: 60,
  },
} as const;

// ============================================================================
// API RETRY CONFIGURATION
// ============================================================================

/**
 * Exponential backoff retry configuration for external API calls.
 *
 * Behavior:
 * - Attempt 1: immediately
 * - Attempt 2: 1000ms delay
 * - Attempt 3: 2000ms delay (with backoff multiplier)
 * - Attempt 4: 4000ms delay (max 10000ms)
 *
 * Used for Lovable AI Gateway calls and Supabase requests.
 */
export const API_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
} as const;

// ============================================================================
// GENERATION UI TIMEOUTS & INTERVALS
// ============================================================================

/**
 * Timeouts and intervals for post generation UI feedback.
 *
 * - hardTimeoutSeconds: Maximum wait time before showing error (should match edge function timeout)
 * - statusMessageCycleMs: How often to show rotating status messages ("Generating...", "Still working...")
 * - initialDelayMs: Initial wait before showing loading UI (prevents flashing for fast requests)
 */
export const GENERATION_CONFIG = {
  hardTimeoutSeconds: 90,
  statusMessageCycleMs: 2200,
  initialDelayMs: 1000,
} as const;

// ============================================================================
// INPUT VALIDATION LIMITS
// ============================================================================

/**
 * Maximum counts for form input arrays.
 * Prevents UI clutter and reduces payload size for API calls.
 *
 * - bannedWordsMax: Too many banned words become hard to track
 * - requiredWordsMax: Too many required words make it hard to write naturally
 * - bannedHashtagsMax: Excessive restrictions reduce hashtag effectiveness
 * - requiredHashtagsMax: Too many required hashtags = irrelevant content
 */
export const VALIDATION_LIMITS = {
  bannedWordsMax: 20,
  requiredWordsMax: 10,
  bannedHashtagsMax: 30,
  requiredHashtagsMax: 10,
} as const;

// ============================================================================
// PLATFORM CHARACTER LIMITS
// ============================================================================

/**
 * Maximum character/word limits per platform for post body.
 * These are platform native limits; actual content should be shorter for readability.
 *
 * Sources:
 * - Twitter: 280 characters (2017 increase from 140)
 * - LinkedIn: ~3000 characters for optimal engagement
 * - Instagram: 2200 characters (caption limit)
 * - TikTok: 2200 characters (caption limit)
 * - Threads: 500 characters (Meta's Twitter alternative)
 * - Bluesky: 300 characters
 * - Newsletter: 5000 words equivalent
 * - Facebook: 63206 characters (very high, rarely relevant)
 *
 * Usage:
 * ```typescript
 * const limit = getPlatformLimit('twitter');  // 280
 * const wordCount = post.split(' ').length;
 * if (wordCount > limit) console.warn('Post too long');
 * ```
 */
export const PLATFORM_LIMITS = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  twitter: 280,
  tiktok: 2200,
  threads: 500,
  bluesky: 300,
  newsletter: 5000,
} as const;

// ============================================================================
// CONTENT LENGTH GUIDES (words)
// ============================================================================

/**
 * Word count ranges for different post lengths.
 * These are recommendations for optimal engagement and platform fit.
 *
 * - short: Quick hit, high engagement, ideal for social scrolling
 * - medium: Sweet spot for most platforms, enough detail without overwhelming
 * - long: Deep dive, newsletter-style, for thought leadership
 */
export const LENGTH_GUIDES = {
  short: { min: 80, max: 120, label: "80–120 words" },
  medium: { min: 160, max: 230, label: "160–230 words" },
  long: { min: 280, max: 380, label: "280–380 words" },
} as const;

// ============================================================================
// STRUCTURE TEMPLATES
// ============================================================================

/**
 * Content structure patterns to guide AI generation.
 * Users select their preferred mix, and AI generates variety within constraints.
 *
 * Examples:
 * - narrative: "I started with $500..."
 * - list-based: "5 ways to improve your funnel"
 * - questions: "Have you considered...?"
 * - how-to: "Step 1: ... Step 2: ..."
 */
export const STRUCTURE_TEMPLATES = {
  mixed: "Mix different structures across the week (hook-story-CTA, list-based, questions, etc.)",
  narrative: "Tell a short story or use a narrative arc",
  listBased: "Use bullet points, numbered lists, or frameworks",
  questions: "Ask thought-provoking questions",
  howTo: "Provide step-by-step instructions",
} as const;

// ============================================================================
// REACT QUERY DEFAULTS
// ============================================================================

/**
 * React Query configuration for data fetching and caching.
 *
 * - staleTimeMs: How long before cached data is considered "stale"
 * - gcTimeMs: How long to keep unused data in memory (garbage collection time)
 * - retryCount: How many times to retry failed queries
 *
 * Adjust based on:
 * - How often backend data changes
 * - Expected user idle time
 * - Network reliability
 */
export const REACT_QUERY_CONFIG = {
  staleTimeMs: 5 * 60 * 1000, // 5 minutes
  gcTimeMs: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  retryCount: 1,
} as const;

// ============================================================================
// DRAFT AUTO-SAVE
// ============================================================================

/**
 * Auto-save configuration for preventing data loss.
 *
 * Behavior:
 * - Saves form state + generated posts to localStorage every 2 seconds
 * - User can reload page and continue where they left off
 * - Old drafts auto-expire after 30 days
 *
 * Storage keys are versioned (v1) to support schema migrations.
 */
export const DRAFT_CONFIG = {
  storageKey: "contentforge:draft:v1",
  postsStorageKey: "contentforge:posts-draft:v1",
  expirationDays: 30,
  autoSaveIntervalMs: 2000,
} as const;

// ============================================================================
// DATABASE & BACKGROUND JOBS
// ============================================================================

/**
 * Configuration for bulk operations and background job processing.
 *
 * - bulkRegenerateConcurrency: How many posts to regenerate in parallel
 * - workerPoolSize: Number of concurrent workers for background jobs
 * - Backoff strategy: Used for retrying failed jobs with exponential delays
 */
export const BACKGROUND_JOB_CONFIG = {
  bulkRegenerateConcurrency: 2,
  bulkRegenerateWorkerPoolSize: 2,
  exponentialBackoffMultiplier: 1.5,
  maxBackoffMs: 30000,
} as const;

// ============================================================================
// TIMEZONE & SCHEDULING
// ============================================================================

/**
 * Configuration for timezone handling and post scheduling.
 *
 * - defaultTimezone: Fallback if user hasn't selected their timezone
 * - supportFallbackTimezones: Use curated list if Intl.supportedValuesOf unavailable
 */
export const SCHEDULING_CONFIG = {
  defaultTimezone: "America/New_York",
  supportFallbackTimezones: true,
  fallbackTimezoneCount: 30,
} as const;

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FEATURES = {
  singleDayGeneration: true,
  bulkRegenerateWithConcurrency: true,
  draftAutoSave: true,
  failureReasonDisplay: true,
  keyboardShortcuts: true,
  exportICSWithTZ: true,
} as const;

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const ConfigSchema = z.object({
  rateLimits: z.object({
    generateCalendar: z.object({
      limit: z.number().positive(),
      windowSeconds: z.number().positive(),
    }),
    generateSinglePost: z.object({
      limit: z.number().positive(),
      windowSeconds: z.number().positive(),
    }),
    regeneratePost: z.object({
      limit: z.number().positive(),
      windowSeconds: z.number().positive(),
    }),
  }),
  apiRetry: z.object({
    maxRetries: z.number().nonnegative(),
    initialDelayMs: z.number().positive(),
    maxDelayMs: z.number().positive(),
    backoffMultiplier: z.number().positive(),
  }),
  generation: z.object({
    hardTimeoutSeconds: z.number().positive(),
    statusMessageCycleMs: z.number().positive(),
    initialDelayMs: z.number().positive(),
  }),
  validationLimits: z.object({
    bannedWordsMax: z.number().positive(),
    requiredWordsMax: z.number().positive(),
    bannedHashtagsMax: z.number().positive(),
    requiredHashtagsMax: z.number().positive(),
  }),
  platformLimits: z.record(z.number().positive()),
});

type Config = z.infer<typeof ConfigSchema>;

/**
 * Validates the entire config on app startup
 * Throws if any values are invalid
 */
export function validateConfig(): Config {
  const config = {
    rateLimits: RATE_LIMITS,
    apiRetry: API_RETRY_CONFIG,
    generation: GENERATION_CONFIG,
    validationLimits: VALIDATION_LIMITS,
    platformLimits: PLATFORM_LIMITS,
  };

  const result = ConfigSchema.safeParse(config);
  if (!result.success) {
    console.error("Config validation failed:", result.error);
    throw new Error(
      `Invalid configuration: ${result.error.message}`
    );
  }

  return result.data;
}

/**
 * Helper: Get platform character limit
 */
export function getPlatformLimit(platform: string): number {
  return (
    PLATFORM_LIMITS[platform as keyof typeof PLATFORM_LIMITS] ||
    PLATFORM_LIMITS.linkedin
  );
}

/**
 * Helper: Get length guide for a size
 */
export function getLengthGuide(
  size: keyof typeof LENGTH_GUIDES
): (typeof LENGTH_GUIDES)[keyof typeof LENGTH_GUIDES] {
  return LENGTH_GUIDES[size] || LENGTH_GUIDES.medium;
}

/**
 * Helper: Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature];
}

export default {
  RATE_LIMITS,
  API_RETRY_CONFIG,
  GENERATION_CONFIG,
  VALIDATION_LIMITS,
  PLATFORM_LIMITS,
  LENGTH_GUIDES,
  STRUCTURE_TEMPLATES,
  REACT_QUERY_CONFIG,
  DRAFT_CONFIG,
  BACKGROUND_JOB_CONFIG,
  SCHEDULING_CONFIG,
  FEATURES,
  validateConfig,
  getPlatformLimit,
  getLengthGuide,
  isFeatureEnabled,
};
