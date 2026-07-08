import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { Post } from "@/components/wizard/constants";
import type { RepurposePayload } from "@/hooks/queries/shared";
import { useBulkRepurpose, mergeRepurposedResults, type BulkRepurposeItem } from "@/hooks/useBulkRepurpose";

function makePost(day: number, dow: string, title: string): Post {
  return {
    day,
    dow,
    topic: `Topic ${day}`,
    format: "Balanced mix",
    title,
    hook: "hook",
    body: `body ${day}`,
    cta: "cta",
    hashtags: "#tag",
    rationale: "",
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const BASE_OPTIONS = {
  calendarId: "cal-1",
  platform: "LinkedIn",
  formPayload: {},
  generateImageMutateAsync: vi.fn(async () => undefined),
};

describe("useBulkRepurpose", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never runs more than the configured concurrency cap of in-flight requests", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const repurposeMutateAsync = vi.fn(async (payload: RepurposePayload) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await sleep(30);
      inFlight -= 1;
      return { post: { ...payload.post, body: `${payload.post.body} (repurposed)` } };
    });

    const { result } = renderHook(() =>
      useBulkRepurpose({
        ...BASE_OPTIONS,
        repurposeMutateAsync,
        concurrency: 2,
        staggerMs: 0,
      })
    );

    const items = [1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      dow: "Mon",
      sourcePost: makePost(day, "Mon", `Post ${day}`),
    }));

    act(() => {
      result.current.start(items, "X");
    });

    await waitFor(() => expect(result.current.settled).toBe(true), { timeout: 5000 });

    expect(repurposeMutateAsync).toHaveBeenCalledTimes(6);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(result.current.counts.success).toBe(6);
  });

  it("retry-subset only re-dispatches failed items, not already-succeeded ones", async () => {
    let attempt = 0;
    const repurposeMutateAsync = vi.fn(async (payload: RepurposePayload) => {
      const day = payload.post.day;
      if (day === 2) {
        attempt += 1;
        if (attempt === 1) throw new Error("Failed to parse repurposed post");
      }
      return { post: { ...payload.post, body: `${payload.post.body} (repurposed)` } };
    });

    const { result } = renderHook(() =>
      useBulkRepurpose({
        ...BASE_OPTIONS,
        repurposeMutateAsync,
        concurrency: 2,
        staggerMs: 0,
      })
    );

    const items = [1, 2, 3].map((day) => ({
      day,
      dow: "Mon",
      sourcePost: makePost(day, "Mon", `Post ${day}`),
    }));

    act(() => {
      result.current.start(items, "X");
    });

    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.counts.success).toBe(2);
    expect(result.current.counts.failed).toBe(1);

    const callsBeforeRetry = repurposeMutateAsync.mock.calls.length;

    act(() => {
      result.current.retryFailed();
    });

    await waitFor(() => expect(result.current.settled).toBe(true));

    // Only the single failed day (day 2) should have been re-dispatched — one extra call.
    expect(repurposeMutateAsync.mock.calls.length).toBe(callsBeforeRetry + 1);
    const retryCallDays = repurposeMutateAsync.mock.calls
      .slice(callsBeforeRetry)
      .map((call) => (call[0] as { post: Post }).post.day);
    expect(retryCallDays).toEqual([2]);
    expect(result.current.counts.success).toBe(3);
    expect(result.current.counts.failed).toBe(0);
  });

  it("marks remaining pending items 'blocked' on a quota/rate-limit error and preserves already-succeeded results", async () => {
    const repurposeMutateAsync = vi.fn(async (payload: RepurposePayload) => {
      const day = payload.post.day;
      if (day === 2) throw new Error("Rate limit exceeded.");
      return { post: { ...payload.post, body: `${payload.post.body} (repurposed)` } };
    });

    const { result } = renderHook(() =>
      useBulkRepurpose({
        ...BASE_OPTIONS,
        repurposeMutateAsync,
        concurrency: 1, // sequential, deterministic ordering for this test
        staggerMs: 0,
      })
    );

    const items = [1, 2, 3, 4].map((day) => ({
      day,
      dow: "Mon",
      sourcePost: makePost(day, "Mon", `Post ${day}`),
    }));

    act(() => {
      result.current.start(items, "X");
    });

    await waitFor(() => expect(result.current.settled).toBe(true));

    const byDay = new Map(result.current.items.map((it) => [it.day, it]));
    expect(byDay.get(1)?.status).toBe("success");
    expect(byDay.get(2)?.status).toBe("failed");
    expect(byDay.get(3)?.status).toBe("blocked");
    expect(byDay.get(4)?.status).toBe("blocked");

    // Never re-dispatched to days 3/4 — the quota hit stopped new dispatches.
    const calledDays = repurposeMutateAsync.mock.calls.map((c) => (c[0] as { post: Post }).post.day);
    expect(calledDays).not.toContain(3);
    expect(calledDays).not.toContain(4);

    // Already-succeeded post is preserved, never discarded.
    expect(result.current.counts.success).toBe(1);
  });

  it("malformed AI output for one post only fails that post, never aborts the batch", async () => {
    const repurposeMutateAsync = vi.fn(async (payload: RepurposePayload) => {
      const day = payload.post.day;
      if (day === 2) return { post: { notAPost: true } }; // malformed — unwrapPost() will reject it
      return { post: { ...payload.post, body: `${payload.post.body} (repurposed)` } };
    });

    const { result } = renderHook(() =>
      useBulkRepurpose({
        ...BASE_OPTIONS,
        repurposeMutateAsync,
        concurrency: 2,
        staggerMs: 0,
      })
    );

    const items = [1, 2, 3].map((day) => ({
      day,
      dow: "Mon",
      sourcePost: makePost(day, "Mon", `Post ${day}`),
    }));

    act(() => {
      result.current.start(items, "X");
    });

    await waitFor(() => expect(result.current.settled).toBe(true));

    const byDay = new Map(result.current.items.map((it) => [it.day, it]));
    expect(byDay.get(1)?.status).toBe("success");
    expect(byDay.get(2)?.status).toBe("failed");
    expect(byDay.get(3)?.status).toBe("success");
  });
});

