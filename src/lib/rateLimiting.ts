/**
 * Hybrid Rate Limiting Service
 *
 * Provides fast in-memory rate limiting with persistence to database for
 * cross-invocation tracking. Implements token bucket algorithm for fair
 * rate limiting across endpoints.
 *
 * Usage:
 * ```typescript
 * import { rateLimiter } from '@/lib/rateLimiting';
 *
 * // Check if request is allowed
 * const allowed = await rateLimiter.checkLimit(
 *   'calendar-generation',
 *   userId,
 *   { tokensPerMinute: 10 }
 * );
 *
 * if (!allowed) {
 *   throw new Error('Rate limit exceeded');
 * }
 * ```
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Rate limit configuration for an endpoint.
 */
export interface RateLimitConfig {
  tokensPerMinute: number;
  tokensPerHour?: number;
  burstSize?: number; // Allow up to this many tokens at once
}

/**
 * Rate limit status.
 */
export interface RateLimitStatus {
  allowed: boolean;
  tokensRemaining: number;
  resetAt: Date;
  retryAfter?: number; // Seconds until next request is allowed
}

/**
 * In-memory rate limit state.
 */
interface TokenBucket {
  tokens: number;
  lastRefillAt: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONFIG: RateLimitConfig = {
  tokensPerMinute: 10,
  tokensPerHour: 1000,
  burstSize: 20,
};

const CLEANUP_INTERVAL = 60000; // 1 minute
const TOKEN_REFILL_INTERVAL = 1000; // 1 second

// ============================================================================
// RATE LIMITER SERVICE
// ============================================================================

class RateLimitingService {
  // In-memory KV store for fast lookups
  private memoryStore: Map<string, TokenBucket> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Check if a request is allowed under rate limits.
   * Uses fast in-memory check with fallback to database.
   *
   * @param endpoint Endpoint identifier (e.g., 'calendar-generation')
   * @param userId User making the request
   * @param config Rate limit configuration
   * @returns Rate limit status
   *
   * @example
   * ```typescript
   * const status = await rateLimiter.checkLimit(
   *   'calendar-generation',
   *   userId,
   *   { tokensPerMinute: 10 }
   * );
   *
   * if (!status.allowed) {
   *   console.log(`Try again in ${status.retryAfter} seconds`);
   * }
   * ```
   */
  async checkLimit(
    endpoint: string,
    userId: string,
    config: RateLimitConfig = DEFAULT_CONFIG
  ): Promise<RateLimitStatus> {
    const key = `${endpoint}:${userId}`;
    const config_ = { ...DEFAULT_CONFIG, ...config };

    // Step 1: Fast in-memory check
    const inMemory = this.checkMemoryBucket(key, config_);
    if (inMemory) {
      return this.buildStatus(key, true, config_);
    }

    // Step 2: Fallback to database check (cross-invocation tracking)
    try {
      const allowed = await this.checkDatabaseLimit(key, config_);
      return this.buildStatus(key, allowed, config_);
    } catch (err) {
      // If database fails, fall back to memory state (fail open)
      console.error('Rate limit DB check failed, using memory state:', err);
      return this.buildStatus(key, true, config_);
    }
  }

  /**
   * Record a rate-limited event in the database for cross-invocation tracking.
   * Called after checkLimit() returns allowed = true.
   *
   * @param endpoint Endpoint identifier
   * @param userId User making the request
   * @param success Whether the request succeeded
   * @param durationMs Duration of the request in milliseconds
   */
  async recordUsage(
    endpoint: string,
    userId: string,
    success: boolean,
    durationMs: number
  ): Promise<void> {
    try {
      const key = `${endpoint}:${userId}`;

      await supabase.from('rate_limit_counters').insert({
        key,
        endpoint,
        user_id: userId,
        used_at: new Date().toISOString(),
        request_duration_ms: durationMs,
        success,
      });
    } catch (err) {
      // Non-blocking error
      console.warn('Failed to record rate limit usage:', err);
    }
  }

  /**
   * Reset rate limit for a specific user/endpoint.
   * Useful for cleanup or manual overrides.
   *
   * @param endpoint Endpoint identifier
   * @param userId User ID
   */
  async resetLimit(endpoint: string, userId: string): Promise<void> {
    const key = `${endpoint}:${userId}`;

    // Clear memory
    this.memoryStore.delete(key);

    // Clear database
    try {
      await supabase
        .from('rate_limit_counters')
        .delete()
        .eq('key', key);
    } catch (err) {
      console.warn('Failed to reset rate limit in database:', err);
    }
  }

