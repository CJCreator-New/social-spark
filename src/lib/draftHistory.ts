/**
 * Draft History Service
 *
 * Manages draft version history using IndexedDB for persistent browser storage.
 * Automatically keeps the last 5 versions and provides recovery functionality.
 *
 * Usage:
 * ```typescript
 * import { draftHistoryService } from '@/lib/draftHistory';
 *
 * // Save a new version
 * await draftHistoryService.saveDraft({
 *   industry: 'SaaS',
 *   coreIdea: 'Help startups...',
 *   topics: ['AI', 'Growth'],
 *   // ... other form fields
 * });
 *
 * // Get all versions
 * const versions = await draftHistoryService.getVersions();
 * // [{ id: '...', timestamp: Date, label: 'Version 5', preview: '...' }, ...]
 *
 * // Restore a specific version
 * const draft = await draftHistoryService.restoreVersion(versionId);
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * A saved draft version in IndexedDB.
 * Includes form data, generated posts, and metadata for recovery.
 */
export interface DraftVersion {
  /** Unique ID for this version (UUID) */
  id: string;
  /** When this version was created */
  timestamp: Date;
  /** Human-readable label for the version (e.g., "Version 3") */
  label: string;
  /** Short preview of the draft content (first 100 chars of core idea) */
  preview: string;
  /** Complete form state from useFormState */
  formData: {
    industry: string;
    industryLabel?: string;
    coreIdea: string;
    platform: string;
    voice: string;
    style: string;
    goals: string[];
    topics: string[];
    audiences: string[];
    format: string;
    cta: string;
    length: string;
    structure: string;
    extra: string;
    bannedWords: string[];
    requiredWords: string[];
    bannedHashtags: string[];
    requiredHashtags: string[];
    currentStep: number;
  };
  /** Generated posts (if any) */
  posts: unknown[];
  /** Active day index (for calendar view) */
  activeDay: number;
}

/**
 * Summary of a draft version for display in recovery UI.
 */
export interface DraftVersionSummary {
  id: string;
  timestamp: Date;
  label: string;
  preview: string;
  postCount: number;
  industry: string;
}

// ============================================================================
// INDEXEDDB SERVICE
// ============================================================================

const DB_NAME = "contentforge_drafts";
const STORE_NAME = "draft_versions";
const DB_VERSION = 1;
const MAX_VERSIONS = 5;

/**
 * Draft History Service
 *
 * Provides IndexedDB-backed draft version management.
 * - Auto-cleanup: Keeps only last 5 versions
 * - Type-safe: Full TypeScript support
 * - Error-safe: Graceful fallbacks if IndexedDB unavailable
 */
