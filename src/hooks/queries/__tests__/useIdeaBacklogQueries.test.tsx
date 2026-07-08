import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { vi, beforeEach, describe, it, expect } from "vitest";
import {
  useAddIdeasToBacklogMutation,
  useMarkIdeaUsedMutation,
  useRemoveIdeaFromBacklogMutation,
} from "@/hooks/queries/useIdeaBacklogQueries";
import type { ExtractedIdea } from "@/hooks/queries/shared";

// ---------------------------------------------------------------------------
// Chainable Supabase query-builder mock.
//
// Each `.from(...)` call pops the next queued `{ data, error }` response off
// `responseQueue` and returns a thenable builder object whose chained
// methods (select/eq/order/insert/update/delete/in/limit) all just return
// itself, so the exact chain shape used by the hook under test doesn't need
// to be replicated here — only the final awaited value matters.
// ---------------------------------------------------------------------------
const { fromMock, responseQueueRef } = vi.hoisted(() => {
  const responseQueueRef: { current: Array<{ data: unknown; error: unknown }> } = {
    current: [],
  };
  const fromMock = vi.fn(() => {
    const response = responseQueueRef.current.shift() ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    const chainMethods = ["select", "eq", "order", "insert", "update", "delete", "in", "limit"];
    for (const method of chainMethods) {
      builder[method] = vi.fn(() => builder);
    }
    (builder as { then: unknown }).then = (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(response).then(resolve, reject);
    return builder;
  });
  return { fromMock, responseQueueRef };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

/**
 * Renders a component that calls `useHook()` then, once mounted, invokes
 * `trigger` with the mutation result inside a `useEffect` (mirroring the
 * pattern used by src/hooks/__tests__/useRegeneratePostMutation.test.tsx),
 * recording the settled outcome for assertions after `waitFor`.
 */
function runMutation<TMutation extends { mutateAsync: (v: never) => Promise<unknown> }, TVar>(
  useHook: () => TMutation,
  variables: TVar
) {
  const qc = new QueryClient();
  const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
  const outcome: { settled: boolean; error: unknown } = { settled: false, error: null };

  function TestRunner() {
    const mutation = useHook();
    React.useEffect(() => {
      mutation
        .mutateAsync(variables as never)
        .catch((err: unknown) => {
          outcome.error = err;
        })
        .finally(() => {
          outcome.settled = true;
        });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
  }

  render(
    <QueryClientProvider client={qc}>
      <TestRunner />
    </QueryClientProvider>
  );

  return { qc, invalidateSpy, outcome };
}

describe("useIdeaBacklogQueries", () => {
  beforeEach(() => {
    responseQueueRef.current = [];
    fromMock.mockClear();
  });

  it("useAddIdeasToBacklogMutation inserts rows with the expected payload shape", async () => {
    const userId = "user-1";
    const ideas: ExtractedIdea[] = [
      {
        title: "Contrarian take on X",
        format: "Carousel",
        rationale: "Because it sparks debate",
        key_points: "Point A. Point B.",
      },
    ];
    const sourceText = "Some very long source text that is more than 120 chars".repeat(5);
    const insertedRows = ideas.map((idea, i) => ({
      id: `row-${i}`,
      user_id: userId,
      angle: idea.title,
      format: idea.format,
      rationale: idea.rationale,
      key_points: idea.key_points,
      source_snippet: sourceText.slice(0, 120),
      platform: "linkedin",
      used_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // 1) insert().select() response
    responseQueueRef.current.push({ data: insertedRows, error: null });
    // 2) trim-check select("id") response — under the cap, no delete needed
    responseQueueRef.current.push({ data: insertedRows.map((r) => ({ id: r.id })), error: null });

    const { invalidateSpy, outcome } = runMutation(() => useAddIdeasToBacklogMutation(userId), {
      ideas,
      sourceText,
      platform: "linkedin",
    });

    await waitFor(() => expect(outcome.settled).toBe(true));
    expect(outcome.error).toBeNull();

    expect(fromMock).toHaveBeenCalledWith("idea_backlog");
    const insertBuilder = fromMock.mock.results[0].value as { insert: ReturnType<typeof vi.fn> };
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      {
        user_id: userId,
        angle: "Contrarian take on X",
        format: "Carousel",
        rationale: "Because it sparks debate",
        key_points: "Point A. Point B.",
        source_snippet: sourceText.slice(0, 120),
        platform: "linkedin",
      },
    ]);

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["idea-backlog", userId] })
    );
  });

  it("trims the backlog to the 50 newest rows after insert when over the cap", async () => {
    const userId = "user-1";
    const ideas: ExtractedIdea[] = [
      { title: "Idea", format: "Post", rationale: "r", key_points: "k" },
    ];
    responseQueueRef.current.push({ data: [{ id: "new-row" }], error: null });
    // Simulate 55 rows existing after insert (over the 50 cap)
    const allRowIds = Array.from({ length: 55 }, (_, i) => ({ id: `row-${i}` }));
    responseQueueRef.current.push({ data: allRowIds, error: null });
    // The delete() call's own response
    responseQueueRef.current.push({ data: null, error: null });

    const { outcome } = runMutation(() => useAddIdeasToBacklogMutation(userId), {
      ideas,
      sourceText: "src",
      platform: "x",
    });

    await waitFor(() => expect(outcome.settled).toBe(true));
    expect(outcome.error).toBeNull();

    // 3 `.from("idea_backlog")` calls: insert, trim-check select, delete
    expect(fromMock).toHaveBeenCalledTimes(3);
    const deleteBuilder = fromMock.mock.results[2].value as {
      delete: ReturnType<typeof vi.fn>;
      in: ReturnType<typeof vi.fn>;
    };
    expect(deleteBuilder.delete).toHaveBeenCalled();
    const staleIds = allRowIds.slice(50).map((r) => r.id);
    expect(deleteBuilder.in).toHaveBeenCalledWith("id", staleIds);
  });

  it("useMarkIdeaUsedMutation sets used_at and filters by id + user_id", async () => {
    const userId = "user-1";
    responseQueueRef.current.push({ data: null, error: null });

    const { invalidateSpy, outcome } = runMutation(
      () => useMarkIdeaUsedMutation(userId),
      "idea-1"
    );

    await waitFor(() => expect(outcome.settled).toBe(true));
    expect(outcome.error).toBeNull();

    const builder = fromMock.mock.results[0].value as {
      update: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.update).toHaveBeenCalledWith({ used_at: expect.any(String) });
    expect(builder.eq).toHaveBeenCalledWith("id", "idea-1");
    expect(builder.eq).toHaveBeenCalledWith("user_id", userId);

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["idea-backlog", userId] })
    );
  });

  it("useRemoveIdeaFromBacklogMutation deletes filtered by id + user_id and invalidates", async () => {
    const userId = "user-1";
    responseQueueRef.current.push({ data: null, error: null });

    const { invalidateSpy, outcome } = runMutation(
      () => useRemoveIdeaFromBacklogMutation(userId),
      "idea-1"
    );

    await waitFor(() => expect(outcome.settled).toBe(true));
    expect(outcome.error).toBeNull();

    const builder = fromMock.mock.results[0].value as {
      delete: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "idea-1");
    expect(builder.eq).toHaveBeenCalledWith("user_id", userId);

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["idea-backlog", userId] })
    );
  });
});
