import React from "react";
import { Button } from "@/components/ui/button";

export interface WizardDraftRecoverySummary {
  savedAt: number;
  step: number;
  industry: string;
  postCount: number;
}

interface DraftRecoveryDialogProps {
  open: boolean;
  draft: WizardDraftRecoverySummary | null;
  onRestore: () => void;
  onDiscard: () => void;
}

function formatSavedAt(savedAt: number) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(savedAt)
    );
  } catch {
    return new Date(savedAt).toLocaleString();
  }
}

export function DraftRecoveryDialog({
  open,
  draft,
  onRestore,
  onDiscard,
}: DraftRecoveryDialogProps) {
  if (!open || !draft) return null;

  return (
    <div className="card" style={{ maxWidth: 640, margin: "12px auto 18px", display: "block" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18 }}>
            Recover your draft?
          </h3>
          <div style={{ color: "var(--color-text-muted)", marginTop: 6, fontSize: 13 }}>
            A recent wizard snapshot was found in this browser. You can restore it now or discard it
            and start fresh.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" onClick={onDiscard}>
            Discard
          </Button>
          <Button onClick={onRestore}>Restore</Button>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, fontSize: 13, color: "var(--color-text-muted)" }}>
        <div>Saved: {formatSavedAt(draft.savedAt)}</div>
        <div>Step: {draft.step}</div>
        <div>Industry: {draft.industry || "Not selected"}</div>
        <div>Generated posts: {draft.postCount}</div>
      </div>
    </div>
  );
}
