import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WelcomeBanner } from "../WelcomeBanner";

const mockUseSubscription = vi.fn();
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => mockUseSubscription(),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to, ...props }, children),
}));

const FREE = { effectiveTier: "free", limit: 10, used: 3 };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockUseSubscription.mockReturnValue({ status: FREE, loading: false });
});

describe("WelcomeBanner", () => {
  it("shows for a new free user with remaining generations", () => {
    render(<WelcomeBanner />);
    expect(screen.getByText(/welcome to social spark/i)).toBeInTheDocument();
    expect(screen.getByText(/7 free generations left/i)).toBeInTheDocument();
  });

  it("does not render for paid (pro) users", () => {
    mockUseSubscription.mockReturnValue({
      status: { ...FREE, effectiveTier: "pro" },
      loading: false,
    });
    const { container } = render(<WelcomeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render while subscription is loading", () => {
    mockUseSubscription.mockReturnValue({ status: FREE, loading: true });
    const { container } = render(<WelcomeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dismissing hides it and persists the seen flag", () => {
    const { container } = render(<WelcomeBanner />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem("social_spark_welcome_seen")).toBe("true");
  });

  it("does not render if previously dismissed", () => {
    localStorage.setItem("social_spark_welcome_seen", "true");
    const { container } = render(<WelcomeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("singularizes the count when one generation remains", () => {
    mockUseSubscription.mockReturnValue({
      status: { ...FREE, limit: 10, used: 9 },
      loading: false,
    });
    render(<WelcomeBanner />);
    expect(screen.getByText(/1 free generation left/i)).toBeInTheDocument();
  });
});