  /**
   * Get rate limit statistics for monitoring.
   *
   * @param endpoint Optional: filter by endpoint
   * @returns Stats object
   */
  async getStats(endpoint?: string): Promise<{
    totalEndpoints: number;
    activeUsers: number;
    memorySize: number;
  }> {
    const stats = {
      totalEndpoints: new Set(Array.from(this.memoryStore.keys()).map((k) => k.split(':')[0]))
        .size,
      activeUsers: this.memoryStore.size,
      memorySize: this.memoryStore.size * 100, // Rough estimate in bytes
    };

    return stats;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Check in-memory token bucket for rate limit.
   * @private
   */
  private checkMemoryBucket(
    key: string,
    config: Required<RateLimitConfig>
  ): boolean {
    const now = Date.now();
    let bucket = this.memoryStore.get(key);

    // Initialize bucket if not exists
    if (!bucket) {
      bucket = {
        tokens: config.burstSize,
        lastRefillAt: now,
      };
      this.memoryStore.set(key, bucket);
      return true; // First request always allowed
    }

    // Refill tokens based on time elapsed
    const timeSinceRefill = (now - bucket.lastRefillAt) / 1000; // seconds
    const tokensToAdd = timeSinceRefill * (config.tokensPerMinute / 60);

    bucket.tokens = Math.min(config.burstSize, bucket.tokens + tokensToAdd);
    bucket.lastRefillAt = now;

    // Check if request is allowed
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Check database for rate limit (cross-invocation persistence).
   * @private
   */
  private async checkDatabaseLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<boolean> {
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    // Count requests in last minute
    const { count: minuteCount } = await supabase
      .from('rate_limit_counters')
      .select('*', { count: 'exact' })
      .eq('key', key)
      .gt('used_at', oneMinuteAgo);

    if (minuteCount !== null && minuteCount >= config.tokensPerMinute) {
      return false;
    }

    // Count requests in last hour (if configured)
    if (config.tokensPerHour) {
      const { count: hourCount } = await supabase
        .from('rate_limit_counters')
        .select('*', { count: 'exact' })
        .eq('key', key)
        .gt('used_at', oneHourAgo);

      if (hourCount !== null && hourCount >= config.tokensPerHour) {
        return false;
      }
    }

    return true;
  }

  /**
   * Build rate limit status object.
   * @private
   */
  private buildStatus(
    key: string,
    allowed: boolean,
    config: Required<RateLimitConfig>
  ): RateLimitStatus {
    const bucket = this.memoryStore.get(key);
    const tokensRemaining = bucket?.tokens ?? config.burstSize;
    const resetAt = new Date(Date.now() + 60000); // 1 minute from now

    return {
      allowed,
      tokensRemaining,
      resetAt,
      retryAfter: allowed ? undefined : 60, // Wait full minute if denied
    };
  }

  /**
   * Start periodic cleanup of expired entries.
   * @private
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupMemoryStore();
    }, CLEANUP_INTERVAL);
  }

  /**
   * Remove stale entries from memory store.
   * Entries are removed if they haven't been used in 10 minutes.
   * @private
   */
  private cleanupMemoryStore(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes

    for (const [key, bucket] of this.memoryStore.entries()) {
      if (now - bucket.lastRefillAt > maxAge) {
        this.memoryStore.delete(key);
      }
    }
  }

  /**
   * Clean up timers on service destruction.
   * @private
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global singleton instance of the rate limiting service.
 *
 * Usage:
 * ```typescript
 * import { rateLimiter, RATE_LIMIT_PRESETS } from '@/lib/rateLimiting';
 *
 * const status = await rateLimiter.checkLimit(
 *   'calendar-generation',
 *   userId,
 *   RATE_LIMIT_PRESETS.generous
 * );
 * ```
 */
export const rateLimiter = new RateLimitingService();

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Preset rate limit configurations for common endpoints.
 * Can be customized or extended as needed.
 */
export const RATE_LIMIT_PRESETS = {
  /**
   * Generous limits for free tier.
   */
  generous: {
    tokensPerMinute: 5,
    tokensPerHour: 50,
    burstSize: 10,
  } as const,

  /**
   * Standard limits for paid users.
   */
  standard: {
    tokensPerMinute: 20,
    tokensPerHour: 500,
    burstSize: 30,
  } as const,

  /**
   * Premium limits for power users.
   */
  premium: {
    tokensPerMinute: 60,
    tokensPerHour: 5000,
    burstSize: 100,
  } as const,

  /**
   * Enterprise limits for dedicated accounts.
   */
  enterprise: {
    tokensPerMinute: 200,
    tokensPerHour: 50000,
    burstSize: 500,
  } as const,

  /**
   * Strict limits for suspicious activity.
   */
  strict: {
    tokensPerMinute: 1,
    tokensPerHour: 10,
    burstSize: 2,
  } as const,
} as const;

// ============================================================================
// ENDPOINT-SPECIFIC LIMITS
// ============================================================================

/**
 * Recommended rate limits per endpoint, based on resource usage.
 * Can be overridden on a per-user basis.
 */
export const ENDPOINT_LIMITS: Record<string, RateLimitConfig> = {
  'calendar-generation': {
    tokensPerMinute: 10, // Most expensive
    tokensPerHour: 100,
    burstSize: 15,
  },
  'single-post-generation': {
    tokensPerMinute: 20, // Medium expense
    tokensPerHour: 500,
    burstSize: 30,
  },
  'regenerate-post': {
    tokensPerMinute: 30, // Cheaper, often used for tweaks
    tokensPerHour: 1000,
    burstSize: 50,
  },
  'list-calendars': {
    tokensPerMinute: 60, // Cheap read
    tokensPerHour: 10000,
    burstSize: 100,
  },
  'get-calendar': {
    tokensPerMinute: 60,
    tokensPerHour: 10000,
    burstSize: 100,
  },
};
