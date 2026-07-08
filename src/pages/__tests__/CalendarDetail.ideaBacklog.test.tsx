import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Post } from "@/components/wizard/constants";
import type { IdeaBacklogRow } from "@/hooks/queries/shared";

// ---------------------------------------------------------------------------
// Mock supabase — regenerateAllUnlocked / other effects call supabase directly.
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

vi.mock("@/components/DraftVersionHistory", () => ({
  DraftVersionHistory: () => <div data-testid="draft-version-history" />,
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

const mockUpdateCalendarMutateAsync = vi.fn();
const mockGenerateSinglePostMutateAsync = vi.fn();
const mockMarkIdeaUsedMutate = vi.fn();
const mockRemoveIdeaMutate = vi.fn();
const MOCK_SCHEDULED_POSTS: any[] = [];

function makeIdea(overrides: Partial<IdeaBacklogRow>): IdeaBacklogRow {
  return {
    id: "idea-1",
    user_id: "user-1",
    angle: "Why founders should ship weekly",
    format: "Listicle",
    rationale: "Trending topic",
    key_points: "Ship weekly; get feedback fast; iterate",
    source_snippet: "some source text",
    platform: "LinkedIn",
    used_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

let mockBacklogData: IdeaBacklogRow[] = [];
let mockBacklogLoading = false;

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
  useRepurposePostMutation: () => ({ mutateAsync: vi.fn() }),
  useGeneratePostImageMutation: () => ({ mutateAsync: vi.fn() }),
  useInlineRewriteMutation: () => ({ mutateAsync: vi.fn() }),
  useGenerateSinglePostMutation: () => ({ mutateAsync: mockGenerateSinglePostMutateAsync }),
  useIdeaBacklogQuery: () => ({ data: mockBacklogData, isLoading: mockBacklogLoading }),
  useMarkIdeaUsedMutation: () => ({ mutate: mockMarkIdeaUsedMutate }),
  useRemoveIdeaFromBacklogMutation: () => ({ mutate: mockRemoveIdeaMutate }),
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
  mockBacklogData = [];
  mockBacklogLoading = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
  );
  mockUpdateCalendarMutateAsync.mockResolvedValue(undefined);
  mockGenerateSinglePostMutateAsync.mockResolvedValue(makePost(4, "Thu", "Generated Post"));
});

afterEach(() => {
  cleanup();
  vi.stubGlobal("fetch", OLD_FETCH);
});

async function openBacklogPanel() {
  const toggle = await screen.findByRole("button", { name: /idea backlog/i });
  fireEvent.click(toggle);
  return toggle;
}

describe("CalendarDetail — idea backlog panel", () => {
  it("renders only unused saved ideas (used ones are filtered out)", async () => {
    mockBacklogData = [
      makeIdea({ id: "idea-unused", angle: "Unused idea angle", used_at: null }),
      makeIdea({ id: "idea-used", angle: "Used idea angle", used_at: new Date().toISOString() }),
    ];

    renderCalendarDetail();
    await openBacklogPanel();

    expect(await screen.findByText("Unused idea angle")).toBeInTheDocument();
    expect(screen.queryByText("Used idea angle")).not.toBeInTheDocument();
  });

  it("clicking 'Draft this' marks the idea used and generates a post from its angle/key_points", async () => {
    mockBacklogData = [
      makeIdea({
        id: "idea-draft-me",
        angle: "Ship weekly cadence",
        key_points: "Weekly release notes; customer feedback loop",
        used_at: null,
      }),
    ];

    renderCalendarDetail();
    await openBacklogPanel();

    const draftBtn = await screen.findByRole("button", { name: /draft this/i });
    fireEvent.click(draftBtn);

    expect(mockMarkIdeaUsedMutate).toHaveBeenCalledWith("idea-draft-me");

    await waitFor(() => {
      expect(mockGenerateSinglePostMutateAsync).toHaveBeenCalled();
    });
    const payload = mockGenerateSinglePostMutateAsync.mock.calls[0][0] as {
      topic: string;
      coreIdea: string;
    };
    expect(payload.topic).toBe("Ship weekly cadence");
    expect(payload.coreIdea).toBe("Weekly release notes; customer feedback loop");
  });

  it("clicking 'Remove' calls the remove-from-backlog mutation with the idea id", async () => {
    mockBacklogData = [
      makeIdea({ id: "idea-remove-me", angle: "Some removable idea", used_at: null }),
    ];

    renderCalendarDetail();
    await openBacklogPanel();

    const removeBtn = await screen.findByRole("button", { name: /remove idea/i });
    fireEvent.click(removeBtn);

    expect(mockRemoveIdeaMutate).toHaveBeenCalledWith("idea-remove-me", expect.anything());
  });
});
