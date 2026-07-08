import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Post } from "@/components/wizard/constants";
import type { BrandSlotRow } from "@/hooks/queries/shared";

// ---------------------------------------------------------------------------
// Mock supabase — various effects (past-post scan, trends) call supabase directly.
// ---------------------------------------------------------------------------
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: "tok" } } })),
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: "user-1" } } })),
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

function makeSlot(overrides: Partial<BrandSlotRow>): BrandSlotRow {
  return {
    id: "slot-default",
    user_id: "user-1",
    name: "Default",
    is_default: true,
    forbidden_phrases: [],
    proof_points: [],
    cta_preferences: [],
    preferred_structures: [],
    brand_examples: null,
    default_framework: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const DEFAULT_SLOT = makeSlot({
  id: "slot-default",
  name: "Default",
  is_default: true,
  forbidden_phrases: ["synergy"],
});

const ACME_SLOT = makeSlot({
  id: "slot-acme",
  name: "Acme Co",
  is_default: false,
  forbidden_phrases: ["game-changer"],
});

const MOCK_BRAND_SLOTS: BrandSlotRow[] = [DEFAULT_SLOT, ACME_SLOT];

// Mutable so individual tests can point the calendar at a specific brand slot.
let mockCalendarData: Record<string, unknown> = {};

function baseCalendarData(brandSlotId: string | null): Record<string, unknown> {
  return {
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
    brand_slot_id: brandSlotId,
  };
}

const mockUpdateCalendarMutateAsync = vi.fn();
const mockRegenerateMutateAsync = vi.fn();
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
  useGenerateSinglePostMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useIdeaBacklogQuery: () => ({ data: [], isLoading: false }),
  useMarkIdeaUsedMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useRemoveIdeaFromBacklogMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useBrandSlotsQuery: () => ({ data: MOCK_BRAND_SLOTS, isLoading: false }),
  useEnsureDefaultBrandSlot: () => ({ data: MOCK_BRAND_SLOTS, isLoading: false }),
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
  mockRegenerateMutateAsync.mockResolvedValue({ post: makePost(1, "Mon", "Regenerated Post") });
});

afterEach(() => {
  cleanup();
  vi.stubGlobal("fetch", OLD_FETCH);
});

describe("CalendarDetail — brand slot selector", () => {
  it("renders every brand slot and reflects the calendar's current brand_slot_id", async () => {
    mockCalendarData = baseCalendarData("slot-acme");
    renderCalendarDetail();

    const select = (await screen.findByRole("combobox", {
      name: /brand voice/i,
    })) as HTMLSelectElement;

    expect(select.value).toBe("slot-acme");
    expect(screen.getByRole("option", { name: /account default/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Default \(default\)$/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Acme Co" })).toBeInTheDocument();
  });

  it("defaults to 'Account default' when the calendar has no brand_slot_id", async () => {
    mockCalendarData = baseCalendarData(null);
    renderCalendarDetail();

    const select = (await screen.findByRole("combobox", {
      name: /brand voice/i,
    })) as HTMLSelectElement;

    expect(select.value).toBe("");
  });

  it("changing the selector calls the calendar-update mutation with the new brand_slot_id", async () => {
    mockCalendarData = baseCalendarData(null);
    renderCalendarDetail();

    const select = await screen.findByRole("combobox", { name: /brand voice/i });
    fireEvent.change(select, { target: { value: "slot-acme" } });

    await waitFor(() => {
      expect(mockUpdateCalendarMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ brand_slot_id: "slot-acme" })
      );
    });
  });

  it("regenerateDay's payload uses the resolved (non-default) slot's forbidden phrases", async () => {
    mockCalendarData = baseCalendarData("slot-acme");
    renderCalendarDetail();

    const regenerateBtn = await screen.findByRole("button", { name: "↻ Regenerate" });
    fireEvent.click(regenerateBtn);

    await waitFor(() => {
      expect(mockRegenerateMutateAsync).toHaveBeenCalled();
    });

    const payload = mockRegenerateMutateAsync.mock.calls[0][0] as { brandMemory: string };
    expect(payload.brandMemory).toContain("game-changer");
    expect(payload.brandMemory).not.toContain("synergy");
  });
});
