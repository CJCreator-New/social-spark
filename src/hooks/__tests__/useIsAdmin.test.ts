import { renderHook, waitFor } from "@testing-library/react";
import { vi, beforeEach, describe, it, expect } from "vitest";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const mockRpc = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("useIsAdmin", () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockUseAuth.mockReset();
  });

  it("denies a user whose JWT claims role:admin but has no user_roles row", async () => {
    // has_role() is the server-side source of truth (see 20260703073516_harden_function_privileges.sql
    // fixing admin_users policy to not trust the JWT 'role' claim). A user with
    // a forged/stale JWT claim but no real user_roles row must be denied.
    mockUseAuth.mockReturnValue({ user: { id: "user-with-forged-claim" }, loading: false });
    mockRpc.mockResolvedValue({ data: false, error: null });

    const { result } = renderHook(() => useIsAdmin());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(mockRpc).toHaveBeenCalledWith("has_role", {
      _user_id: "user-with-forged-claim",
      _role: "admin",
    });
  });

  it("grants admin only when has_role RPC returns true", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "real-admin" }, loading: false });
    mockRpc.mockResolvedValue({ data: true, error: null });

    const { result } = renderHook(() => useIsAdmin());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
  });

  it("denies (fail closed) when the RPC call errors", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" }, loading: false });
    mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const { result } = renderHook(() => useIsAdmin());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  it("returns not-admin without calling the RPC when there is no user", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    const { result } = renderHook(() => useIsAdmin());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
