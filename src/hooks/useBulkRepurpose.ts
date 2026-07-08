import { useCallback, useRef, useState } from "react";
import type { Post } from "@/components/wizard/constants";
import type { GeneratePostImagePayload, RepurposePayload } from "@/hooks/queries/shared";
import { isQuotaOrRateLimitError, repurposeOnePost } from "@/lib/repurposePost";

export type BulkRepurposeStatus = "pending" | "running" | "success" | "failed" | "blocked";

export type BulkRepurposeItem = {
  day: number;
  dow: string;
  sourcePost: Post;
  status: BulkRepurposeStatus;
  result?: Post;
  error?: string;
  included: boolean;
};

export interface UseBulkRepurposeOptions {
  calendarId?: string;
  platform: string;
  formPayload: {
    industry?: string;
    voice?: string;
    style?: string;
    goals?: string[];
    platform?: string;
  };
  repurposeMutateAsync: (payload: RepurposePayload) => Promise<unknown>;
  generateImageMutateAsync: (
    payload: GeneratePostImagePayload
  ) => Promise<
    | { publicUrl?: string; storagePath?: string; aspectRatio?: string; generatedAt?: string }
    | undefined
  >;
  /** Max concurrent in-flight repurpose calls. Default 2 — stays well under the
   *  10 req / 60s per-user rate limit enforced by the repurpose-post edge function. */
  concurrency?: number;
  /** Delay before each dispatch (stagger), in ms. Default 400. */
  staggerMs?: number;
  onPostSuccess?: (item: { day: number; result: Post }) => void;
  onPostFailure?: (item: { day: number; error: string; blocked: boolean }) => void;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const QUOTA_BLOCKED_MESSAGE = "Quota or rate limit reached — not attempted.";

/**
 * Owns the per-post status map, a concurrency-limited dispatch queue, and
 * retry-subset logic for bulk-repurposing a week of posts to a new platform.
 * Never writes to the saved calendar itself — callers read `items` to build
 * their own save payload once the user has reviewed the results.
 */
export function useBulkRepurpose(options: UseBulkRepurposeOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [items, setItems] = useState<BulkRepurposeItem[]>([]);
  const [targetPlatform, setTargetPlatform] = useState<string>("");
  const [running, setRunning] = useState(false);
  const blockedRef = useRef(false);
  const runIdRef = useRef(0);

  const dispatch = useCallback((queueItems: BulkRepurposeItem[], target: string) => {
    const runId = ++runIdRef.current;
    blockedRef.current = false;
    setRunning(true);

    const queue = [...queueItems];
    const concurrency = Math.max(1, optionsRef.current.concurrency ?? 2);
    const stagger = optionsRef.current.staggerMs ?? 400;

    async function worker() {
      while (queue.length > 0) {
        if (blockedRef.current) return;
        const item = queue.shift();
        if (!item) return;
        if (runIdRef.current !== runId) return; // superseded by a newer dispatch

        setItems((prev) =>
          prev.map((it) => (it.day === item.day ? { ...it, status: "running" } : it))
        );

        if (stagger > 0) await sleep(stagger);
        if (runIdRef.current !== runId) return;
        if (blockedRef.current) {
          setItems((prev) =>
            prev.map((it) =>
              it.day === item.day && it.status === "running"
                ? { ...it, status: "blocked", error: QUOTA_BLOCKED_MESSAGE }
                : it
            )
          );
          continue;
        }

        const opts = optionsRef.current;
        let outcome: { post?: Post; error?: string };
        try {
          outcome = await repurposeOnePost(item.sourcePost, target, {
            calendarId: opts.calendarId,
            platform: opts.platform,
            formPayload: opts.formPayload,
            repurposeMutateAsync: opts.repurposeMutateAsync,
            generateImageMutateAsync: opts.generateImageMutateAsync,
          });
        } catch (e) {
          outcome = { error: e instanceof Error ? e.message : "Repurpose failed" };
        }

        if (runIdRef.current !== runId) return;

        if (outcome.error) {
          const quotaHit = isQuotaOrRateLimitError(outcome.error);
          if (quotaHit) {
            blockedRef.current = true;
            setItems((prev) =>
              prev.map((it) => {
                if (it.day === item.day) {
                  return { ...it, status: "failed", error: outcome.error };
                }
                if (it.status === "pending" || it.status === "running") {
                  return { ...it, status: "blocked", error: QUOTA_BLOCKED_MESSAGE };
                }
                return it;
              })
            );
          } else {
            setItems((prev) =>
              prev.map((it) =>
                it.day === item.day ? { ...it, status: "failed", error: outcome.error } : it
              )
            );
          }
          opts.onPostFailure?.({ day: item.day, error: outcome.error || "Repurpose failed", blocked: quotaHit });
        } else if (outcome.post) {
          setItems((prev) =>
            prev.map((it) =>
              it.day === item.day
                ? { ...it, status: "success", result: outcome.post, error: undefined }
                : it
            )
          );
          opts.onPostSuccess?.({ day: item.day, result: outcome.post });
        }
      }
    }

    const workerCount = Math.min(concurrency, queue.length);
    return Promise.all(Array.from({ length: workerCount }, () => worker())).finally(() => {
      if (runIdRef.current === runId) setRunning(false);
    });
  }, []);

  const start = useCallback(
    (selected: Array<{ day: number; dow: string; sourcePost: Post }>, target: string) => {
      const initial: BulkRepurposeItem[] = selected.map((s) => ({
        day: s.day,
        dow: s.dow,
        sourcePost: s.sourcePost,
        status: "pending",
        included: true,
      }));
      setItems(initial);
      setTargetPlatform(target);
      void dispatch(initial, target);
    },
    [dispatch]
  );

  const retryFailed = useCallback(() => {
    const failed = items.filter((it) => it.status === "failed");
    if (failed.length === 0) return;
    setItems((prev) =>
      prev.map((it) => (it.status === "failed" ? { ...it, status: "pending", error: undefined } : it))
    );
    void dispatch(failed, targetPlatform);
  }, [items, dispatch, targetPlatform]);

  const toggleIncluded = useCallback((day: number) => {
    setItems((prev) =>
      prev.map((it) => (it.day === day ? { ...it, included: !it.included } : it))
    );
  }, []);

  const reset = useCallback(() => {
    runIdRef.current += 1; // supersede any still-running dispatch
    blockedRef.current = false;
    setItems([]);
    setTargetPlatform("");
    setRunning(false);
  }, []);

  const settled = items.length > 0 && items.every((it) => it.status !== "pending" && it.status !== "running");
  const counts = {
    total: items.length,
    done: items.filter((it) => it.status === "success" || it.status === "failed" || it.status === "blocked").length,
    success: items.filter((it) => it.status === "success").length,
    failed: items.filter((it) => it.status === "failed").length,
    blocked: items.filter((it) => it.status === "blocked").length,
  };

  return {
    items,
    targetPlatform,
    running,
    settled,
    counts,
    start,
    retryFailed,
    toggleIncluded,
    reset,
  };
}

/**
 * Pure helper: merges included+successful bulk-repurpose results into a base
 * posts array, keyed by `day` (never by array index — the source array's
 * ordering isn't guaranteed to be stable across the lifetime of a bulk run).
 * Days not present in the base array are appended.
 */
export function mergeRepurposedResults(basePosts: Post[], items: BulkRepurposeItem[]): Post[] {
  const includedResults = new Map<number, Post>();
  for (const item of items) {
    if (item.included && item.status === "success" && item.result) {
      includedResults.set(item.day, item.result);
    }
  }
  if (includedResults.size === 0) return basePosts;

  const merged = basePosts.map((post) => includedResults.get(post.day) ?? post);
  const existingDays = new Set(basePosts.map((p) => p.day));
  for (const [day, post] of includedResults) {
    if (!existingDays.has(day)) merged.push(post);
  }
  return merged;
}