class DraftHistoryService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB connection.
   * Called automatically on first use, but can be called explicitly.
   *
   * @throws Error if IndexedDB is not available or initialization fails
   */
  async init(): Promise<void> {
    // Return existing init promise if already in progress
    if (this.initPromise) return this.initPromise;

    // Check if IndexedDB is available
    if (!("indexedDB" in window)) {
      throw new Error("IndexedDB is not available in this browser");
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.initPromise = null;
        reject(new Error(`Failed to open IndexedDB: ${request.error}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          // Create index on timestamp for sorting by date
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      };
    });

    await this.initPromise;
  }

  /**
   * Save a new draft version.
   * Automatically cleans up old versions if count exceeds MAX_VERSIONS.
   *
   * @param formData Form state to save
   * @param posts Generated posts (if any)
   * @param activeDay Active day index
   * @throws Error if save fails
   */
  async saveDraft(formData: DraftVersion["formData"], posts: unknown[] = [], activeDay: number = 0): Promise<DraftVersion> {
    await this.init();

    if (!this.db) throw new Error("IndexedDB not initialized");

    const id = this.generateId();
    const timestamp = new Date();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      // Compute the version count INSIDE the same readwrite transaction as the
      // write to avoid a race where two concurrent saves get the same version number.
      const countRequest = store.count();

      countRequest.onerror = () => {
        reject(new Error(`Failed to count versions: ${countRequest.error}`));
      };

      countRequest.onsuccess = () => {
        const versionNumber = countRequest.result + 1;

        const version: DraftVersion = {
          id,
          timestamp,
          label: `Version ${versionNumber}`,
          preview: (formData.coreIdea || "").slice(0, 100),
          formData,
          posts,
          activeDay,
        };

        const addRequest = store.add(version);

        addRequest.onerror = () => {
          reject(new Error(`Failed to save draft: ${addRequest.error}`));
        };

        addRequest.onsuccess = () => {
          resolve(version);
        };
      };

      transaction.oncomplete = () => {
        // Clean up old versions after the write transaction has fully committed.
        void this.cleanupOldVersions();
      };
    });
  }

  /**
   * Get all saved draft versions, ordered by timestamp (newest first).
   *
   * @returns Array of draft version summaries
   * @throws Error if retrieval fails
   */
  async getVersions(): Promise<DraftVersionSummary[]> {
    await this.init();

    if (!this.db) throw new Error("IndexedDB not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index("timestamp");
      const request = index.getAll();

      request.onerror = () => {
        reject(new Error(`Failed to retrieve versions: ${request.error}`));
      };

      request.onsuccess = () => {
        const versions = (request.result as DraftVersion[])
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .map(v => ({
            id: v.id,
            timestamp: v.timestamp,
            label: v.label,
            preview: v.preview,
            postCount: v.posts.length,
            industry: v.formData.industry,
          }));

        resolve(versions);
      };
    });
  }

  /**
   * Get the most recent draft version.
   * Useful for auto-recovery on app load.
   *
   * @returns The latest draft version, or null if no versions exist
   * @throws Error if retrieval fails
   */
  async getLatestVersion(): Promise<DraftVersion | null> {
    const versions = await this.getVersions();
    if (versions.length === 0) return null;

    // Get full version data for the latest
    return this.getVersionById(versions[0].id);
  }

  /**
   * Get a specific draft version by ID.
   *
   * @param id Version ID to retrieve
   * @returns The draft version, or null if not found
   * @throws Error if retrieval fails
   */
  async getVersionById(id: string): Promise<DraftVersion | null> {
    await this.init();

    if (!this.db) throw new Error("IndexedDB not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => {
        reject(new Error(`Failed to retrieve version: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  }

  /**
   * Restore a draft version (copy it as the latest).
   * This doesn't delete the original version.
   *
   * @param versionId Version to restore
   * @returns The restored draft version
   * @throws Error if restoration fails
   */
  async restoreVersion(versionId: string): Promise<DraftVersion> {
    const version = await this.getVersionById(versionId);
    if (!version) throw new Error(`Version ${versionId} not found`);

    // Save as a new version
    return this.saveDraft(version.formData, version.posts, version.activeDay);
  }

  /**
   * Delete a specific draft version.
   *
   * @param versionId Version to delete
   * @throws Error if deletion fails
   */
  async deleteVersion(versionId: string): Promise<void> {
    await this.init();

    if (!this.db) throw new Error("IndexedDB not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(versionId);

      request.onerror = () => {
        reject(new Error(`Failed to delete version: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Clear all draft versions.
   * WARNING: This is destructive and cannot be undone.
   *
   * @throws Error if clearing fails
   */
  async clearAll(): Promise<void> {
    await this.init();

    if (!this.db) throw new Error("IndexedDB not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => {
        reject(new Error(`Failed to clear versions: ${request.error}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Delete old versions if count exceeds MAX_VERSIONS.
   * Keeps the most recent MAX_VERSIONS versions.
   * @private
   */
  private async cleanupOldVersions(): Promise<void> {
    const versions = await this.getVersions();

    if (versions.length > MAX_VERSIONS) {
      const versionsToDelete = versions.slice(MAX_VERSIONS);
      for (const version of versionsToDelete) {
        await this.deleteVersion(version.id);
      }
    }
  }

  /**
   * Generate a unique ID for a new version.
   * @private
   */
  private generateId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global singleton instance of the draft history service.
 *
 * Usage:
 * ```typescript
 * import { draftHistoryService } from '@/lib/draftHistory';
 *
 * const version = await draftHistoryService.saveDraft(formData);
 * const versions = await draftHistoryService.getVersions();
 * ```
 */
export const draftHistoryService = new DraftHistoryService();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if IndexedDB is available and working.
 * Useful for graceful fallback if browser doesn't support it.
 *
 * @returns true if IndexedDB is available and working
 */
export async function isIndexedDBAvailable(): Promise<boolean> {
  if (!("indexedDB" in window)) return false;

  try {
    await draftHistoryService.init();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a human-readable timestamp for a draft version.
 * Example: "2 hours ago", "Yesterday at 3:45 PM"
 *
 * @param timestamp Date of the version
 * @returns Formatted timestamp string
 */
export function formatTimestamp(timestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return `Yesterday at ${timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return timestamp.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
