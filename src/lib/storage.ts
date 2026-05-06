/**
 * StorageService - Abstraction layer for localStorage with validation and versioning
 */

import { logger, createScopedLogger } from './logger';
import { StorageError } from './errors';

const log = createScopedLogger('StorageService');

export interface StorageOptions {
  version?: number;
  ttlMs?: number; // Time to live in milliseconds
}

interface StorageData<T> {
  version: number;
  data: T;
  timestamp: number;
  ttlMs?: number;
}

/**
 * StorageService provides a safe interface to localStorage with:
 * - Data validation
 * - Versioning
 * - TTL (time to live)
 * - Automatic cleanup
 */
export const StorageService = {
  /**
   * Set value in localStorage with optional versioning and TTL
   */
  set<T>(key: string, value: T, options: StorageOptions = {}): void {
    try {
      const { version = 1, ttlMs } = options;

      const payload: StorageData<T> = {
        version,
        data: value,
        timestamp: Date.now(),
        ttlMs,
      };

      localStorage.setItem(key, JSON.stringify(payload));
      log.debug(`Stored ${key} (v${version})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.includes('QuotaExceededError')) {
        log.warn(`localStorage quota exceeded`, error, { key });
        // Try to cleanup old items
        StorageService.cleanup();
        // Try again
        try {
          const payload: StorageData<T> = {
            version: options.version || 1,
            data: value,
            timestamp: Date.now(),
            ttlMs: options.ttlMs,
          };
          localStorage.setItem(key, JSON.stringify(payload));
        } catch (retryError) {
          throw new StorageError(
            'Failed to store data even after cleanup',
            'STORAGE_QUOTA_EXCEEDED',
            { key, originalError: message }
          );
        }
      } else {
        throw new StorageError(`Failed to store ${key}`, 'STORAGE_SET_ERROR', {
          error: message,
        });
      }
    }
  },

  /**
   * Get value from localStorage with automatic validation and TTL check
   */
  get<T>(key: string, validator?: (value: unknown) => boolean): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        log.debug(`No data found for ${key}`);
        return null;
      }

      const payload: StorageData<T> = JSON.parse(raw);

      // Check TTL
      if (payload.ttlMs) {
        const age = Date.now() - payload.timestamp;
        if (age > payload.ttlMs) {
          log.debug(`${key} expired (age: ${age}ms, ttl: ${payload.ttlMs}ms)`);
          localStorage.removeItem(key);
          return null;
        }
      }

      // Validate data if validator provided
      if (validator && !validator(payload.data)) {
        log.warn(`Validation failed for ${key}`, undefined, { key });
        localStorage.removeItem(key);
        return null;
      }

      log.debug(`Retrieved ${key} (v${payload.version})`);
      return payload.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.warn(`Failed to retrieve ${key}`, error, { key });
      // On corruption, remove the item
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore removal errors
      }
      return null;
    }
  },

  /**
   * Remove value from localStorage
   */
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
      log.debug(`Removed ${key}`);
    } catch (error) {
      log.warn(`Failed to remove ${key}`, error, { key });
    }
  },

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    try {
      return localStorage.getItem(key) !== null;
    } catch {
      return false;
    }
  },

  /**
   * Get all keys
   */
  keys(): string[] {
    try {
      return Object.keys(localStorage);
    } catch {
      return [];
    }
  },

  /**
   * Get storage size in bytes
   */
  getSize(): number {
    try {
      let size = 0;
      for (let key of StorageService.keys()) {
        const item = localStorage.getItem(key);
        if (item) {
          size += item.length + key.length;
        }
      }
      return size;
    } catch {
      return 0;
    }
  },

  /**
   * Clear all localStorage (use with caution)
   */
  clearAll(): void {
    try {
      localStorage.clear();
      log.info('Cleared all localStorage');
    } catch (error) {
      log.warn('Failed to clear localStorage', error);
    }
  },

  /**
   * Cleanup expired items
   */
  cleanup(olderThanDays: number = 30): void {
    try {
      let removedCount = 0;
      const now = Date.now();
      const cutoffTime = now - olderThanDays * 24 * 60 * 60 * 1000;

      for (const key of StorageService.keys()) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;

          const payload = JSON.parse(raw) as StorageData<unknown>;

          // Remove if:
          // 1. Older than cutoff time
          // 2. Expired based on TTL
          const isOldEntry = payload.timestamp < cutoffTime;
          const isExpired = payload.ttlMs && now - payload.timestamp > payload.ttlMs;

          if (isOldEntry || isExpired) {
            localStorage.removeItem(key);
            removedCount++;
          }
        } catch {
          // Skip items that can't be parsed
        }
      }

      if (removedCount > 0) {
        log.debug(`Cleaned up ${removedCount} expired items`);
      }
    } catch (error) {
      log.warn('Error during cleanup', error);
    }
  },

  /**
   * Get statistics about storage usage
   */
  getStats() {
    try {
      const keys = StorageService.keys();
      let totalSize = StorageService.getSize();
      let expiredCount = 0;
      let validCount = 0;

      const now = Date.now();

      for (const key of keys) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;

          const payload = JSON.parse(raw) as StorageData<unknown>;
          const isExpired = payload.ttlMs && now - payload.timestamp > payload.ttlMs;

          if (isExpired) {
            expiredCount++;
          } else {
            validCount++;
          }
        } catch {
          // Skip unparseable items
        }
      }

      return {
        totalItems: keys.length,
        validItems: validCount,
        expiredItems: expiredCount,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      };
    } catch (error) {
      log.warn('Error getting storage stats', error);
      return {
        totalItems: 0,
        validItems: 0,
        expiredItems: 0,
        totalSizeBytes: 0,
        totalSizeMB: '0',
      };
    }
  },
};

/**
 * Auto-cleanup on app start (every 24 hours)
 */
export function initStorageCleanup() {
  const lastCleanup = localStorage.getItem('_lastStorageCleanup');
  const now = Date.now();

  if (!lastCleanup || now - parseInt(lastCleanup) > 24 * 60 * 60 * 1000) {
    StorageService.cleanup(30);
    localStorage.setItem('_lastStorageCleanup', String(now));
  }
}

// Initialize cleanup on import
if (typeof window !== 'undefined') {
  initStorageCleanup();
}
