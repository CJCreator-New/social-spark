import { Crown, Zap, Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

const CONFIG = {
  free: { label: "Free", icon: Sparkles, color: "#9a9aae", bg: "rgba(255,255,255,0.06)", border: "var(--border2)" },
  starter: { label: "Starter", icon: Zap, color: "#c8f09a", bg: "rgba(200,240,154,0.12)", border: "rgba(200,240,154,0.2)" },
  pro: { label: "Pro", icon: Crown, color: "#c8f09a", bg: "rgba(200,240,154,0.12)", border: "rgba(200,240,154,0.2)" },
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
