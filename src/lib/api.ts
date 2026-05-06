/**
 * API Utility with Retry Logic, Deduplication, and Timeout Handling
 */

import {
  NetworkError,
  ValidationError,
  TimeoutError,
  RateLimitError,
  APIError,
  AppError,
} from './errors';
import { logger, createScopedLogger } from './logger';

const log = createScopedLogger('APIClient');

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface RequestConfig extends RequestInit {
  timeout?: number;
  retryConfig?: Partial<RetryConfig>;
  skipRetry?: boolean;
  cacheTtl?: number; // TTL in milliseconds for caching GET responses
  skipCache?: boolean; // Skip caching for this request
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

// Request deduplication cache
interface PendingRequest {
  promise: Promise<Response>;
  abort: AbortController;
}

const pendingRequests = new Map<string, PendingRequest>();

// Response cache with TTL
interface CacheEntry {
  response: Response;
  timestamp: number;
  ttlMs: number;
}

const responseCache = new Map<string, CacheEntry>();

/**
 * Generate cache key for request deduplication
 */
function getCacheKey(url: string, method: string, body?: string): string {
  return `${method}:${url}:${body || ''}`;
}

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Get cached response if still valid
 */
function getCachedResponse(cacheKey: string): Response | null {
  const entry = responseCache.get(cacheKey);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > entry.ttlMs) {
    responseCache.delete(cacheKey);
    return null;
  }

  return entry.response.clone();
}

/**
 * Cache response with TTL
 */
function setCachedResponse(cacheKey: string, response: Response, ttlMs: number): void {
  const entry: CacheEntry = {
    response: response.clone(),
    timestamp: Date.now(),
    ttlMs,
  };
  responseCache.set(cacheKey, entry);

  // Auto-cleanup expired entries (simple implementation)
  setTimeout(() => {
    const currentEntry = responseCache.get(cacheKey);
    if (currentEntry && Date.now() - currentEntry.timestamp > ttlMs) {
      responseCache.delete(cacheKey);
    }
  }, ttlMs);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError) return true;
  if (error instanceof TimeoutError) return true;
  if (error instanceof NetworkError) return error.isRetryable;
  if (error instanceof APIError) return error.isRetryable;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('network') || msg.includes('timeout') || msg.includes('fetch');
  }
  return false;
}

/**
 * Parse error response from API
 */
async function parseErrorResponse(response: Response): Promise<AppError> {
  const statusCode = response.status;

  try {
    const data = await response.json();
    const errorMessage = data?.error || data?.message || response.statusText;

    if (statusCode === 429) {
      const retryAfter = response.headers.get('retry-after');
      return new RateLimitError(errorMessage, retryAfter ? parseInt(retryAfter) * 1000 : undefined);
    }

    if (statusCode === 401) {
      return new NetworkError(errorMessage, false);
    }

    return new APIError(errorMessage, statusCode);
  } catch {
    // If JSON parsing fails, create a generic error
    if (statusCode === 429) {
      return new RateLimitError();
    }
    if (statusCode === 401) {
      return new NetworkError('Authentication failed', false);
    }
    return new APIError(response.statusText, statusCode);
  }
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  config: RequestConfig,
  timeoutMs: number
): Promise<Response> {
  const controller = config.signal instanceof AbortController ? config.signal : new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort('timeout');
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...config,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Check if it's a timeout
    if (error instanceof DOMException && error.name === 'AbortError') {
      const reason = (controller.signal as AbortSignal & { reason?: string }).reason;
      if (reason === 'timeout') {
        throw new TimeoutError(`Request timed out after ${timeoutMs}ms`, timeoutMs);
      }
      throw new NetworkError('Request was cancelled');
    }

    // Network error
    if (error instanceof TypeError) {
      throw new NetworkError(`Network error: ${(error as Error).message}`);
    }

    throw error;
  }
}

/**
 * Core fetch function with retry logic and request deduplication
 */
