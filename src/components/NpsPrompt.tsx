import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trackAnalyticsEvent } from "@/lib/analyticsEvents";

const NPS_KEY_PREFIX = "cf:nps:v1:";
const SCORES = Array.from({ length: 11 }, (_, i) => i);

function storageKey(userId?: string | null) {
  return `${NPS_KEY_PREFIX}${userId || "anon"}`;
}

function alreadyAnswered(userId?: string | null): boolean {
  try {
    return window.localStorage.getItem(storageKey(userId)) !== null;
  } catch {
    return false;
  }
}

function markAnswered(userId?: string | null) {
  try {
    window.localStorage.setItem(storageKey(userId), String(Date.now()));
  } catch {
    // ignore
  }
}

/**
 * One-time NPS survey, shown after the user's first successfully generated
 * calendar (`ready` flips true). Only the numeric score is tracked; the
 * optional note is never sent in the analytics event.
 */
export function NpsPrompt({ ready, userId }: { ready: boolean; userId?: string | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready || open) return;
    if (alreadyAnswered(userId)) return;
    // Mark on show so a reload or a second tab never re-prompts.
    markAnswered(userId);
    setOpen(true);
    trackAnalyticsEvent("nps_shown");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId]);

  if (!open) return null;

  const submit = (score: number) => {
    trackAnalyticsEvent("nps_submitted", { score });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick question</DialogTitle>
          <DialogDescription>
            How likely are you to recommend ContentForge to a colleague? (0 to 10)
          </DialogDescription>
        </DialogHeader>
        <div role="group" aria-label="Likelihood to recommend, 0 to 10" className="flex flex-wrap gap-2">
          {SCORES.map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} out of 10`}
              className="h-9 w-9 rounded-md border border-border text-sm font-medium hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => submit(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="justify-self-end text-sm text-muted-foreground underline"
          onClick={() => setOpen(false)}
        >
          Skip
        </button>
      </DialogContent>
    </Dialog>
  );
}

export default NpsPrompt;
