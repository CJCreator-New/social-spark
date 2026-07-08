import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { vi, beforeEach, describe, it, expect } from "vitest";
import {
  useCreateBrandSlotMutation,
  useUpdateBrandSlotMutation,
  useDeleteBrandSlotMutation,
  useSetDefaultBrandSlotMutation,
  useEnsureDefaultBrandSlotMutation,
} from "@/hooks/queries/useBrandSlotQueries";

// ---------------------------------------------------------------------------
// Chainable Supabase query-builder mock — mirrors
// src/hooks/queries/__tests__/useIdeaBacklogQueries.test.tsx exactly. Each
// `.from(...)` call pops the next queued `{ data, error }` response off
// `responseQueue` and returns a thenable builder whose chained methods
// (select/eq/order/insert/update/delete/in/limit/single) all just return
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
    const chainMethods = [
      "select",
      "eq",
      "order",
      "insert",
      "update",
      "delete",
      "in",
      "limit",
      "single",
    ];
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
 * `mutateAsync` with `variables` inside a `useEffect`, recording the settled
 * outcome for assertions after `waitFor`. Mirrors the pattern used by
 * useIdeaBacklogQueries.test.tsx's `runMutation`.
 */
function runMutation<TMutation extends { mutateAsync: (v: never) => Promise<unknown> }, TVar>(
  useHook: () => TMutation,
  variables: TVar
) {
  const qc = new QueryClient();
  const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
  const outcome: { settled: boolean; error: unknown; result: unknown } = {
    settled: false,
    error: null,
    result: undefined,
  };

  function TestRunner() {
    const mutation = useHook();
    React.useEffect(() => {
      mutation
        .mutateAsync(variables as never)
        .then((res: unknown) => {
          outcome.result = res;
        })
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

describe("useBrandSlotQueries", () => {
  beforeEach(() => {
    responseQueueRef.current = [];
    fromMock.mockClear();
  });

  it("useCreateBrandSlotMutation always inserts with is_default: false", async () => {
    const userId = "user-1";
    const created = {
      id: "slot-1",
      user_id: userId,
      name: "Product Launches",
      is_default: false,
      forbidden_phrases: [],
      proof_points: [],
      cta_preferences: [],
      preferred_structures: [],
      brand_examples: null,
      default_framework: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    responseQueueRef.current.push({ data: created, error: null });

    const { invalidateSpy, outcome } = runMutation(() => useCreateBrandSlotMutation(userId), {
      name: "Product Launches",
    });

    await waitFor(() => expect(outcome.settled).toBe(true));
    expect(outcome.error).toBeNull();

    expect(fromMock).toHaveBeenCalledWith("brand_slots");
    const builder = fromMock.mock.results[0].value as { insert: ReturnType<typeof vi.fn> };
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        name: "Product Launches",
        is_default: false,
      })
    );

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["brand-slots", userId] })
    );
  });

  it("useUpdateBrandSlotMutation patches by id + user_id", async () => {
    const userId = "user-1";
    responseQueueRef.current.push({ data: null, error: null });

    const { invalidateSpy, outcome } = runMutation(() => useUpdateBrandSlotMutation(userId), {
      id: "slot-1",
      patch: { name: "Renamed" },
    });

    await waitFor(() => expect(outcome.settled).toBe(true));
    expect(outcome.error).toBeNull();

    const builder = fromMock.mock.results[0].value as {
      update: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Renamed" })
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "slot-1");
    expect(builder.eq).toHaveBeenCalledWith("user_id", userId);

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["brand-slots", userId] })
    );
  });

  it("useDeleteBrandSlotMutation deletes filtered by id + user_id", async () => {
    const userId = "user-1";
    responseQueueRef.current.push({ data: null, error: null });

    const { invalidateSpy, outcome } = runMutation(
      () => useDeleteBrandSlotMutation(userId),
      "slot-1"
    );

    await waitFor(() => expect(outcome.settled).toBe(true));
    expect(outcome.error).toBeNull();

    const builder = fromMock.mock.results[0].value as {
      delete: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
    };
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "slot-1");
    expect(builder.eq).toHaveBeenCalledWith("user_id", userId);

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["brand-slots", userId] })
    );
  });

  it("useSetDefaultBrandSlotMutation issues two sequential updates (unset then set)", async () => {
    const userId = "user-1";
    // 1) unset current default response
    responseQueueRef.current.push({ data: null, error: null });
    // 2) set new default response
    responseQueueRef.current.push({ data: null, error: null });

    const { invalidateSpy, outcome } = runMutation(
      () => useSetDefaultBrandSlotMutation(userId),
      "slot-2"
    );

    await waitFor(() => expect(outcome.settled).toBe(true));
    expect(outcome.error).toBeNull();

    expect(fromMock).toHaveBeenCalledTimes(2);

    const unsetBuilder = fromMock.mock.results[0].value as {
      update: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
    };
    expect(unsetBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_default: false })
    );
    expect(unsetBuilder.eq).toHaveBeenCalledWith("user_id", userId);
    expect(unsetBuilder.eq).toHaveBeenCalledWith("is_default", true);

    const setBuilder = fromMock.mock.results[1].value as {
      update: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
    };
    expect(setBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ is_default: true })
    );
    expect(setBuilder.eq).toHaveBeenCalledWith("id", "slot-2");
    expect(setBuilder.eq).toHaveBeenCalledWith("user_id", userId);

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["brand-slots", userId] })
    );
  });

  it("useEnsureDefaultBrandSlotMutation creates a 'Default' slot from populated profile fields", async () => {
    const userId = "user-1";
    const profileData = {
      forbidden_phrases: ["synergy"],
      proof_points: ["99.9% uptime"],
      cta_preferences: ["Reply below"],
      preferred_structures: ["Hook -> CTA"],
      brand_examples: ["example post"],
      default_framework: "AIDA",
    };
    const created = {
      id: "slot-default",
      user_id: userId,
      name: "Default",
      is_default: true,
      ...profileData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    responseQueueRef.current.push({ data: created, error: null });

    const { invalidateSpy, outcome } = runMutation(
      () => useEnsureDefaultBrandSlotMutation(userId),
      profileData
    );

    await waitFor(() => expect(outcome.settled).toBe(true));
    expect(outcome.error).toBeNull();

    const builder = fromMock.mock.results[0].value as { insert: ReturnType<typeof vi.fn> };
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: userId,
        name: "Default",
        is_default: true,
        forbidden_phrases: ["synergy"],
        proof_points: ["99.9% uptime"],
        cta_preferences: ["Reply below"],
        preferred_structures: ["Hook -> CTA"],
        brand_examples: ["example post"],
        default_framework: "AIDA",
      })
    );

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["brand-slots", userId] })
    );
  });

  it("useEnsureDefaultBrandSlotMutation swallows a 23505 unique-violation error as a no-op", async () => {
    const userId = "user-1";
    responseQueueRef.current.push({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });

    const { outcome } = runMutation(() => useEnsureDefaultBrandSlotMutation(userId), null);

    await waitFor(() => expect(outcome.settled).toBe(true));
    expect(outcome.error).toBeNull();
    expect(outcome.result).toEqual({ skipped: true });
  });

  it("useEnsureDefaultBrandSlotMutation with null profile data still inserts empty arrays", async () => {
    const userId = "user-1";
    const created = {
      id: "slot-default",
      user_id: userId,
      name: "Default",
      is_default: true,
      forbidden_phrases: [],
      proof_points: [],
      cta_preferences: [],
      preferred_structures: [],
      brand_examples: null,
      default_framework: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    responseQueueRef.current.push({ data: created, error: null });

    const { outcome } = runMutation(() => useEnsureDefaultBrandSlotMutation(userId), null);

    await waitFor(() => expect(outcome.settled).toBe(true));
    expect(outcome.error).toBeNull();

    const builder = fromMock.mock.results[0].value as { insert: ReturnType<typeof vi.fn> };
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        forbidden_phrases: [],
        proof_points: [],
        cta_preferences: [],
        preferred_structures: [],
        brand_examples: null,
        default_framework: null,
      })
    );
  });
});
