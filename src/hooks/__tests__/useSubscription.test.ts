import { renderHook, waitFor } from "@testing-library/react";
import { vi, beforeEach, describe, it, expect } from "vitest";
import { useSubscription } from "@/hooks/useSubscription";
import { FREE_STATUS } from "@/lib/subscription";

const mockGetSubscriptionStatus = vi.fn();

vi.mock("@/lib/subscription", async () => {
  const actual = await vi.importActual<typeof import("@/lib/subscription")>("@/lib/subscription");
  return {
    ...actual,
    getSubscriptionStatus: (...args: unknown[]) => mockGetSubscriptionStatus(...args),
  };
});

describe("useSubscription", () => {
  beforeEach(() => {
    mockGetSubscriptionStatus.mockReset();
  });

  it("reports no error and free status for a genuinely free user", async () => {
    mockGetSubscriptionStatus.mockResolvedValue(FREE_STATUS);

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.status).toEqual(FREE_STATUS);
  });

  it("surfaces an error instead of silently reporting free tier when the fetch fails", async () => {
    mockGetSubscriptionStatus.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useSubscription());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("network down");
    // Falls back to free-tier display values, but `error` distinguishes this
    // from a genuinely free user.
    expect(result.current.isPro).toBe(false);
  });

  it("clears a previous error after a successful refresh()", async () => {
    mockGetSubscriptionStatus.mockRejectedValueOnce(new Error("network down"));
    mockGetSubscriptionStatus.mockResolvedValueOnce(FREE_STATUS);

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    await result.current.refresh();

    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
