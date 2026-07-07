import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { InspirationBank } from "../InspirationBank";

// ---------------------------------------------------------------------------
// Mock sonner toast so we don't need a Provider
// ---------------------------------------------------------------------------
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Mock trendingTopics so test data is deterministic
// ---------------------------------------------------------------------------
vi.mock("@/lib/trendingTopics", () => ({
  getTrendingTopicsForIndustry: () => [
    { topic: "AI Tools", category: "Technology", trending: true, posts: 12000 },
    { topic: "Remote Work", category: "Workplace", trending: false, posts: 8000 },
    { topic: "Brand Authenticity", category: "Marketing", trending: true, posts: 15000 },
  ],
  getTrendingTopicsLastUpdated: () => "Updated just now",
}));

// ---------------------------------------------------------------------------
// Mock useGenerateTrendsMutation — keeps it idle (not pending)
// ---------------------------------------------------------------------------
vi.mock("@/hooks/useAppQueries", () => ({
  useGenerateTrendsMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

// ---------------------------------------------------------------------------
// Mutable store state shared across tests
// ---------------------------------------------------------------------------
const mockToggleTrendingTopic = vi.fn();

const mockStoreState = {
  selectedTrendingTopics: [] as string[],
  toggleTrendingTopic: mockToggleTrendingTopic,
};

vi.mock("@/stores/useWizardStore", () => ({
  useWizardStore: () => mockStoreState,
}));

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------
const defaultProps = {
  industry: "tech",
  platform: "LinkedIn",
  onTopicClick: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreState.selectedTrendingTopics = [];
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("InspirationBank", () => {
  it("renders topic cards from the mocked trending data", () => {
    render(<InspirationBank {...defaultProps} />);

    expect(screen.getByText("AI Tools")).toBeInTheDocument();
    expect(screen.getByText("Remote Work")).toBeInTheDocument();
    expect(screen.getByText("Brand Authenticity")).toBeInTheDocument();
  });

  it("clicking a topic card opens the review modal (does NOT call onTopicClick directly)", () => {
    render(<InspirationBank {...defaultProps} />);

    // The card button opens the modal — onTopicClick is on the "Confirm & Add" button inside
    fireEvent.click(screen.getByText("AI Tools"));

    // Modal should appear with the Trending Topic Review label
    expect(screen.getByText("Trending Topic Review")).toBeInTheDocument();
    // onTopicClick is NOT called yet — it fires only on "Confirm & Add"
    expect(defaultProps.onTopicClick).not.toHaveBeenCalled();
  });

  it('"Confirm & Add" inside the modal calls onTopicClick with the topic name', () => {
    render(<InspirationBank {...defaultProps} />);

    // Open modal for "AI Tools"
    fireEvent.click(screen.getByText("AI Tools"));

    const confirmBtn = screen.getByRole("button", { name: /confirm & add/i });
    fireEvent.click(confirmBtn);

    expect(defaultProps.onTopicClick).toHaveBeenCalledWith("AI Tools");
  });

  it('"Use This Trend" button calls toggleTrendingTopic with the topic name', () => {
    render(<InspirationBank {...defaultProps} />);

    // Open modal for "Remote Work"
    fireEvent.click(screen.getByText("Remote Work"));

    const useBtn = screen.getByRole("button", { name: /use this trend/i });
    fireEvent.click(useBtn);

    expect(mockToggleTrendingTopic).toHaveBeenCalledWith("Remote Work");
  });

  it('"Use This Trend" button label changes to "✓ Remove from Trends" when topic is already selected', () => {
    // Pre-select the topic in the store state
    mockStoreState.selectedTrendingTopics = ["AI Tools"];

    render(<InspirationBank {...defaultProps} />);

    // Open modal for the already-selected topic
    fireEvent.click(screen.getByText("AI Tools"));

    // The button should now show the remove label
    expect(
      screen.getByRole("button", { name: /remove from trends/i })
    ).toBeInTheDocument();
  });

  it("shows a count badge in the header when topics are selected", () => {
    mockStoreState.selectedTrendingTopics = ["AI Tools", "Remote Work"];

    render(<InspirationBank {...defaultProps} />);

    expect(screen.getByText("2 selected for generation")).toBeInTheDocument();
  });

  it("does NOT show the count badge when no topics are selected", () => {
    render(<InspirationBank {...defaultProps} />);

    expect(screen.queryByText(/selected for generation/i)).not.toBeInTheDocument();
  });

  it('shows "✓ Already added to generation queue" inside modal for a selected topic', () => {
    mockStoreState.selectedTrendingTopics = ["Brand Authenticity"];

    render(<InspirationBank {...defaultProps} />);

    fireEvent.click(screen.getByText("Brand Authenticity"));

    expect(screen.getByText("Already added to generation queue")).toBeInTheDocument();
  });
});
