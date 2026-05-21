import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach, describe, it, expect } from "vitest";
import { useRegeneratePostMutation } from "@/hooks/useAppQueries";

function TestRunner({ payload }: { payload: any }) {
  const m = useRegeneratePostMutation(payload.calendarId);
  React.useEffect(() => {
    m.mutateAsync(payload).catch(() => {});
  }, []);
  return null;
}

describe("useRegeneratePostMutation", () => {
  const OLD = global.fetch;
  beforeEach(() => {
    (global as any).fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ post: { day: 1, dow: "Mon", title: "ok" } }) }));
  });
  afterEach(() => {
    (global as any).fetch = OLD;
  });

  it("calls the regenerate endpoint", async () => {
    const qc = new QueryClient();
    const payload = { calendarId: "cal-1", post: { day: 1, dow: "Mon" } };
    render(
      <QueryClientProvider client={qc}>
        <TestRunner payload={payload} />
      </QueryClientProvider>
    );
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled());
    const called = (global as any).fetch.mock.calls[0][0] as string;
    expect(called).toContain("/functions/v1/regenerate-post");
  });
});
