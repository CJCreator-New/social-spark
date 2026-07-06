import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Mock supabase — rpc('admin_calendar_stats') + the three admin table reads.
// ---------------------------------------------------------------------------
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("@/lib/telemetry", () => ({
  default: { sendEvent: vi.fn() },
  sendEvent: vi.fn(),
}));

// Charts pull in a heavy charting lib — stub the lazy import.
vi.mock("../admin/AdminCharts", () => ({
  default: () => <div data-testid="admin-charts-stub" />,
}));

import { AdminDashboard } from "../Admin";

// Builds a chainable + directly-awaitable Supabase query-builder stand-in.
// Some call sites do `await supabase.from(x).select('*')` directly, others
// chain `.select('*').order(...).limit(...)` before awaiting — this object
// supports both by being "thenable" at every step in the chain.
function mockChain(data: unknown, error: unknown = null) {
  const result = { data, error };
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: typeof result) => void) => resolve(result),
  };
  return builder;
}

const STATS_RPC_RESULT = {
  calendarsToday: 4,
  calendarsWeek: 21,
  activeUsersToday: 12,
  activeUsersWeek: 58,
  totalCalendars: 340,
  platformDistribution: { LinkedIn: 10, Instagram: 5 },
  industryDistribution: { tech: 8, health: 3 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRpc.mockResolvedValue({ data: STATS_RPC_RESULT, error: null });
  mockFrom.mockImplementation(() => mockChain([]));
});

describe("AdminDashboard", () => {
  it("shows a loading skeleton before stats resolve", () => {
    // Never-resolving RPC keeps the component in its loading state.
    mockRpc.mockReturnValue(new Promise(() => {}));
    render(<AdminDashboard />);
    // SkeletonList is rendered instead of the stat cards while stats are loading.
    expect(screen.queryByText(/active users \(today\)/i)).not.toBeInTheDocument();
  });

  it("renders overview stats once admin_calendar_stats resolves", async () => {
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText(/active users \(today\)/i).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("12").length).toBeGreaterThan(0); // activeUsersToday
    expect(screen.getAllByText("4").length).toBeGreaterThan(0); // calendarsGeneratedToday
    expect(mockRpc).toHaveBeenCalledWith("admin_calendar_stats");
  });

  it("shows an error state when the admin RPC fails", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "RLS denied: not an admin" } });
    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load admin dashboard/i)).toBeInTheDocument();
    });
  });

  it("renders the fallback API key status rows once loaded", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "admin_user_key_status") {
        return mockChain([
          { user_id: "11111111-aaaa-bbbb-cccc-000000000000", api_provider: "openai", use_own_key: true, has_own_key: true, updated_at: new Date().toISOString() },
        ]);
      }
      if (table === "api_key_audit_log") {
        return mockChain([]);
      }
      if (table === "admin_payments") {
        return mockChain([]);
      }
      return mockChain([]);
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/key set/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/fallback on/i)).toBeInTheDocument();
  });

  it("shows a payments error message when the payments table read fails", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "admin_payments") {
        // supabase-js's PostgrestError extends Error, so the real component's
        // `err instanceof Error` branch (which surfaces err.message) applies.
        return mockChain(null, new Error("permission denied for table admin_payments"));
      }
      return mockChain([]);
    });

    render(<AdminDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/permission denied for table admin_payments/i)).toBeInTheDocument();
    });
  });
});