describe("mergeRepurposedResults", () => {
  it("builds an included-only save payload, keyed by day (not array index)", () => {
    const basePosts = [makePost(1, "Mon", "A"), makePost(2, "Tue", "B"), makePost(3, "Wed", "C")];

    const items: BulkRepurposeItem[] = [
      {
        day: 1,
        dow: "Mon",
        sourcePost: basePosts[0],
        status: "success",
        result: { ...basePosts[0], body: "A repurposed" },
        included: true,
      },
      {
        day: 2,
        dow: "Tue",
        sourcePost: basePosts[1],
        status: "success",
        result: { ...basePosts[1], body: "B repurposed" },
        included: false, // user unchecked this one — must NOT be merged in
      },
      {
        day: 3,
        dow: "Wed",
        sourcePost: basePosts[2],
        status: "failed",
        error: "boom",
        included: true,
      },
    ];

    const merged = mergeRepurposedResults(basePosts, items);
    const byDay = new Map(merged.map((p) => [p.day, p]));

    expect(byDay.get(1)?.body).toBe("A repurposed");
    expect(byDay.get(2)?.body).toBe("body 2"); // untouched — excluded by the user
    expect(byDay.get(3)?.body).toBe("body 3"); // untouched — never succeeded
    expect(merged.length).toBe(3);
  });

  it("appends a repurposed result for a day not present in the base posts array", () => {
    const basePosts = [makePost(1, "Mon", "A")];
    const items: BulkRepurposeItem[] = [
      {
        day: 5,
        dow: "Fri",
        sourcePost: makePost(5, "Fri", "E"),
        status: "success",
        result: { ...makePost(5, "Fri", "E"), body: "E repurposed" },
        included: true,
      },
    ];
    const merged = mergeRepurposedResults(basePosts, items);
    expect(merged.length).toBe(2);
    expect(merged.find((p) => p.day === 5)?.body).toBe("E repurposed");
  });
});
