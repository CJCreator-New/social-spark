import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { IdeaBacklogPanel } from "../IdeaBacklogPanel";
import type { IdeaBacklogRow } from "@/hooks/queries/shared";

afterEach(() => cleanup());

function makeRow(overrides: Partial<IdeaBacklogRow> = {}): IdeaBacklogRow {
  return {
    id: "idea-1",
    user_id: "user-1",
    angle: "Why repurposing beats writing from scratch",
    format: "Contrarian take",
    rationale: "Challenges a common belief.",
    key_points: "Repurposing reuses proven material.",
    source_snippet: "Some source snippet",
    platform: "LinkedIn",
    used_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("IdeaBacklogPanel", () => {
  it("shows the empty state when there are no items", () => {
    render(
      <IdeaBacklogPanel items={[]} onDraftIdea={vi.fn()} onRemoveIdea={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /idea backlog/i }));
    expect(screen.getByText(/no saved ideas yet/i)).toBeInTheDocument();
  });

  it("shows a loading state", () => {
    render(
      <IdeaBacklogPanel items={[]} loading onDraftIdea={vi.fn()} onRemoveIdea={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /idea backlog/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/loading saved ideas/i);
  });

  it("renders a card per item and fires onDraftIdea with the full row", () => {
    const row = makeRow();
    const onDraftIdea = vi.fn();
    render(
      <IdeaBacklogPanel items={[row]} onDraftIdea={onDraftIdea} onRemoveIdea={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /idea backlog/i }));
    expect(screen.getByText(row.angle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /draft this/i }));
    expect(onDraftIdea).toHaveBeenCalledWith(row);
  });

  it("fires onRemoveIdea with the row id", () => {
    const row = makeRow({ id: "idea-42" });
    const onRemoveIdea = vi.fn();
    render(
      <IdeaBacklogPanel items={[row]} onDraftIdea={vi.fn()} onRemoveIdea={onRemoveIdea} />
    );
    fireEvent.click(screen.getByRole("button", { name: /idea backlog/i }));
    fireEvent.click(screen.getByRole("button", { name: /remove idea/i }));
    expect(onRemoveIdea).toHaveBeenCalledWith("idea-42");
  });

  it("disables the remove button and shows a spinner for the row being removed", () => {
    const row = makeRow({ id: "idea-99" });
    render(
      <IdeaBacklogPanel
        items={[row]}
        onDraftIdea={vi.fn()}
        onRemoveIdea={vi.fn()}
        removingId="idea-99"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /idea backlog/i }));
    expect(screen.getByRole("button", { name: /remove idea/i })).toBeDisabled();
  });
});
