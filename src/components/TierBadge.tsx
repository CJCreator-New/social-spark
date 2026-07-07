import { Crown, Zap, Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { WARM_PALETTE } from "@/lib/theme";

const CONFIG = {
  free: {
    label: "Free",
    icon: Sparkles,
    color: WARM_PALETTE.textMuted,
    bg: "hsl(var(--muted))",
    border: "hsl(var(--border))",
  },
  starter: {
    label: "Starter",
    icon: Zap,
    color: WARM_PALETTE.primary,
    bg: "hsl(var(--accent))",
    border: "hsl(var(--primary) / 0.25)",
  },
  pro: {
    label: "Pro",
    icon: Crown,
    color: WARM_PALETTE.primary,
    bg: "hsl(var(--accent))",
    border: "hsl(var(--primary) / 0.25)",
  },
} as const;

/** Small pill showing the user's current effective tier. */
export function TierBadge() {
  const { status, loading } = useSubscription();
  if (loading) return null;

  const cfg = CONFIG[status.effectiveTier];
  const Icon = cfg.icon;
  return (
    <span
      title={`You're on the ${cfg.label} plan`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 10px",
        borderRadius: 99,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <Icon size={12} />
      {cfg.label}
    </span>
  );
}
