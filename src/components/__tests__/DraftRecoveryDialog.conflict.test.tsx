import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DraftRecoveryDialog } from "../DraftRecoveryDialog";

const conflict = {
  local: { savedAt: Date.now() - 3600_000, step: 2, industry: "tech", postCount: 0 },
  server: { savedAt: Date.now() - 60_000, step: 4, industry: "health", postCount: 5 },
};

describe("DraftRecoveryDialog conflict mode", () => {
  it("shows three choices with time and source for each draft", () => {
    const onRestoreLocal = vi.fn();
    const onRestoreServer = vi.fn();
    const onDiscard = vi.fn();
    render(
      <DraftRecoveryDialog
        open
        draft={null}
        conflict={conflict}
        onRestore={vi.fn()}
        onRestoreLocal={onRestoreLocal}
        onRestoreServer={onRestoreServer}
        onDiscard={onDiscard}
      />
    );

    expect(screen.getByText(/saved in this browser/i)).toBeInTheDocument();
    expect(screen.getByText(/saved in your account/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Saved:/)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Restore local" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore server" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onRestoreLocal).toHaveBeenCalledTimes(1);
    expect(onRestoreServer).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("mentions an expired draft and names the account as source for a server draft", () => {
    render(
      <DraftRecoveryDialog
        open
        draft={conflict.server}
        source="server"
        expiredNotice
        onRestore={vi.fn()}
        onDiscard={vi.fn()}
      />
    );
    expect(screen.getByText(/found in your account/i)).toBeInTheDocument();
    expect(screen.getByText(/older than 24 hours/i)).toBeInTheDocument();
  });
});
