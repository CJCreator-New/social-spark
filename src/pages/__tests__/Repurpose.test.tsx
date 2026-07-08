import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("react-helmet-async", () => ({
  Helmet: () => null,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockExtractMutateAsync = vi.fn();
const mockGenerateMutateAsync = vi.fn();
let mockExtractPending = false;

vi.mock("@/hooks/queries/useRepurposeQueries", () => ({
  useExtractIdeasMutation: () => ({
    mutateAsync: mockExtractMutateAsync,
    isPending: mockExtractPending,
  }),
  useGenerateFromIdeaMutation: () => ({
    mutateAsync: mockGenerateMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

const mockAddToBacklogMutateAsync = vi.fn();
const mockMarkIdeaUsedMutateAsync = vi.fn();
const mockRemoveIdeaMutateAsync = vi.fn();

vi.mock("@/hooks/useAppQueries", () => ({
  useIdeaBacklogQuery: () => ({ data: [], isLoading: false }),
  useAddIdeasToBacklogMutation: () => ({
    mutateAsync: mockAddToBacklogMutateAsync,
    isPending: false,
  }),
  useMarkIdeaUsedMutation: () => ({
    mutateAsync: mockMarkIdeaUsedMutateAsync,
    isPending: false,
  }),
  useRemoveIdeaFromBacklogMutation: () => ({
    mutateAsync: mockRemoveIdeaMutateAsync,
    isPending: false,
  }),
}));

const mockFetchUrl = vi.fn();
let mockUrlFetchLoading = false;
let mockUrlFetchError: string | null = null;

vi.mock("@/hooks/useFetchUrlContent", () => ({
  useFetchUrlContent: () => ({
    fetchUrl: mockFetchUrl,
    loading: mockUrlFetchLoading,
    error: mockUrlFetchError,
  }),
}));

import Repurpose from "../Repurpose";

const LONG_SOURCE = "Repurposing long-form material into short posts. ".repeat(10).trim();

const IDEAS = [
  {
    title: "Why repurposing beats writing from scratch",
    format: "Contrarian take",
    rationale: "Challenges a common belief, which drives comments.",
    key_points: "Repurposing reuses proven material.",
  },
  {
    title: "How to turn one article into a week of posts",
    format: "How-to breakdown",
    rationale: "Actionable steps get saved and shared.",
    key_points: "Paste, extract ideas, generate per platform.",
  },
];

function pasteSource(value: string = LONG_SOURCE) {
  fireEvent.change(screen.getByLabelText("Paste your source material"), {
    target: { value },
  });
}

describe("Repurpose page", () => {
  beforeEach(() => {
    mockExtractMutateAsync.mockReset();
    mockGenerateMutateAsync.mockReset();
    mockAddToBacklogMutateAsync.mockReset();
    mockMarkIdeaUsedMutateAsync.mockReset();
    mockRemoveIdeaMutateAsync.mockReset();
    mockFetchUrl.mockReset();
    mockExtractPending = false;
    mockUrlFetchLoading = false;
    mockUrlFetchError = null;
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("disables Extract ideas until the source meets the minimum length", () => {
    render(<Repurpose />);
    const button = screen.getByRole("button", { name: /extract ideas/i });
    expect(button).toBeDisabled();

    pasteSource("too short");
    expect(button).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/at least 200 characters/i);

    pasteSource();
    expect(button).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a validation error when the source exceeds the maximum length", () => {
    render(<Repurpose />);
    pasteSource("x".repeat(20001));
    expect(screen.getByRole("alert")).toHaveTextContent(/under 20,000 characters/i);
    expect(screen.getByRole("button", { name: /extract ideas/i })).toBeDisabled();
  });

  it("extracts ideas and renders a self-contained card per idea", async () => {
    mockExtractMutateAsync.mockResolvedValue(IDEAS);
    render(<Repurpose />);
    pasteSource();
    fireEvent.click(screen.getByRole("button", { name: /extract ideas/i }));

    await waitFor(() => {
      expect(screen.getByText(IDEAS[0].title)).toBeInTheDocument();
    });
    expect(mockExtractMutateAsync).toHaveBeenCalledWith({
      source: LONG_SOURCE,
      count: 5,
      platform: "LinkedIn",
    });
    expect(screen.getByText("Contrarian take")).toBeInTheDocument();
    expect(screen.getByText("How-to breakdown")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /generate post/i })).toHaveLength(2);
  });

  it("sends the chosen idea count and platform to extraction", async () => {
    mockExtractMutateAsync.mockResolvedValue(IDEAS);
    render(<Repurpose />);
    pasteSource();
    fireEvent.change(screen.getByLabelText("Number of ideas"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Target platform"), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: /extract ideas/i }));

    await waitFor(() => {
      expect(mockExtractMutateAsync).toHaveBeenCalledWith({
        source: LONG_SOURCE,
        count: 3,
        platform: "X",
      });
    });
  });

  it("shows an error with retry and keeps the source when extraction fails", async () => {
    mockExtractMutateAsync.mockRejectedValueOnce(new Error("Rate limit exceeded."));
    render(<Repurpose />);
    pasteSource();
    fireEvent.click(screen.getByRole("button", { name: /extract ideas/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Rate limit exceeded.");
    });
    expect(screen.getByLabelText("Paste your source material")).toHaveValue(LONG_SOURCE);

    mockExtractMutateAsync.mockResolvedValueOnce(IDEAS);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => {
      expect(screen.getByText(IDEAS[0].title)).toBeInTheDocument();
    });
  });

  it("generates a full post in place from a single idea card", async () => {
    mockExtractMutateAsync.mockResolvedValue(IDEAS);
    mockGenerateMutateAsync.mockResolvedValue({
      title: "Generated title",
      hook: "Generated hook",
      body: "Generated body grounded in the source.",
      cta: "Generated CTA",
      hashtags: "#growth",
    });
    render(<Repurpose />);
    pasteSource();
    fireEvent.click(screen.getByRole("button", { name: /extract ideas/i }));
    await waitFor(() => {
      expect(screen.getByText(IDEAS[0].title)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /generate post/i })[0]);

    await waitFor(() => {
      expect(screen.getByText("Generated body grounded in the source.")).toBeInTheDocument();
    });
    expect(mockGenerateMutateAsync).toHaveBeenCalledWith({
      idea: IDEAS[0],
      platform: "LinkedIn",
    });
    expect(screen.getByText("Generated hook")).toBeInTheDocument();
    expect(screen.getByText("#growth")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy for linkedin/i })).toBeInTheDocument();
    // Other cards remain independently actionable
    expect(screen.getByRole("button", { name: /generate post/i })).toBeInTheDocument();
  });

  it("shows a per-card error with retry when generation fails", async () => {
    mockExtractMutateAsync.mockResolvedValue(IDEAS);
    mockGenerateMutateAsync.mockRejectedValueOnce(new Error("PLATFORM_UNAVAILABLE"));
    render(<Repurpose />);
    pasteSource();
    fireEvent.click(screen.getByRole("button", { name: /extract ideas/i }));
    await waitFor(() => {
      expect(screen.getByText(IDEAS[0].title)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /generate post/i })[0]);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("PLATFORM_UNAVAILABLE");
    });

    mockGenerateMutateAsync.mockResolvedValueOnce({ body: "Recovered post body." });
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => {
      expect(screen.getByText("Recovered post body.")).toBeInTheDocument();
    });
  });

  it("restores the pasted source from session storage (draft recovery)", () => {
    window.sessionStorage.setItem("repurpose-source-draft", LONG_SOURCE);
    render(<Repurpose />);
    expect(screen.getByLabelText("Paste your source material")).toHaveValue(LONG_SOURCE);
    expect(screen.getByRole("button", { name: /extract ideas/i })).toBeEnabled();
  });
});
