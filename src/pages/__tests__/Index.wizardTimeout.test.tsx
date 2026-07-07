import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Index from "../Index";
import { useWizardStore } from "@/stores/useWizardStore";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
    })),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to, ...props }, children),
  useNavigate: () => vi.fn(),
}));

vi.mock("react-helmet-async", () => ({
  Helmet: () => null,
}));

// AnimatePresence's mode="wait" defers mounting the next step until the
// previous step's exit animation completes, which never resolves under fake
// timers (no real requestAnimationFrame ticks). Bypass animation gating so
// the step-2 view actually mounts synchronously after the abort/timeout.
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, ...props }: { children?: React.ReactNode }) =>
          React.createElement("div", props, children),
    }
  ),
  AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useReducedMotion: () => false,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/hooks/useAppQueries", () => ({
  useCreateCalendarMutation: () => ({ mutateAsync: vi.fn() }),
  useProfileQuery: () => ({ data: null }),
  useProfileUpdateMutation: () => ({ mutateAsync: vi.fn() }),
  useRegeneratePostMutation: () => ({ mutateAsync: vi.fn() }),
  useGeneratePostImageMutation: () => ({ mutateAsync: vi.fn() }),
}));

const mockFetch = vi.fn();

function renderIndex() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <Index />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  useWizardStore.getState().reset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Index — wizard 90s generation timeout", () => {
  it("aborts the in-flight request at 90s, shows a timeout error, and returns the user to step 2", async () => {
    // Simulate a request that never resolves on its own, and only rejects
    // when the AbortSignal passed by Index.tsx's 90s hard-timeout fires —
    // exercising the real `ac.abort("timeout")` -> catch(reason==="timeout") path.
    mockFetch.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });

    renderIndex();
    useWizardStore.getState().setStep(2);

    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /generate/i })).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Only fake timers from here on, so the 90s setTimeout can be fast-forwarded
    // without the earlier real-timer waitFor calls above hanging.
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: /generate/i }));

      // Advance past the 90_000ms hard timeout in Index.tsx to trigger ac.abort("timeout").
      await act(async () => {
        await vi.advanceTimersByTimeAsync(90_000);
      });

      expect(screen.getByText(/generation timed out\. please try again\./i)).toBeInTheDocument();

      // The wizard must recover to step 2 (topics/details), not stay stuck loading.
      expect(useWizardStore.getState().step).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  }, 10000);
});
