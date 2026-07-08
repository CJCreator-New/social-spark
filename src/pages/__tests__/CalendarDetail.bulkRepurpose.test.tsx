import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Post } from "@/components/wizard/constants";

// ---------------------------------------------------------------------------
// Mock supabase — the component reads/writes via supabase.auth + .from() in a
// few effects (recent-posts corpus, trends, etc.).
// ---------------------------------------------------------------------------
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: "tok" } } })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: null } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
    })),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to, ...props }, children),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: "cal-1" }),
}));

vi.mock("react-helmet-async", () => ({
  Helmet: () => null,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("@/components/BufferScheduler", () => ({
  BufferScheduler: () => <div data-testid="buffer-scheduler" />,
}));

vi.mock("@/components/PersonaCompare", () => ({
  PersonaCompare: () => null,
}));

vi.mock("@/components/WeekBalanceScore", () => ({
  WeekBalanceScore: () => <div data-testid="week-balance-score" />,
}));

vi.mock("@/components/PostInsights", () => ({
  default: () => <div data-testid="post-insights" />,
}));

vi.mock("@/components/PerformanceScoreCard", () => ({
  PerformanceScoreCard: ({ post }: { post: Post }) => (
    <div data-testid={`performance-score-card-${post.day}`}>score for {post.title}</div>
  ),
}));

vi.mock("@/components/TopicGapBadge", () => ({
  TopicGapBadge: () => null,
}));

vi.mock("@/components/DraftVersionHistory", () => ({
  DraftVersionHistory: () => <div data-testid="draft-version-history" />,
}));

vi.mock("@/lib/telemetry", () => ({
  sendEvent: vi.fn(() => Promise.resolve()),
}));

function makePost(day: number, dow: string, title: string): Post {
  return {
    day,
    dow,
    topic: `Topic ${title}`,
    format: "Balanced mix",
    title,
    hook: "hook",
    body: `body ${title}`,
    cta: "cta",
    hashtags: "#tag",
    rationale: "",
  };
}

const INITIAL_POSTS: Post[] = [
  makePost(1, "Mon", "Post A"),
  makePost(2, "Tue", "Post B"),
  makePost(3, "Wed", "Post C"),
];

const mockCalendarData = {
  id: "cal-1",
  title: "My Calendar",
  platform: "LinkedIn",
  industry: "tech",
  industry_label: "Tech",
  core_idea: "Growth hacking",
  posts: INITIAL_POSTS,
  form_payload: {},
  created_at: new Date().toISOString(),
  is_favorite: false,
  timezone: "UTC",
  tracking_url: null,
  locked_hashtags: {},
};

const mockUpdateCalendarMutateAsync = vi.fn();
const mockRepurposeMutateAsync = vi.fn();
const mockGenerateImageMutateAsync = vi.fn(() => Promise.resolve(undefined));
const MOCK_SCHEDULED_POSTS: any[] = [];

vi.mock("@/hooks/useAppQueries", () => ({
  useCalendarQuery: () => ({
    data: mockCalendarData,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useProfileQuery: () => ({ data: null }),
  useProfileUpdateMutation: () => ({ mutateAsync: vi.fn() }),
  useScheduledPostsQuery: () => ({ data: MOCK_SCHEDULED_POSTS }),
  useCreateCalendarMutation: () => ({ mutateAsync: vi.fn() }),
  useRegeneratePostMutation: () => ({ mutateAsync: vi.fn() }),
  useUpdateSavedCalendarMutation: () => ({ mutateAsync: mockUpdateCalendarMutateAsync }),
  useRepurposePostMutation: () => ({ mutateAsync: mockRepurposeMutateAsync }),
  useGeneratePostImageMutation: () => ({ mutateAsync: mockGenerateImageMutateAsync }),
  useInlineRewriteMutation: () => ({ mutateAsync: vi.fn() }),
  useGenerateSinglePostMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useIdeaBacklogQuery: () => ({ data: [], isLoading: false }),
  useMarkIdeaUsedMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useRemoveIdeaFromBacklogMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useBrandSlotsQuery: () => ({ data: [], isLoading: false }),
}));

import { toast } from "sonner";
import CalendarDetail from "../CalendarDetail";

function renderCalendarDetail() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <CalendarDetail />
    </QueryClientProvider>
  );
}

const OLD_FETCH = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
  );
  mockUpdateCalendarMutateAsync.mockResolvedValue(undefined);
  mockGenerateImageMutateAsync.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.stubGlobal("fetch", OLD_FETCH);
});

