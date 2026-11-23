import React from "react";
import { Button } from "@/components/ui/button";

export interface WizardDraftRecoverySummary {
  savedAt: number;
  step: number;
  industry: string;
  postCount: number;
}

export type DraftSource = "local" | "server";

export const DRAFT_SOURCE_LABEL: Record<DraftSource, string> = {
  local: "this browser",
  server: "your account",
};

interface DraftRecoveryDialogProps {
  open: boolean;
  /** Single draft to recover (no conflict). */
  draft: WizardDraftRecoverySummary | null;
  /** Where the single draft came from. Defaults to this browser. */
  source?: DraftSource;
  /** When both a local and a server draft exist and differ, show both and ask. */
  conflict?: { local: WizardDraftRecoverySummary; server: WizardDraftRecoverySummary } | null;
  /** A draft older than the 24 hour limit was dropped. */
  expiredNotice?: boolean;
  onRestore: () => void;
  onRestoreLocal?: () => void;
  onRestoreServer?: () => void;
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

function ConflictOption({
  source,
  summary,
}: {
  source: DraftSource;
  summary: WizardDraftRecoverySummary;
}) {
  return (
    <div className="rounded-md border p-3 text-sm" data-testid={`draft-option-${source}`}>
      <div className="font-medium">Saved in {DRAFT_SOURCE_LABEL[source]}</div>
      <div>Saved: {formatSavedAt(summary.savedAt)}</div>
      <div>
        Step {summary.step}, {summary.postCount} generated posts
        {summary.industry ? `, ${summary.industry}` : ""}
      </div>
    </div>
  );
}

export function DraftRecoveryDialog({
  open,
  draft,
  source = "local",
  conflict,
  expiredNotice,
  onRestore,
  onRestoreLocal,
  onRestoreServer,
  onDiscard,
}: DraftRecoveryDialogProps) {
  if (open && conflict) {
    return (
      <div
        className="card mx-auto mb-4 mt-3 block max-w-[640px]"
        role="alertdialog"
        aria-label="Choose which draft to keep"
      >
        <h3 className="m-0 font-display text-lg">Two different drafts found</h3>
        <div className="mt-1.5 text-[13px] text-muted-foreground">
          The draft in this browser and the draft on your account do not match. Choose which one to
          keep. The other one will be replaced.
        </div>
        {expiredNotice && (
          <div className="mt-2 text-xs text-muted-foreground">
            A draft older than 24 hours was removed.
          </div>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ConflictOption source="local" summary={conflict.local} />
          <ConflictOption source="server" summary={conflict.server} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={onRestoreLocal}>Restore local</Button>
          <Button onClick={onRestoreServer}>Restore server</Button>
          <Button variant="outline" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </div>
    );
  }

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
            A recent wizard snapshot was found in {DRAFT_SOURCE_LABEL[source]}. You can restore it
            now or discard it and start fresh.
          </div>
          {expiredNotice && (
            <div className="mt-2 text-xs text-muted-foreground">
              A draft older than 24 hours was removed.
            </div>
          )}
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
        <div>Source: {DRAFT_SOURCE_LABEL[source]}</div>
        <div>Step: {draft.step}</div>
        <div>Industry: {draft.industry || "Not selected"}</div>
        <div>Generated posts: {draft.postCount}</div>
      </div>
    </div>
  );
}
