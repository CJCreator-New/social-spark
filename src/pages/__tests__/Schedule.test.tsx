import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Mock supabase client — only the conflict-detection select chain is exercised
// directly by Schedule.tsx (mutations go through the mocked useAppQueries hooks).
// ---------------------------------------------------------------------------
const mockConflictLimit = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              neq: vi.fn(() => ({
                limit: (...args: unknown[]) => mockConflictLimit(...args),
              })),
            })),
          })),
        })),
      })),
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
}));

vi.mock("react-helmet-async", () => ({
  Helmet: () => null,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const NOW_ISO = "2026-07-08T09:00:00.000Z"; // Wednesday
const ROW = {
  id: "row-1",
  calendar_id: "cal-1",
  post_day: 1,
  platform: "LinkedIn",
  scheduled_at: NOW_ISO,
  status: "scheduled",
  workflow_status: "drafted" as const,
  copy_text: "Some post text",
  post_snapshot: { title: "My Post", topic: "Growth" },
  published_at: null,
  failure_reason: null,
};

const mockCancelMutateAsync = vi.fn();
const mockUpdateStatusMutateAsync = vi.fn();
const mockUpdateTimeMutateAsync = vi.fn();

function makeScheduleData() {
  return {
    pages: [
      {
        rows: [ROW],
        calendars: {
          "cal-1": { id: "cal-1", title: "Growth Calendar", timezone: "UTC", tracking_url: null },
        },
        profileTz: "UTC",
        nextCursor: null,
      },
    ],
  };
}

vi.mock("@/hooks/useAppQueries", () => ({
  useScheduleInfiniteQuery: () => ({
    data: makeScheduleData(),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
  useProfileQuery: () => ({ data: { default_timezone: "UTC" } }),
  useCancelScheduledPostMutation: () => ({ mutateAsync: mockCancelMutateAsync }),
  useUpdateScheduledPostStatusMutation: () => ({ mutateAsync: mockUpdateStatusMutateAsync }),
  useUpdateScheduledPostTimeMutation: () => ({ mutateAsync: mockUpdateTimeMutateAsync }),
}));

import { toast } from "sonner";
import Schedule from "../Schedule";

function openRescheduleMenu() {
  const trigger = screen.getByRole("button", { name: /actions for day 1/i });
  fireEvent.click(trigger);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConflictLimit.mockResolvedValue({ data: [], error: null });
  mockCancelMutateAsync.mockResolvedValue(undefined);
  mockUpdateStatusMutateAsync.mockResolvedValue(undefined);
  mockUpdateTimeMutateAsync.mockResolvedValue(undefined);
});

describe("Schedule — conflict detection on reschedule", () => {
  it("shows a warning dialog when the new slot is already taken, and cancel leaves the time unchanged", async () => {
    mockConflictLimit.mockResolvedValue({ data: [{ id: "other-row" }], error: null });
    render(<Schedule />);

    openRescheduleMenu();
    fireEvent.click(await screen.findByText(/reschedule/i));

    const dateInput = screen.getByDisplayValue(/2026-07-08/);
    fireEvent.change(dateInput, { target: { value: "2026-07-09" } });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText(/already scheduled at this exact time/i)).toBeInTheDocument();
    });

    // Cancel the conflict dialog — the edit must NOT be committed.
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByText(/already scheduled at this exact time/i)).not.toBeInTheDocument();
    });
    expect(mockUpdateTimeMutateAsync).not.toHaveBeenCalled();
  });

  it("commits the reschedule when the user chooses to overwrite ('Schedule anyway')", async () => {
    mockConflictLimit.mockResolvedValue({ data: [{ id: "other-row" }], error: null });
    render(<Schedule />);

    openRescheduleMenu();
    fireEvent.click(await screen.findByText(/reschedule/i));

    const dateInput = screen.getByDisplayValue(/2026-07-08/);
    fireEvent.change(dateInput, { target: { value: "2026-07-09" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText(/already scheduled at this exact time/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /schedule anyway/i }));

    await waitFor(() => {
      expect(mockUpdateTimeMutateAsync).toHaveBeenCalled();
    });
    const call = mockUpdateTimeMutateAsync.mock.calls[0][0];
    expect(call.id).toBe("row-1");
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Time updated");
    });
  });

  it("commits directly without a dialog when there is no conflicting row", async () => {
    mockConflictLimit.mockResolvedValue({ data: [], error: null });
    render(<Schedule />);

    openRescheduleMenu();
    fireEvent.click(await screen.findByText(/reschedule/i));

    const dateInput = screen.getByDisplayValue(/2026-07-08/);
    fireEvent.change(dateInput, { target: { value: "2026-07-10" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mockUpdateTimeMutateAsync).toHaveBeenCalled();
    });
    expect(screen.queryByText(/already scheduled at this exact time/i)).not.toBeInTheDocument();
  });
});
