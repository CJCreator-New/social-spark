import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { IdeaBacklogRow } from "@/hooks/queries/shared";

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

vi.mock("@/hooks/queries/useRepurposeQueries", () => ({
  useExtractIdeasMutation: () => ({
    mutateAsync: mockExtractMutateAsync,
    isPending: false,
  }),
  useGenerateFromIdeaMutation: () => ({
    mutateAsync: mockGenerateMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

let mockBacklogItems: IdeaBacklogRow[] = [];
let mockBacklogLoading = false;
const mockAddToBacklogMutateAsync = vi.fn();
const mockMarkIdeaUsedMutateAsync = vi.fn();
const mockRemoveIdeaMutateAsync = vi.fn();

vi.mock("@/hooks/useAppQueries", () => ({
  useIdeaBacklogQuery: () => ({ data: mockBacklogItems, isLoading: mockBacklogLoading }),
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
];

function makeBacklogRow(overrides: Partial<IdeaBacklogRow> = {}): IdeaBacklogRow {
  return {
    id: "idea-1",
    user_id: "user-1",
    angle: "A backlog angle worth drafting",
    format: "How-to breakdown",
    rationale: "Because it is actionable.",
    key_points: "Point A. Point B.",
    source_snippet: "Some snippet",
    platform: "LinkedIn",
    used_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function pasteSource(value: string = LONG_SOURCE) {
  fireEvent.change(screen.getByLabelText("Paste your source material"), {
    target: { value },
  });
}

describe("Repurpose — idea backlog + URL ingestion", () => {
  beforeEach(() => {
    mockExtractMutateAsync.mockReset();
    mockGenerateMutateAsync.mockReset();
    mockAddToBacklogMutateAsync.mockReset();
    mockMarkIdeaUsedMutateAsync.mockReset();
    mockRemoveIdeaMutateAsync.mockReset();
    mockFetchUrl.mockReset();
    mockBacklogItems = [];
    mockBacklogLoading = false;
    mockUrlFetchLoading = false;
    mockUrlFetchError = null;
    window.sessionStorage.clear();
  });

  afterEach(() => cleanup());

  it("renders unused backlog ideas and drafts a post from one via the existing generate flow", async () => {
    const row = makeBacklogRow();
    mockBacklogItems = [row, makeBacklogRow({ id: "idea-2", used_at: new Date().toISOString() })];
    mockMarkIdeaUsedMutateAsync.mockResolvedValue({ id: row.id });
    mockGenerateMutateAsync.mockResolvedValue({
      title: "Drafted title",
      hook: "Drafted hook",
      body: "Drafted body.",
      cta: "Drafted CTA",
      hashtags: "#growth",
    });

    render(<Repurpose />);

    fireEvent.click(screen.getByRole("button", { name: /idea backlog/i }));
    // Only the one unused idea should be shown (the used one is filtered out)
    expect(screen.getByText(row.angle)).toBeInTheDocument();
    expect(screen.getAllByText(row.angle)).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /draft this/i }));

    await waitFor(() => {
      expect(mockMarkIdeaUsedMutateAsync).toHaveBeenCalledWith(row.id);
    });
    await waitFor(() => {
      expect(mockGenerateMutateAsync).toHaveBeenCalledWith({
        idea: {
          title: row.angle,
          format: row.format,
          rationale: row.rationale,
          key_points: row.key_points,
        },
        platform: "LinkedIn",
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Drafted body.")).toBeInTheDocument();
    });
  });

  it("removes a backlog idea via the remove mutation", async () => {
    const row = makeBacklogRow({ id: "idea-remove-me" });
    mockBacklogItems = [row];
    mockRemoveIdeaMutateAsync.mockResolvedValue({ id: row.id });

    render(<Repurpose />);
    fireEvent.click(screen.getByRole("button", { name: /idea backlog/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove idea/i }));

    await waitFor(() => {
      expect(mockRemoveIdeaMutateAsync).toHaveBeenCalledWith("idea-remove-me");
    });
  });

  it("saves an extracted idea to the backlog with the expected payload", async () => {
    mockExtractMutateAsync.mockResolvedValue(IDEAS);
    mockAddToBacklogMutateAsync.mockResolvedValue([]);

    render(<Repurpose />);
    pasteSource();
    fireEvent.click(screen.getByRole("button", { name: /extract ideas/i }));

    await waitFor(() => {
      expect(screen.getByText(IDEAS[0].title)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^save to backlog$/i }));

    await waitFor(() => {
      expect(mockAddToBacklogMutateAsync).toHaveBeenCalledWith({
        ideas: [IDEAS[0]],
        sourceText: LONG_SOURCE,
        platform: "LinkedIn",
      });
    });
  });

  it("fetches URL content and populates the editable source textarea on success", async () => {
    mockFetchUrl.mockResolvedValue({
      text: "Fetched article body text.",
      title: "Example article",
      wordCount: 250,
    });

    render(<Repurpose />);
    fireEvent.click(screen.getByRole("tab", { name: /from url/i }));
    fireEvent.change(screen.getByLabelText("Source URL"), {
      target: { value: "https://example.com/article" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^fetch$/i }));

    await waitFor(() => {
      expect(mockFetchUrl).toHaveBeenCalledWith("https://example.com/article");
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Review and edit the fetched text")).toHaveValue(
        "Fetched article body text."
      );
    });
    expect(screen.getByText(/example article/i)).toBeInTheDocument();
    expect(screen.getByText(/250/)).toBeInTheDocument();
  });

  it("warns when fetched content is too short to reliably extract from", async () => {
    mockFetchUrl.mockResolvedValue({
      text: "Too short.",
      title: "Thin page",
      wordCount: 5,
    });

    render(<Repurpose />);
    fireEvent.click(screen.getByRole("tab", { name: /from url/i }));
    fireEvent.change(screen.getByLabelText("Source URL"), {
      target: { value: "https://example.com/thin" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^fetch$/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/may require javascript to render/i)
      ).toBeInTheDocument();
    });
  });

  it("shows an error with retry when URL fetch fails", async () => {
    mockUrlFetchError = "Failed to fetch URL";
    render(<Repurpose />);
    fireEvent.click(screen.getByRole("tab", { name: /from url/i }));
    fireEvent.change(screen.getByLabelText("Source URL"), {
      target: { value: "https://example.com/bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^fetch$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to fetch URL");
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
