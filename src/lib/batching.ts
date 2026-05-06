/**
 * Request Batching Utility
 *
 * Batches independent Supabase queries and executes them in parallel.
 * Reduces total API calls and improves response time through parallelization.
 *
 * Usage Examples:
 *
 * // Basic parallel fetching
 * const [calendars, posts, templates] = await batchFetch([
 *   () => supabase.from('calendars').select('*').eq('user_id', userId),
 *   () => supabase.from('scheduled_posts').select('*').eq('calendar_id', calId),
 *   () => supabase.from('templates').select('*').eq('user_id', userId),
 * ]);
 *
 * // With error handling
 * const results = await batchFetch(
 *   [query1, query2, query3],
 *   { continueOnError: true }
 * );
 *
 * // With retry and timeout
 * const results = await batchFetch(queries, {
 *   retries: 2,
 *   timeout: 5000,
 * });
 *
 * Performance:
 * - Sequential: 3 queries × 100ms = 300ms total
 * - Batch: max(100ms, 100ms, 100ms) = 100ms total (3x faster)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface BatchFetchOptions {
  /**
   * Continue fetching other queries if one fails
   * @default false
   */
  continueOnError?: boolean;

  /**
   * Number of retries for failed queries
   * @default 1
   */
  retries?: number;

  /**
   * Timeout per query in milliseconds
   * @default 30000
   */
  timeout?: number;

  /**
   * Enable detailed logging for debugging
   * @default false
   */
  verbose?: boolean;
}

export interface BatchFetchResult<T = any> {
  data: T | null;
  error: Error | null;
  duration: number;
}

// ============================================================================
// BATCH FETCH SERVICE
// ============================================================================

class BatchFetchService {
  /**
   * Execute multiple queries in parallel
   */
  async batchFetch<T extends any[]>(
    queries: Array<() => Promise<any>>,
    options: BatchFetchOptions = {}
  ): Promise<T> {
    const {
      continueOnError = false,
      retries = 1,
      timeout = 30000,
      verbose = false,
    } = options;

    if (queries.length === 0) {
      return [] as unknown as T;
    }

    const results: BatchFetchResult[] = [];
    const promises = queries.map((query, index) =>
      this.executeWithRetry(query, {
        index,
        retries,
        timeout,
        verbose,
        continueOnError,
      })
    );

    const settledResults = await Promise.allSettled(promises);

    settledResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results[index] = result.value;
      } else {
        results[index] = {
          data: null,
          error: result.reason,
          duration: 0,
        };
      }
    });

    if (!continueOnError) {
      const error = results.find(r => r.error);
      if (error) {
        throw error.error;
      }
    }

    return results.map(r => r.data) as unknown as T;
  }

  /**
   * Execute a single query with retry logic
   */
  private async executeWithRetry(
    query: () => Promise<any>,
    options: {
      index: number;
      retries: number;
      timeout: number;
      verbose: boolean;
      continueOnError: boolean;
    }
  ): Promise<BatchFetchResult> {
    let lastError: Error | null = null;
    let duration = 0;

    for (let attempt = 0; attempt <= options.retries; attempt++) {
      try {
        const startTime = performance.now();

        const result = await this.withTimeout(
          query(),
          options.timeout,
          `Query ${options.index} timed out after ${options.timeout}ms`
        );

        duration = performance.now() - startTime;

        if (options.verbose) {
          console.log(`✓ Query ${options.index} completed in ${duration.toFixed(0)}ms`);
        }

        return {
          data: result.data || result,
          error: null,
          duration,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (options.verbose) {
          console.warn(
            `⚠ Query ${options.index} failed (attempt ${attempt + 1}/${options.retries + 1}):`,
            lastError.message
          );
        }

        // Don't retry if it's a timeout
        if (lastError.message.includes('timed out') && attempt < options.retries) {
          continue;
        }

        if (attempt < options.retries) {
          // Exponential backoff: 100ms, 200ms, 400ms, etc.
          const backoff = 100 * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, backoff));
        }
      }
    }

    return {
      data: null,
      error: lastError || new Error('Unknown error'),
      duration,
    };
  }

  /**
   * Execute a promise with timeout
   */
  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(timeoutMessage)),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Batch fetch with automatic error details extraction
   */
  async batchFetchTyped<T extends any[]>(
    queries: Array<() => Promise<{ data: any; error: any }>>,
    options: BatchFetchOptions = {}
  ): Promise<T> {
    const wrappedQueries = queries.map(query => async () => {
      const result = await query();
      if (result.error) {
        throw new Error(result.error.message || String(result.error));
      }
      return result.data;
    });

    return this.batchFetch(wrappedQueries, options);
  }
}

