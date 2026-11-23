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
    expect(screen.getByText(/welcome to contentforge/i)).toBeInTheDocument();
    expect(screen.getByText(/7 free generations left/i)).toBeInTheDocument();
  });

  it("shows for paid users without the free-generation chip", () => {
    mockUseSubscription.mockReturnValue({
      status: { ...FREE, effectiveTier: "pro" },
      loading: false,
    });
    render(<WelcomeBanner />);
    expect(screen.getByText(/welcome to contentforge/i)).toBeInTheDocument();
    expect(screen.queryByText(/free generation/i)).not.toBeInTheDocument();
  });

  it("hides the allowance chip while subscription is loading", () => {
    mockUseSubscription.mockReturnValue({ status: FREE, loading: true });
    render(<WelcomeBanner />);
    expect(screen.queryByText(/free generation/i)).not.toBeInTheDocument();
  });

  it("Start dismisses the card, stores the key and opens the tour", () => {
    const onStart = vi.fn();
    const { container } = render(<WelcomeBanner onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem("social_spark_welcome_card_v2")).toBe("true");
  });

  it("Skip dismisses and stores the versioned key", () => {
    const { container } = render(<WelcomeBanner />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem("social_spark_welcome_card_v2")).toBe("true");
  });

  it("does not show again when a legacy onboarding flag is set", () => {
    localStorage.setItem("social_spark_onboarding_completed", "true");
    const { container } = render(<WelcomeBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dismissing hides it and persists the seen flag", () => {
    const { container } = render(<WelcomeBanner />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(container).toBeEmptyDOMElement();
    expect(localStorage.getItem("social_spark_welcome_card_v2")).toBe("true");
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
