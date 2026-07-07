import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockGetSession = vi.fn();
const mockGetAuthorizationDetails = vi.fn();
const mockApproveAuthorization = vi.fn();
const mockDenyAuthorization = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      oauth: {
        getAuthorizationDetails: (...args: unknown[]) => mockGetAuthorizationDetails(...args),
        approveAuthorization: (...args: unknown[]) => mockApproveAuthorization(...args),
        denyAuthorization: (...args: unknown[]) => mockDenyAuthorization(...args),
      },
    },
  },
}));

vi.mock("react-router-dom", () => ({
  useSearchParams: () => [new URLSearchParams("authorization_id=auth_123")],
}));

vi.mock("react-helmet-async", () => ({
  Helmet: () => null,
}));

import OAuthConsent from "../OAuthConsent";

const originalLocation = window.location;

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
  // jsdom's window.location.href setter doesn't navigate; make it observable.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, href: "https://app.example/oauth/consent" },
  });
});

describe("OAuthConsent", () => {
  it("renders requested scopes as a list before approval", async () => {
    mockGetAuthorizationDetails.mockResolvedValue({
      data: {
        client: { name: "Test MCP Client" },
        scopes: ["read:calendars", "read:scheduled_posts"],
        redirect_url: "https://client.example/callback",
      },
      error: null,
    });

    render(<OAuthConsent />);

    await waitFor(() => {
      expect(screen.getByText("read:calendars")).toBeInTheDocument();
    });
    expect(screen.getByText("read:scheduled_posts")).toBeInTheDocument();
  });

  it("marks the approve/deny buttons as busy while a decision is in flight", async () => {
    mockGetAuthorizationDetails.mockResolvedValue({
      data: {
        client: { name: "Test MCP Client" },
        scopes: ["read:calendars"],
        redirect_url: "https://client.example/callback",
      },
      error: null,
    });
    mockApproveAuthorization.mockReturnValue(new Promise(() => {})); // never resolves

    render(<OAuthConsent />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /working/i })).toHaveAttribute(
        "aria-busy",
        "true"
      );
    });
    expect(screen.getByRole("button", { name: /deny/i })).toHaveAttribute("aria-busy", "true");
  });

  it("rejects a javascript: redirect target instead of navigating (F-014)", async () => {
    mockGetAuthorizationDetails.mockResolvedValue({
      data: {
        client: { name: "Test MCP Client" },
        scopes: ["read:calendars"],
        redirect_url: "https://client.example/callback",
      },
      error: null,
    });
    mockApproveAuthorization.mockResolvedValue({
      data: { redirect_url: "javascript:alert(1)" },
      error: null,
    });

    render(<OAuthConsent />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/invalid|no valid redirect/i);
    });
    expect(window.location.href).toBe("https://app.example/oauth/consent");
  });

  it("navigates to a valid https redirect target on approval", async () => {
    mockGetAuthorizationDetails.mockResolvedValue({
      data: {
        client: { name: "Test MCP Client" },
        scopes: ["read:calendars"],
        redirect_url: "https://client.example/callback",
      },
      error: null,
    });
    mockApproveAuthorization.mockResolvedValue({
      data: { redirect_url: "https://client.example/callback?code=abc" },
      error: null,
    });

    render(<OAuthConsent />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /approve/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(window.location.href).toBe("https://client.example/callback?code=abc");
    });
  });
});