export const batchFetchService = new BatchFetchService();

/**
 * Convenience function for batch fetching
 */
export async function batchFetch<T extends any[]>(
  queries: Array<() => Promise<any>>,
  options?: BatchFetchOptions
): Promise<T> {
  return batchFetchService.batchFetch(queries, options);
}

/**
 * Convenience function for batch fetching Supabase queries with type safety
 */
export async function batchFetchTyped<T extends any[]>(
  queries: Array<() => Promise<{ data: any; error: any }>>,
  options?: BatchFetchOptions
): Promise<T> {
  return batchFetchService.batchFetchTyped(queries, options);
}

// ============================================================================
// COMMON QUERY PATTERNS
// ============================================================================

/**
 * Batch fetch calendars, posts, and templates for a user
 */
export async function fetchUserCalendarBundle(userId: string) {
  try {
    const [calendars, templates, recentActivity] = await batchFetchTyped([
      () => supabase
        .from('calendars')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),

      () => supabase
        .from('templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),

      () => supabase
        .from('scheduled_posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    return { calendars, templates, recentActivity };
  } catch (error) {
    console.error('Failed to fetch user calendar bundle:', error);
    throw error;
  }
}

/**
 * Batch fetch calendar details including posts and metadata
 */
export async function fetchCalendarBundle(calendarId: string) {
  try {
    const [calendar, scheduledPosts, analytics] = await batchFetchTyped([
      () => supabase
        .from('calendars')
        .select('*')
        .eq('id', calendarId)
        .single(),

      () => supabase
        .from('scheduled_posts')
        .select('*')
        .eq('calendar_id', calendarId)
        .order('scheduled_at', { ascending: true }),

      () => supabase
        .from('post_analytics')
        .select('*')
        .eq('calendar_id', calendarId),
    ]);

    return { calendar, scheduledPosts, analytics };
  } catch (error) {
    console.error('Failed to fetch calendar bundle:', error);
    throw error;
  }
}

/**
 * Batch fetch user profile data
 */
export async function fetchUserProfileBundle(userId: string) {
  try {
    const [profile, preferences, integrations, billing] = await batchFetchTyped([
      () => supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single(),

      () => supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single(),

      () => supabase
        .from('platform_integrations')
        .select('*')
        .eq('user_id', userId),

      () => supabase
        .from('billing_info')
        .select('*')
        .eq('user_id', userId)
        .single(),
    ]);

    return { profile, preferences, integrations, billing };
  } catch (error) {
    console.error('Failed to fetch user profile bundle:', error);
    throw error;
  }
}

/**
 * Batch fetch shared templates and recommended templates
 */
export async function fetchTemplateBundle(userId?: string) {
  try {
    const baseQueries = [
      () => supabase
        .from('templates')
        .select('*')
        .eq('is_shared', true)
        .order('created_at', { ascending: false })
        .limit(20),

      () => supabase
        .from('template_categories')
        .select('*'),
    ];

    // Add user templates if userId provided
    if (userId) {
      baseQueries.push(() =>
        supabase
          .from('templates')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      );
    }

    const results = await batchFetchTyped(baseQueries as any);

    return userId
      ? { sharedTemplates: results[0], categories: results[1], userTemplates: results[2] }
      : { sharedTemplates: results[0], categories: results[1] };
  } catch (error) {
    console.error('Failed to fetch template bundle:', error);
    throw error;
  }
}

// ============================================================================
// PERFORMANCE HELPERS
// ============================================================================

/**
 * Measure the performance of batch vs sequential queries
 */
export async function compareBatchVsSequential(
  queries: Array<() => Promise<any>>,
  options?: BatchFetchOptions
) {
  // Batch execution
  const batchStart = performance.now();
  const batchResults = await batchFetch(queries, options);
  const batchDuration = performance.now() - batchStart;

  // Sequential execution
  const sequentialStart = performance.now();
  const sequentialResults = [];
  for (const query of queries) {
    sequentialResults.push(await query());
  }
  const sequentialDuration = performance.now() - sequentialStart;

  const improvement = Math.round(
    ((sequentialDuration - batchDuration) / sequentialDuration) * 100
  );

  return {
    batch: {
      duration: Math.round(batchDuration),
      results: batchResults,
    },
    sequential: {
      duration: Math.round(sequentialDuration),
      results: sequentialResults,
    },
    improvement: `${improvement}% faster`,
  };
}
