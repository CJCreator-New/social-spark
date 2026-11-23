import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const trackMock = vi.fn();
vi.mock("@/lib/analyticsEvents", () => ({
  trackAnalyticsEvent: (...args: unknown[]) => trackMock(...args),
}));

import { NpsPrompt } from "../NpsPrompt";

describe("NpsPrompt", () => {
  beforeEach(() => {
    trackMock.mockReset();
    window.localStorage.clear();
  });

  it("renders 11 score buttons labelled 0 to 10", () => {
    render(<NpsPrompt ready userId="u1" />);
    for (let n = 0; n <= 10; n++) {
      expect(screen.getByRole("button", { name: `${n} out of 10` })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button", { name: /out of 10/ })).toHaveLength(11);
  });

  it("does not render before the first calendar is ready", () => {
    render(<NpsPrompt ready={false} userId="u1" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("tracks nps_submitted with only the score", () => {
    render(<NpsPrompt ready userId="u1" />);
    fireEvent.click(screen.getByRole("button", { name: "9 out of 10" }));
    expect(trackMock).toHaveBeenCalledWith("nps_submitted", { score: 9 });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows once: a second mount with the stored key does not render", () => {
    const first = render(<NpsPrompt ready userId="u1" />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    first.unmount();
    render(<NpsPrompt ready userId="u1" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
