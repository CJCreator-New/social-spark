import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import Index from "../Index";
import { useWizardStore } from "@/stores/useWizardStore";
import {
  INITIAL_FORM,
  EMPTY_POST,
  DRAFT_VERSION,
  DRAFT_MAX_AGE_MS,
  WIZARD_DRAFT_PREFIX,
} from "@/components/wizard/constants";

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
  useBrandSlotsQuery: () => ({ data: [] }),
  useEnsureDefaultBrandSlot: () => ({ data: [] }),
}));

const OLD_FETCH = global.fetch;
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

describe("Index — generation offline / network error", () => {
  it("falls back to the local generator when generation fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("Failed to fetch"));

    renderIndex();

    // Navigate to step 2 (topics) then step 3 (generate) via store
    useWizardStore.getState().setStep(2);

    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /generate/i })).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(
      () => {
        expect(toast.warning).toHaveBeenCalledWith(
          "Live AI generation is unavailable right now, so a local fallback version was generated."
        );
      },
      { timeout: 5000 }
    );

    // Drain the fallback's internal setStep(4) timeout before unmounting so it
    // can't fire against the wizard store during a later test.
    await new Promise((resolve) => setTimeout(resolve, 400));
  });

  it("falls back to the local generator when the AI service returns a 500", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal server error" }),
    });

    renderIndex();
    useWizardStore.getState().setStep(2);

    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /generate/i })).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(
      () => {
        expect(toast.warning).toHaveBeenCalledWith(
          "Live AI generation is unavailable right now, so a local fallback version was generated."
        );
      },
      { timeout: 5000 }
    );

    // Drain the fallback's internal setStep(4) timeout before unmounting so it
    // can't fire against the wizard store during a later test.
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
});
