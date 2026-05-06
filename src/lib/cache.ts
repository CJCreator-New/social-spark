/**
 * Query Result Caching Service
 *
 * Provides TTL-based caching for frequently accessed queries.
 * Supports multiple cache backends (memory, localStorage, Redis-ready).
 *
 * Usage:
 * ```typescript
 * import { queryCache, CACHE_KEYS } from '@/lib/cache';
 *
 * // Get with automatic cache check
 * const calendars = await queryCache.getOrFetch(
 *   CACHE_KEYS.USER_CALENDARS(userId),
 *   () => fetchCalendarsFromDB(userId),
 *   { ttlSeconds: 300 } // 5 minute TTL
 * );
 *
 * // Invalidate on mutation
 * await queryCache.invalidate(CACHE_KEYS.USER_CALENDARS(userId));
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Cache options for storing and retrieving data.
 */
export interface CacheOptions {
  ttlSeconds: number; // Time to live in seconds
  backend?: 'memory' | 'localStorage' | 'both'; // Default: 'both'
}

/**
 * Cached value with metadata.
 */
interface CachedEntry<T> {
  value: T;
  expiresAt: number; // Timestamp when entry expires
  createdAt: number;
}

// ============================================================================
// CACHE KEYS (Constants for consistency)
// ============================================================================

/**
 * Cache key builders to ensure consistency and discoverability.
 * Prevents typos and makes cache keys trackable.
 *
 * Usage:
 * ```typescript
 * const key = CACHE_KEYS.USER_CALENDARS(userId);
 * await queryCache.get(key);
 * ```
 */
export const CACHE_KEYS = {
  /**
   * User's calendar list (paginated).
   */
  USER_CALENDARS: (userId: string, page = 1) => `user:${userId}:calendars:page:${page}`,

  /**
   * Single calendar with all posts.
   */
  CALENDAR_DETAIL: (calendarId: string) => `calendar:${calendarId}:detail`,

  /**
   * User's scheduled posts for a calendar.
   */
  CALENDAR_SCHEDULED: (calendarId: string) => `calendar:${calendarId}:scheduled`,

  /**
   * User's templates list.
   */
  USER_TEMPLATES: (userId: string, page = 1) => `user:${userId}:templates:page:${page}`,

  /**
   * Single template data.
   */
  TEMPLATE_DETAIL: (templateId: string) => `template:${templateId}:detail`,

  /**
   * Public/shared templates list.
   */
  SHARED_TEMPLATES: (page = 1) => `shared:templates:page:${page}`,

  /**
   * User profile information.
   */
  USER_PROFILE: (userId: string) => `user:${userId}:profile`,

  /**
   * Analytics aggregated data.
   */
  ANALYTICS_SUMMARY: (userId: string, period: 'day' | 'week' | 'month') =>
    `user:${userId}:analytics:${period}`,

  /**
   * Rate limit statistics.
   */
  RATE_LIMIT_STATS: (userId: string) => `user:${userId}:rate_limit_stats`,
} as const;

// ============================================================================
// DEFAULT CACHE CONFIGS
// ============================================================================

/**
 * Default TTL configurations for different data types.
 */
export const DEFAULT_CACHE_TTLS = {
  CALENDAR_LIST: 300, // 5 minutes
  CALENDAR_DETAIL: 600, // 10 minutes
  TEMPLATES: 1800, // 30 minutes
  USER_PROFILE: 3600, // 1 hour
  SHARED_TEMPLATES: 3600, // 1 hour (less frequently updated)
  ANALYTICS: 300, // 5 minutes (trending data)
  RATE_LIMIT_STATS: 60, // 1 minute
} as const;

// ============================================================================
// QUERY CACHE SERVICE
// ============================================================================

class QueryCacheService {
  // In-memory store for fast access
  private memoryStore: Map<string, CachedEntry<any>> = new Map();

