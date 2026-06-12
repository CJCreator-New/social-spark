import { lazy, ComponentType } from "react";

const RELOAD_FLAG = "lovable:lazy-retry-reloaded";

/**
 * Wraps React.lazy with a one-shot retry on ChunkLoadError. This handles the
 * common production case where a user has an old index.html in cache pointing
 * to hashed chunk filenames that no longer exist after a redeploy.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      // Successful load — clear the reload guard so future failures can retry once again.
      try {
        window.sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        /* ignore */
      }
      return mod;
    } catch (err: any) {
      const message = String(err?.message || "");
      const isChunkError =
        err?.name === "ChunkLoadError" ||
        /Loading chunk [\d]+ failed/i.test(message) ||
        /Failed to fetch dynamically imported module/i.test(message) ||
        /Importing a module script failed/i.test(message);

      let alreadyReloaded = false;
      try {
        alreadyReloaded = window.sessionStorage.getItem(RELOAD_FLAG) === "1";
      } catch {
        /* ignore */
      }

      if (isChunkError && !alreadyReloaded) {
        try {
          window.sessionStorage.setItem(RELOAD_FLAG, "1");
        } catch {
          /* ignore */
        }
        window.location.reload();
        // Return a never-resolving promise so React doesn't show an error in the
        // brief moment before the reload completes.
        return new Promise(() => {}) as Promise<{ default: T }>;
      }

      throw err;
    }
  });
}
