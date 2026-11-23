import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import { OnboardingTour } from "../OnboardingTour";

function setup() {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <OnboardingTour onClose={onClose} />
    </MemoryRouter>
  );
  return onClose;
}

describe("OnboardingTour", () => {
  it("renders as a modal dialog with a named close button", () => {
    setup();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = setup();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("has a Set up your brand step linking to the Profile brand tab", () => {
    setup();
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/set up your brand/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /brand settings/i })).toHaveAttribute(
      "href",
      "/profile?tab=brand"
    );
  });
});
