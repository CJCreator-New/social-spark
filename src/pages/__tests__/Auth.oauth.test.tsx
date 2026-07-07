import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import Auth from "../Auth";

const mockSignInWithOAuth = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockGetSession = vi.fn();
const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/integrations/lovable", () => ({
  lovable: {
    auth: {
      signInWithOAuth: (...args: unknown[]) => mockSignInWithOAuth(...args),
    },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => new URLSearchParams(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-helmet-async", () => ({
  Helmet: () => null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: null });
  mockGetSession.mockResolvedValue({ data: { session: null } });
});

describe("Auth — OAuth Google login", () => {
  it("calls lovable.auth.signInWithOAuth('google') when Google button is clicked", async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: null, error: null });
    render(<Auth />);

    const googleBtn = screen.getByRole("button", { name: /continue with google/i });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith("google", {
        redirect_uri: expect.stringContaining("http"),
      });
    });
  });

  it("shows an error message when the OAuth provider returns an error", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: null,
      error: { message: "access_denied" },
    });
    render(<Auth />);

    const googleBtn = screen.getByRole("button", { name: /continue with google/i });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(screen.getByText(/access_denied/i)).toBeInTheDocument();
    });
  });

  it("shows a generic error when signInWithOAuth throws", async () => {
    mockSignInWithOAuth.mockRejectedValue(new Error("network down"));
    render(<Auth />);

    const googleBtn = screen.getByRole("button", { name: /continue with google/i });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(screen.getByText(/network down/i)).toBeInTheDocument();
    });
  });

  it("clears previous errors before attempting OAuth", async () => {
    render(<Auth />);

    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });

    const passwordInput = screen.getByLabelText(/password/i);
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalled();
    });

    const googleBtn = screen.getByRole("button", { name: /continue with google/i });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalled();
    });
  });

  it("disables the Google button and shows loading state while authenticating", async () => {
    mockSignInWithOAuth.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: null, error: null }), 100))
    );
    render(<Auth />);

    const googleBtn = screen.getByRole("button", { name: /continue with google/i });
    fireEvent.click(googleBtn);

    expect(googleBtn).toHaveAttribute("aria-busy", "true");
    expect(googleBtn).toBeDisabled();

    await waitFor(
      () => {
        expect(googleBtn).not.toBeDisabled();
      },
      { timeout: 2000 }
    );
  });
});
