/**
 * Draft Context
 *
 * Provides global draft version management via React Context.
 * Wraps the IndexedDB service and exposes draft history to the entire app.
 *
 * Usage:
 * ```typescript
 * import { useDraftHistory } from '@/contexts/DraftContext';
 *
 * export function MyComponent() {
 *   const { versions, latestVersion, saveVersion, restoreVersion } = useDraftHistory();
 *
 *   return (
 *     <button onClick={() => saveVersion(formData)}>
 *       Save Draft Version
 *     </button>
 *   );
 * }
 * ```
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import {
  draftHistoryService,
  type DraftVersion,
  type DraftVersionSummary,
  isIndexedDBAvailable,
} from "@/lib/draftHistory";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context value for draft history management.
 */
interface DraftContextValue {
  /** List of all saved draft versions (most recent first) */
  versions: DraftVersionSummary[];
  /** The most recent draft version, or null if none exist */
  latestVersion: DraftVersion | null;
  /** Whether IndexedDB is available on this browser */
  isAvailable: boolean;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Any error message if operations failed */
  error: string | null;

  // Methods
  /** Save the current form state as a new draft version */
  saveVersion: (formData: DraftVersion["formData"], posts?: unknown[], activeDay?: number) => Promise<DraftVersion>;
  /** Get all versions */
  refreshVersions: () => Promise<void>;
  /** Restore a specific draft version (creates a new version from it) */
  restoreVersion: (versionId: string) => Promise<DraftVersion>;
  /** Delete a specific draft version */
  deleteVersion: (versionId: string) => Promise<void>;
  /** Clear all draft versions */
  clearAll: () => Promise<void>;
  /** Clear the error message */
  clearError: () => void;
}

// ============================================================================
// CONTEXT & HOOK
// ============================================================================

const DraftContext = createContext<DraftContextValue | undefined>(undefined);

/**
 * Hook to access draft history from anywhere in the app.
 *
 * Must be used inside a <DraftProvider>.
 *
 * @throws Error if used outside <DraftProvider>
 */
export function useDraftHistory(): DraftContextValue {
  const context = useContext(DraftContext);
  if (!context) {
    throw new Error("useDraftHistory must be used inside <DraftProvider>");
  }
  return context;
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

/**
 * Props for the DraftProvider component.
 */
interface DraftProviderProps {
  /** Child components */
  children: React.ReactNode;
}

/**
 * Provider component that wraps the app with draft history management.
 *
 * Usage:
 * ```typescript
 * // In App.tsx or main.tsx
 * import { DraftProvider } from '@/contexts/DraftContext';
 *
 * export default function App({ children }: { children: React.ReactNode }) {
 *   return <DraftProvider>{children}</DraftProvider>;
 * }
 * ```
 *
 * Place this high in the component tree, ideally in App.tsx.
 */
export function DraftProvider({ children }: DraftProviderProps) {
  const [versions, setVersions] = useState<DraftVersionSummary[]>([]);
  const [latestVersion, setLatestVersion] = useState<DraftVersion | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if IndexedDB is available on mount
  useEffect(() => {
    (async () => {
      try {
        const available = await isIndexedDBAvailable();
        setIsAvailable(available);

        if (available) {
          // Load initial versions
          await refreshVersions();
        }
      } catch (err) {
        console.error("Failed to initialize draft history:", err);
        setIsAvailable(false);
      }
    })();
  }, []);

  // Refresh versions list and latest version
  const refreshVersions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [versions, latest] = await Promise.all([
        draftHistoryService.getVersions(),
        draftHistoryService.getLatestVersion(),
      ]);

      setVersions(versions);
      setLatestVersion(latest);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load draft versions";
      setError(message);
      console.error("Failed to refresh draft versions:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save a new version
  const saveVersion = useCallback(
    async (formData: DraftVersion["formData"], posts: unknown[] = [], activeDay: number = 0): Promise<DraftVersion> => {
      if (!isAvailable) {
        throw new Error("Draft history is not available on this browser");
      }

      setError(null);

      try {
        const newVersion = await draftHistoryService.saveDraft(formData, posts, activeDay);
        await refreshVersions();
        return newVersion;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save draft";
        setError(message);
        throw err;
      }
    },
    [isAvailable, refreshVersions]
  );

  // Restore a version
  const restoreVersionFn = useCallback(
    async (versionId: string): Promise<DraftVersion> => {
      if (!isAvailable) {
        throw new Error("Draft history is not available on this browser");
      }

      setError(null);

      try {
        const restored = await draftHistoryService.restoreVersion(versionId);
        await refreshVersions();
        return restored;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to restore version";
        setError(message);
        throw err;
      }
    },
    [isAvailable, refreshVersions]
  );

  // Delete a version
  const deleteVersionFn = useCallback(
    async (versionId: string): Promise<void> => {
      if (!isAvailable) {
        throw new Error("Draft history is not available on this browser");
      }

      setError(null);

      try {
        await draftHistoryService.deleteVersion(versionId);
        await refreshVersions();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete version";
        setError(message);
        throw err;
      }
    },
    [isAvailable, refreshVersions]
  );

  // Clear all versions
  const clearAllVersions = useCallback(async (): Promise<void> => {
    if (!isAvailable) {
      throw new Error("Draft history is not available on this browser");
    }

    setError(null);

    try {
      await draftHistoryService.clearAll();
      await refreshVersions();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clear versions";
      setError(message);
      throw err;
    }
  }, [isAvailable, refreshVersions]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: DraftContextValue = {
    versions,
    latestVersion,
    isAvailable,
    isLoading,
    error,
    saveVersion,
    refreshVersions,
    restoreVersion: restoreVersionFn,
    deleteVersion: deleteVersionFn,
    clearAll: clearAllVersions,
    clearError,
  };

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}
