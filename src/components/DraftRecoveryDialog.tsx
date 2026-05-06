import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(savedAt));
  } catch {
    return new Date(savedAt).toLocaleString();
  }
}

export function DraftRecoveryDialog({ open, draft, onRestore, onDiscard }: DraftRecoveryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) onDiscard();
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recover your draft?</DialogTitle>
          <DialogDescription>
            A recent wizard snapshot was found in this browser. You can restore it now or discard it and start fresh.
          </DialogDescription>
        </DialogHeader>

        {draft && (
          <div style={{ display: "grid", gap: 10, fontSize: 13, color: "#7a7a8e" }}>
            <div>Saved: {formatSavedAt(draft.savedAt)}</div>
            <div>Step: {draft.step}</div>
            <div>Industry: {draft.industry || "Not selected"}</div>
            <div>Generated posts: {draft.postCount}</div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onDiscard}>Discard</Button>
          <Button onClick={onRestore}>Restore</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}