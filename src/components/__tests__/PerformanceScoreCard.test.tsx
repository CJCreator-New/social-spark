import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Post } from "@/lib/calendarSchedule";

const sendEventMock = vi.fn();
vi.mock("@/lib/telemetry", () => ({
  sendEvent: (...args: unknown[]) => sendEventMock(...args),
}));

vi.mock("@/stores/useWizardStore", () => ({
  useWizardStore: (selector: (state: any) => unknown) =>
    selector({ keySource: "system", keyMode: "fallback", form: { bannedWords: [] } }),
}));

const READABLE_BODY =
  "This is a fairly balanced sentence about testing that should land near a typical readability grade for social content.";

// Weak hook, everything else reasonably strong — so getWeakestMetrics()[0]
// deterministically resolves to "hookStrength" and the overall score stays
// below the < 7 threshold that gates the "Fix" button.
const hookWeakPost: Post = {
  day: 1,
  dow: "Mon",
  topic: "Testing",
  format: "Balanced mix",
  title: "Title",
  hook: "Ok",
  body: READABLE_BODY,
  cta: "Thanks for reading",
  hashtags: "#testing",
  rationale: "",
  platform: "LinkedIn",
} as Post;

// Weak CTA, moderate (not strong) hook, moderate hashtags — getWeakestMetrics()[0]
// resolves to "ctaEffectiveness" and the overall score stays below the < 7
// threshold that gates the "Fix" button. The hook deliberately avoids the
// strong-opener/question-mark/short-hook patterns in scoreHookStrength so it
// lands at the ~6 baseline, not high enough to blow the overall score past 7.
const ctaWeakPost: Post = {
  day: 1,
  dow: "Mon",
  topic: "Testing",
  format: "Balanced mix",
  title: "Title",
  hook: "Some thoughts on testing you might find useful today",
  body: READABLE_BODY,
  cta: "ok",
  hashtags: "#testing #random",
  rationale: "",
  platform: "LinkedIn",
} as Post;

import { PerformanceScoreCard } from "../PerformanceScoreCard";

describe("PerformanceScoreCard telemetry", () => {
  beforeEach(() => {
    sendEventMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not fire any telemetry event on mere render", () => {
    render(
      <PerformanceScoreCard
        post={hookWeakPost}
        topic="Testing"
        onFocusedRegenerate={vi.fn()}
        onApplyCta={vi.fn()}
      />
    );
    expect(sendEventMock).not.toHaveBeenCalled();
  });

  it("fires hook_regenerate_clicked with the platform + priorHookScore when the Fix-hook button is clicked", () => {
    const onFocusedRegenerate = vi.fn();
    render(
      <PerformanceScoreCard
        post={hookWeakPost}
        topic="Testing"
        onFocusedRegenerate={onFocusedRegenerate}
      />
    );
    const fixButton = screen.getByRole("button", { name: /^🎯 Fix: Weak Hook/ });
    fireEvent.click(fixButton);

    expect(onFocusedRegenerate).toHaveBeenCalledTimes(1);
    expect(sendEventMock).toHaveBeenCalledTimes(1);
    expect(sendEventMock).toHaveBeenCalledWith("hook_regenerate_clicked", {
      platform: "LinkedIn",
      priorHookScore: 3,
    });
  });

  it("fires cta_regenerate_clicked with the platform + priorCtaScore when the Fix-CTA button is clicked", () => {
    const onFocusedRegenerate = vi.fn();
    render(
      <PerformanceScoreCard
        post={ctaWeakPost}
        topic="Testing"
        onFocusedRegenerate={onFocusedRegenerate}
      />
    );
    const fixButton = screen.getByRole("button", { name: /^🎯 Fix: Weak CTA/ });
    fireEvent.click(fixButton);

    expect(onFocusedRegenerate).toHaveBeenCalledTimes(1);
    expect(sendEventMock).toHaveBeenCalledTimes(1);
    expect(sendEventMock).toHaveBeenCalledWith("cta_regenerate_clicked", {
      platform: "LinkedIn",
      priorCtaScore: 2,
    });
  });

  it("fires cta_suggestion_applied when the suggested CTA chip is clicked", () => {
    const onApplyCta = vi.fn();
    render(<PerformanceScoreCard post={ctaWeakPost} topic="Testing" onApplyCta={onApplyCta} />);

    const suggestionButton = screen.getByTitle("Click to apply this suggestion");
    fireEvent.click(suggestionButton);

    expect(onApplyCta).toHaveBeenCalledTimes(1);
    expect(sendEventMock).toHaveBeenCalledWith("cta_suggestion_applied", {
      platform: "LinkedIn",
      priorCtaScore: 2,
    });
  });
});