  // Track cache hits for monitoring
  private stats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
  };

  /**
   * Get cached value or fetch fresh data if cache miss/expired.
   *
   * @param key Cache key identifier
   * @param fetchFn Async function to fetch fresh data
   * @param options Cache TTL and backend options
   * @returns Cached or fresh data
   *
   * @example
   * ```typescript
   * const calendars = await queryCache.getOrFetch(
   *   CACHE_KEYS.USER_CALENDARS(userId),
   *   () => supabase.from('calendars').select('*'),
   *   { ttlSeconds: 300, backend: 'both' }
   * );
   * ```
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    // Try to get from cache
    const cached = this.get<T>(key);
    if (cached !== null) {
      this.stats.hits++;
      return cached;
    }

    // Cache miss - fetch fresh data
    this.stats.misses++;
    const data = await fetchFn();

    // Store in cache
    await this.set(key, data, options);

    return data;
  }

  /**
   * Get value from cache without fetching.
   *
   * @param key Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): T | null {
    // Try memory first (fastest)
    const entry = this.memoryStore.get(key);

    if (entry) {
      // Check if expired
      if (Date.now() < entry.expiresAt) {
        return entry.value as T;
      }

      // Expired, remove it
      this.memoryStore.delete(key);
    }

    // Try localStorage as fallback (cross-session)
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`cache:${key}`);
        if (stored) {
          const entry: CachedEntry<T> = JSON.parse(stored);

          if (Date.now() < entry.expiresAt) {
            // Valid cache, restore to memory
            this.memoryStore.set(key, entry);
            return entry.value;
          }

          // Expired, clean up
          localStorage.removeItem(`cache:${key}`);
        }
      } catch (err) {
        console.warn('Failed to read from localStorage cache:', err);
      }
    }

    return null;
  }

  /**
   * Set cache value.
   *
   * @param key Cache key
   * @param value Value to cache
   * @param options TTL and backend options
   */
  async set<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    const expiresAt = Date.now() + options.ttlSeconds * 1000;
    const entry: CachedEntry<T> = {
      value,
      expiresAt,
      createdAt: Date.now(),
    };

    // Store in memory
    this.memoryStore.set(key, entry);

    // Optionally store in localStorage for persistence
    if (
      (options.backend === 'both' || options.backend === 'localStorage') &&
      typeof window !== 'undefined'
    ) {
      try {
        localStorage.setItem(`cache:${key}`, JSON.stringify(entry));
      } catch (err) {
        // Fail silently - localStorage may be full or unavailable
        console.warn('Failed to write to localStorage cache:', err);
      }
    }
  }

  /**
   * Invalidate a single cache entry.
   *
   * @param key Cache key to invalidate
   */
  invalidate(key: string): void {
    this.memoryStore.delete(key);

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`cache:${key}`);
      } catch (err) {
        console.warn('Failed to invalidate localStorage cache:', err);
      }
    }

    this.stats.invalidations++;
  }

  /**
   * Invalidate cache entries matching a pattern.
   * Useful for invalidating related entries (e.g., all calendars for a user).
   *
   * @param pattern Pattern to match (prefix match)
   *
   * @example
   * ```typescript
   * // Invalidate all calendars for user when they create a new one
   * await queryCache.invalidatePattern(`user:${userId}:calendars`);
   * ```
   */
  invalidatePattern(pattern: string): void {
    // Memory store
    for (const key of this.memoryStore.keys()) {
      if (key.startsWith(pattern)) {
        this.memoryStore.delete(key);
      }
    }

    // localStorage
    if (typeof window !== 'undefined') {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`cache:${pattern}`)) {
            localStorage.removeItem(key);
          }
        }
      } catch (err) {
        console.warn('Failed to invalidate localStorage pattern:', err);
      }
    }

    this.stats.invalidations++;
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    this.memoryStore.clear();

    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('cache:')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      } catch (err) {
        console.warn('Failed to clear localStorage cache:', err);
      }
    }
  }

  /**
   * Get cache statistics for monitoring.
   *
   * @returns Cache hit/miss stats
   */
  getStats(): {
    hits: number;
    misses: number;
    invalidations: number;
    hitRate: number;
    memoryEntries: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryEntries: this.memoryStore.size,
    };
  }

  /**
   * Reset statistics counters.
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, invalidations: 0 };
  }

  /**
   * Cleanup expired entries.
   * Should be called periodically (e.g., every 5 minutes).
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryStore.entries()) {
      if (now >= entry.expiresAt) {
        this.memoryStore.delete(key);
        cleaned++;
      }
    }

    // localStorage cleanup happens on-demand in get()

    if (cleaned > 0) {
      console.debug(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global singleton cache service instance.
 *
 * Usage:
 * ```typescript
 * import { queryCache, CACHE_KEYS } from '@/lib/cache';
 *
 * // Cache a query result
 * const data = await queryCache.getOrFetch(
 *   CACHE_KEYS.USER_CALENDARS(userId),
 *   fetchCalendars,
 *   { ttlSeconds: 300 }
 * );
 *
 * // Invalidate when data changes
 * queryCache.invalidate(CACHE_KEYS.USER_CALENDARS(userId));
 *
 * // Check stats
 * console.log(queryCache.getStats());
 * ```
 */
export const queryCache = new QueryCacheService();

// Start cleanup interval (every 5 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => {
    queryCache.cleanup();
  }, 5 * 60 * 1000);
}
