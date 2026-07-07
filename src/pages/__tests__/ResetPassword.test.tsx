import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockUpdateUser = vi.fn();
const mockGetSession = vi.fn();
let authStateCallback: ((event: string) => void) | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        authStateCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: (...args: unknown[]) => mockGetSession(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    },
  },
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
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

import { toast } from "sonner";
import ResetPassword from "../ResetPassword";

async function renderReady() {
  mockGetSession.mockResolvedValue({ data: { session: null } });
  const utils = render(<ResetPassword />);
  // Simulate Supabase parsing the recovery link and emitting PASSWORD_RECOVERY.
  await waitFor(() => expect(authStateCallback).not.toBeNull());
  act(() => {
    authStateCallback!("PASSWORD_RECOVERY");
  });
  await waitFor(() => {
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
  });
  return utils;
}

beforeEach(() => {
  vi.clearAllMocks();
  authStateCallback = null;
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockUpdateUser.mockResolvedValue({ error: null });
});

describe("ResetPassword", () => {
  it("shows the verifying state before the recovery link resolves", async () => {
    mockGetSession.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ResetPassword />);
    expect(screen.getByText(/verifying your reset link/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });

  it("shows the password form once the recovery link is verified", async () => {
    await renderReady();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it("rejects a weak password using the shared passwordPolicy validator", async () => {
    await renderReady();
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 10 characters/i)).toBeInTheDocument();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without calling updateUser", async () => {
    await renderReady();
    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: "longenoughpassword1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "differentpassword1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("submits successfully with a valid matching password and redirects", async () => {
    await renderReady();
    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: "longenoughpassword1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "longenoughpassword1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: "longenoughpassword1" });
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Password updated");
    });
    expect(mockNavigate).toHaveBeenCalledWith("/app", { replace: true });
  });

  it("shows the server error message when updateUser fails", async () => {
    mockUpdateUser.mockResolvedValue({
      error: { message: "New password should be different from the old password." },
    });
    await renderReady();
    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: "longenoughpassword1" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "longenoughpassword1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(screen.getByText(/new password should be different/i)).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalledWith("/app", { replace: true });
  });
});
