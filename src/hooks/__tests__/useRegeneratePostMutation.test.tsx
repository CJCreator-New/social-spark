import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach, describe, it, expect } from "vitest";
import { useRegeneratePostMutation } from "@/hooks/useAppQueries";

type RegeneratePayload = {
  calendarId: string;
  post: {
    day: number;
    dow: string;
  };
};

function TestRunner({ payload }: { payload: RegeneratePayload }) {
  const m = useRegeneratePostMutation(payload.calendarId);
  React.useEffect(() => {
    m.mutateAsync(payload).catch(() => {
      /* test only: assertion happens against fetch */
    });
  }, [m, payload]);
  return null;
}

describe("useRegeneratePostMutation", () => {
  const OLD = global.fetch;
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ post: { day: 1, dow: "Mon", title: "ok" } }) })));
  });
  afterEach(() => {
    vi.stubGlobal("fetch", OLD);
  });

  it("calls the regenerate endpoint", async () => {
    const qc = new QueryClient();
    const payload = { calendarId: "cal-1", post: { day: 1, dow: "Mon" } };
    render(
      <QueryClientProvider client={qc}>
        <TestRunner payload={payload} />
      </QueryClientProvider>
    );
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const called = fetchMock.mock.calls[0][0] as string;
    expect(called).toContain("/functions/v1/regenerate-post");
  });
});