async function fetchWithRetry(
  url: string,
  config: RequestConfig,
  attempt: number = 0
): Promise<Response> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig };
  const timeoutMs = config.timeout || 30000;
  const cacheKey = getCacheKey(url, config.method || 'GET', config.body as string);

  // Check for duplicate in-flight request
  if (attempt === 0 && (config.method === 'GET' || !config.method)) {
    const pending = pendingRequests.get(cacheKey);
    if (pending) {
      log.debug(`Using cached request for ${cacheKey}`);
      return pending.promise;
    }
  }

  // Create abort controller if not provided
  if (!config.signal) {
    config.signal = new AbortController();
  }

  // Check cache first for GET requests
  if (attempt === 0 && (config.method === 'GET' || !config.method) && !config.skipCache) {
    const cachedResponse = getCachedResponse(cacheKey);
    if (cachedResponse) {
      log.debug(`Using cached response for ${cacheKey}`);
      return cachedResponse;
    }
  }

  try {
    // Fetch with timeout
    const response = await fetchWithTimeout(url, config, timeoutMs);

    // Store response in dedup cache if successful GET
    if (attempt === 0 && response.ok && (config.method === 'GET' || !config.method)) {
      const clonedResponse = response.clone();
      const controller = config.signal as AbortController;
      pendingRequests.set(cacheKey, { promise: Promise.resolve(clonedResponse), abort: controller });

      // Clear from cache after 5 seconds
      setTimeout(() => pendingRequests.delete(cacheKey), 5000);
    }

    // Handle error status codes
    if (!response.ok) {
      const error = await parseErrorResponse(response);
      throw error;
    }

    // Cache successful GET responses
    if ((config.method === 'GET' || !config.method) && !config.skipCache) {
      const cacheTtl = config.cacheTtl || 5 * 60 * 1000; // Default 5 minutes
      setCachedResponse(cacheKey, response, cacheTtl);
    }

    return response;
  } catch (error) {
    // Log the attempt
    if (attempt === 0) {
      log.debug(`API call attempt 1: ${config.method || 'GET'} ${url}`);
    }

    // Check if we should retry
    if (attempt < retryConfig.maxRetries && isRetryableError(error) && !config.skipRetry) {
      const delay = calculateDelay(attempt, retryConfig);

      if (error instanceof RateLimitError) {
        const retryAfter = error.getRetryAfter();
        log.warn(`Rate limited. Retrying after ${retryAfter}ms`, error, { url, attempt });
        await sleep(retryAfter);
      } else {
        log.warn(`Retryable error, waiting ${delay}ms before retry ${attempt + 2}`, error, {
          url,
          attempt: attempt + 1,
        });
        await sleep(delay);
      }

      // Recursive retry
      return fetchWithRetry(url, config, attempt + 1);
    }

    // No more retries, log and throw
    log.error(`API call failed after ${attempt + 1} attempt(s): ${config.method || 'GET'} ${url}`, error, {
      url,
      method: config.method,
      totalAttempts: attempt + 1,
    });

    throw error;
  }
}

/**
 * Public API client
 */
export const ApiClient = {
  /**
   * GET request
   */
  async get<T>(url: string, config?: RequestConfig): Promise<T> {
    const response = await fetchWithRetry(url, { ...config, method: 'GET' });
    return response.json();
  },

  /**
   * POST request
   */
  async post<T>(url: string, body: unknown, config?: RequestConfig): Promise<T> {
    const response = await fetchWithRetry(url, {
      ...config,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...config?.headers },
      body: JSON.stringify(body),
    });
    return response.json();
  },

  /**
   * PATCH request
   */
  async patch<T>(url: string, body: unknown, config?: RequestConfig): Promise<T> {
    const response = await fetchWithRetry(url, {
      ...config,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...config?.headers },
      body: JSON.stringify(body),
    });
    return response.json();
  },

  /**
   * DELETE request
   */
  async delete<T>(url: string, config?: RequestConfig): Promise<T> {
    const response = await fetchWithRetry(url, {
      ...config,
      method: 'DELETE',
    });
    return response.json();
  },

  /**
   * Raw fetch (for custom needs)
   */
  async fetch(url: string, config: RequestConfig = {}): Promise<Response> {
    return fetchWithRetry(url, config);
  },

  /**
   * Cancel pending requests matching pattern
   */
  cancelPending(urlPattern?: string): number {
    let cancelled = 0;
    for (const [key, { abort }] of pendingRequests.entries()) {
      if (!urlPattern || key.includes(urlPattern)) {
        abort.abort();
        pendingRequests.delete(key);
        cancelled++;
      }
    }
    return cancelled;
  },

  /**
   * Get pending requests
   */
  getPending(): string[] {
    return Array.from(pendingRequests.keys());
  },

  /**
   * Clear dedup cache
   */
  clearCache(): void {
    pendingRequests.clear();
  },

  /**
   * Clear response cache
   */
  clearResponseCache(): void {
    responseCache.clear();
  },

  /**
   * Get cache statistics
   */
  getCacheStats() {
    let validEntries = 0;
    let expiredEntries = 0;
    const now = Date.now();

    for (const entry of responseCache.values()) {
      if (now - entry.timestamp > entry.ttlMs) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      pendingRequests: pendingRequests.size,
      cachedResponses: validEntries,
      expiredResponses: expiredEntries,
      totalCacheSize: responseCache.size,
    };
  },
};
