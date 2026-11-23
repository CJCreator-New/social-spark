import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X, Zap, ArrowRight } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { APP_NAME } from "@/constants/branding";
import { Button } from "@/components/ui/button";

export const WELCOME_CARD_KEY = "social_spark_welcome_card_v2";
// Older first-run flags: anyone who already dismissed those should not see the card again.
const LEGACY_KEYS = ["social_spark_welcome_seen", "social_spark_onboarding_completed"];

function readSeen(): boolean {
  try {
    return [WELCOME_CARD_KEY, ...LEGACY_KEYS].some((k) => localStorage.getItem(k) === "true");
  } catch {
    return false;
  }
}

interface WelcomeBannerProps {
  /** Opens the guided steps. */
  onStart?: () => void;
}

/**
 * The single first-run welcome card, shown once per browser. "Start" opens the
 * guided steps; "Skip" dismisses it. The dismissal flag lives in a versioned
 * localStorage key (no backend dependency).
 */
export function WelcomeBanner({ onStart }: WelcomeBannerProps) {
  const { status, loading } = useSubscription();
  const [dismissed, setDismissed] = useState(readSeen);

  if (dismissed) return null;

  const remaining = Math.max(0, status.limit - status.used);
  const showAllowance = !loading && status.effectiveTier === "free";

  function dismiss() {
    try {
      localStorage.setItem(WELCOME_CARD_KEY, "true");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  function start() {
    dismiss();
    onStart?.();
  }

  return (
    <div
      role="note"
      aria-label={`Welcome to ${APP_NAME}`}
      className="relative mb-4 rounded-2xl border border-primary/20 bg-accent p-4"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss welcome message"
        className="absolute right-3 top-3 flex p-0.5 text-muted-foreground"
      >
        <X size={16} />
      </button>

      <div className="mb-1.5 flex items-center gap-2 text-primary">
        <Sparkles size={16} />
        <span className="text-[15px] font-semibold text-foreground">Welcome to {APP_NAME}</span>
      </div>

      <p className="mb-3 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
        Generate a full week of platform-native posts tailored to your niche, voice, and audience.
        Take a short tour, or skip it and start building.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={start}>
          Start
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
          Skip
        </Button>

        {showAllowance && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-card px-2.5 py-1 text-xs font-semibold text-primary">
            <Zap size={12} />
            {remaining} free generation{remaining === 1 ? "" : "s"} left
          </span>
        )}

        <Link
          to="/profile?tab=plan"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground no-underline"
        >
          See plans <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
