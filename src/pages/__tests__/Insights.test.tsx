import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("react-helmet-async", () => ({
  Helmet: () => null,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

const fetchHookCtaInsightsMock = vi.fn();
vi.mock("@/lib/insights/hookCtaInsights", () => ({
  fetchHookCtaInsights: (...args: unknown[]) => fetchHookCtaInsightsMock(...args),
}));

import Insights from "../Insights";

function renderInsights() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Insights />
    </QueryClientProvider>
  );
}

describe("Insights page", () => {
  beforeEach(() => {
    fetchHookCtaInsightsMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a loading state while the RPC call is pending", async () => {
    let resolvePromise: (value: unknown) => void = () => {};
    fetchHookCtaInsightsMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );
    renderInsights();

    // SkeletonList renders generic placeholder rows — assert the populated
    // stat cards are not yet present.
    expect(screen.queryByText("Hooks regenerated")).not.toBeInTheDocument();

    resolvePromise({
      hookRegenerateCount: 0,
      ctaRegenerateCount: 0,
      ctaSuggestionAppliedCount: 0,
      postsKept: 0,
      postsRegeneratedAgain: 0,
      byPlatform: {},
    });
    await waitFor(() => expect(fetchHookCtaInsightsMock).toHaveBeenCalled());
  });

  it("shows the empty state when all counts are zero", async () => {
    fetchHookCtaInsightsMock.mockResolvedValue({
      hookRegenerateCount: 0,
      ctaRegenerateCount: 0,
      ctaSuggestionAppliedCount: 0,
      postsKept: 0,
      postsRegeneratedAgain: 0,
      byPlatform: {},
    });
    renderInsights();

    await waitFor(() => {
      expect(
        screen.getByText(/not enough data yet/i)
      ).toBeInTheDocument();
    });
  });

  it("renders populated stat cards and a by-platform breakdown", async () => {
    fetchHookCtaInsightsMock.mockResolvedValue({
      hookRegenerateCount: 4,
      ctaRegenerateCount: 2,
      ctaSuggestionAppliedCount: 1,
      postsKept: 5,
      postsRegeneratedAgain: 3,
      byPlatform: { LinkedIn: 4, X: 2 },
    });
    renderInsights();

    await waitFor(() => {
      expect(screen.getByText("Hooks regenerated")).toBeInTheDocument();
    });
    expect(screen.getAllByText("4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("CTA suggestions applied")).toBeInTheDocument();
    expect(screen.getByText("Posts kept as-is")).toBeInTheDocument();
    expect(screen.getByText("Posts regenerated again before saving")).toBeInTheDocument();
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("X")).toBeInTheDocument();
  });
});