async function openBulkRepurposeModal() {
  const trigger = await screen.findByRole("button", { name: /repurpose week to/i });
  fireEvent.click(trigger);
  return screen.findByRole("dialog", { name: /repurpose week to another platform/i });
}

describe("CalendarDetail — bulk repurpose", () => {
  it("dispatches a repurpose call per selected day, tracks status, and only saves included successes ('Save N')", async () => {
    // Uses real timers for useBulkRepurpose's stagger delay; give it headroom
    // beyond the default 5s so it isn't flaky under a loaded full-suite run.
    mockRepurposeMutateAsync.mockImplementation((payload: { post: Post; targetPlatform: string }) => {
      const day = payload.post.day;
      if (day === 2) {
        return Promise.reject(new Error("Failed to parse repurposed post"));
      }
      return Promise.resolve({
        post: { ...payload.post, body: `${payload.post.body} (repurposed for ${payload.targetPlatform})` },
      });
    });

    renderCalendarDetail();

    const dialog = await openBulkRepurposeModal();
    // Target platform select defaults to the first non-current-platform option (X).
    const startBtn = within(dialog).getByRole("button", { name: /repurpose 3 posts/i });
    fireEvent.click(startBtn);

    // Progress → review: wait for the batch to settle (2 succeed, 1 fails).
    await waitFor(
      () => {
        expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    expect(mockRepurposeMutateAsync).toHaveBeenCalledTimes(3);

    // Day 1 and Day 3 succeeded and show score cards; day 2 failed and has no score card.
    expect(screen.getByTestId("performance-score-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("performance-score-card-3")).toBeInTheDocument();
    expect(screen.queryByTestId("performance-score-card-2")).not.toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /retry failed \(1\)/i });
    expect(retryBtn).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", { name: /save 2 repurposed posts/i });
    fireEvent.click(saveBtn);

    await waitFor(() => expect(mockUpdateCalendarMutateAsync).toHaveBeenCalled());
    const patch = mockUpdateCalendarMutateAsync.mock.calls[0][0] as { posts: Post[] };
    const savedByDay = new Map(patch.posts.map((p) => [p.day, p]));
    expect(savedByDay.get(1)?.body).toContain("(repurposed for X)");
    expect(savedByDay.get(3)?.body).toContain("(repurposed for X)");
    // Day 2 never succeeded — its original content must be preserved, not blanked.
    expect(savedByDay.get(2)?.body).toBe("body Post B");

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  }, 15000);

  it("'Retry failed' only re-issues calls for the posts that failed", async () => {
    let day2Attempts = 0;
    mockRepurposeMutateAsync.mockImplementation((payload: { post: Post }) => {
      const day = payload.post.day;
      if (day === 2) {
        day2Attempts += 1;
        if (day2Attempts === 1) return Promise.reject(new Error("Failed to parse repurposed post"));
        return Promise.resolve({ post: { ...payload.post, body: "B repurposed on retry" } });
      }
      return Promise.resolve({ post: { ...payload.post, body: `${payload.post.body} (repurposed)` } });
    });

    renderCalendarDetail();
    const dialog = await openBulkRepurposeModal();
    fireEvent.click(within(dialog).getByRole("button", { name: /repurpose 3 posts/i }));

    await waitFor(() => expect(screen.getByText(/2 selected/i)).toBeInTheDocument());
    expect(mockRepurposeMutateAsync).toHaveBeenCalledTimes(3);

    const retryBtn = screen.getByRole("button", { name: /retry failed \(1\)/i });
    fireEvent.click(retryBtn);

    await waitFor(() => expect(screen.getByText(/3 selected/i)).toBeInTheDocument());

    // Exactly one extra call was made (day 2's retry) — days 1 & 3 were not re-dispatched.
    expect(mockRepurposeMutateAsync).toHaveBeenCalledTimes(4);
    expect(screen.getByTestId("performance-score-card-2")).toBeInTheDocument();
  }, 15000);
});
