import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Post } from "@/components/wizard/constants";

// ---------------------------------------------------------------------------
// Mock supabase — regenerateAllUnlocked directly calls supabase.auth.getSession()
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
  PerformanceScoreCard: () => <div data-testid="performance-score-card" />,
}));

vi.mock("@/components/TopicGapBadge", () => ({
  TopicGapBadge: () => null,
}));

function makePost(day: number, dow: string, title: string): Post {
  return {
    day,
    dow,
    topic: "Growth",
    format: "Balanced mix",
    title,
    hook: "hook",
    body: "body",
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

const mockRegenerateMutateAsync = vi.fn();
const mockUpdateCalendarMutateAsync = vi.fn();
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
  useRegeneratePostMutation: () => ({ mutateAsync: mockRegenerateMutateAsync }),
  useUpdateSavedCalendarMutation: () => ({ mutateAsync: mockUpdateCalendarMutateAsync }),
  useRepurposePostMutation: () => ({ mutateAsync: vi.fn() }),
  useGeneratePostImageMutation: () => ({ mutateAsync: vi.fn() }),
  useInlineRewriteMutation: () => ({ mutateAsync: vi.fn() }),
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
});

afterEach(() => {
  cleanup();
  vi.stubGlobal("fetch", OLD_FETCH);
});

// The component confirms bulk regenerate via the in-app <ConfirmDialog/> (role="dialog"),
// not window.confirm — click its "Regenerate" button to proceed past the gate.
async function confirmBulkRegenerateDialog() {
  const dialog = await screen.findByRole("dialog", { name: /regenerate unlocked posts/i });
  fireEvent.click(within(dialog).getByRole("button", { name: /^regenerate$/i }));
}

describe("CalendarDetail — bulk regenerate (regenerate all unlocked)", () => {
  it("isolates a single post's failure: other posts still regenerate and a partial-failure toast is shown", async () => {
    // Days 1 & 3 succeed, day 2 fails on every attempt (retried 3x internally).
    mockRegenerateMutateAsync.mockImplementation((payload: { post: Post }) => {
      const day = payload.post.day;
      if (day === 2) {
        return Promise.reject(new Error("AI service unavailable"));
      }
      return Promise.resolve({
        post: { ...payload.post, title: `${payload.post.title} (regenerated)` },
      });
    });

    renderCalendarDetail();

    const bulkBtn = await screen.findByRole("button", { name: /regenerate all unlocked/i });
    fireEvent.click(bulkBtn);
    await confirmBulkRegenerateDialog();

    // Bulk regenerate retries the failing post 3x with backoff sleeps (~1.2s) — allow generous time.
    await waitFor(
      () => {
        expect(toast.warning).toHaveBeenCalled();
      },
      { timeout: 8000 }
    );

    const warningMessage = (toast.warning as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(warningMessage).toContain("2 regenerated");
    expect(warningMessage).toContain("1 failed");
    expect(warningMessage).toContain("days 2");

    // The two successful posts were still applied to the saved calendar patch,
    // and the failing post's original content is not silently discarded/blanked.
    expect(mockUpdateCalendarMutateAsync).toHaveBeenCalled();
    const patch = mockUpdateCalendarMutateAsync.mock.calls[0][0] as { posts: Post[] };
    const savedTitles = patch.posts.map((p) => p.title);
    expect(savedTitles).toContain("Post A (regenerated)");
    expect(savedTitles).toContain("Post C (regenerated)");
    expect(savedTitles).toContain("Post B"); // day 2 kept its pre-failure content, not blanked
  }, 12000);

  it("shows a success toast when every unlocked post regenerates successfully", async () => {
    mockRegenerateMutateAsync.mockImplementation((payload: { post: Post }) =>
      Promise.resolve({ post: { ...payload.post, title: `${payload.post.title} (regenerated)` } })
    );

    renderCalendarDetail();

    const bulkBtn = await screen.findByRole("button", { name: /regenerate all unlocked/i });
    fireEvent.click(bulkBtn);
    await confirmBulkRegenerateDialog();

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Regenerated 3 posts"));
    });
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("does not call the regenerate endpoint at all when the user dismisses the confirm dialog", async () => {
    renderCalendarDetail();

    const bulkBtn = await screen.findByRole("button", { name: /regenerate all unlocked/i });
    fireEvent.click(bulkBtn);

    const dialog = await screen.findByRole("dialog", { name: /regenerate unlocked posts/i });
    fireEvent.click(within(dialog).getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /regenerate unlocked posts/i })).not.toBeInTheDocument();
    });
    expect(mockRegenerateMutateAsync).not.toHaveBeenCalled();
  });
});
