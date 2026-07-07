import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Crown, Lock } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import type { Tier } from "@/lib/subscription";

interface ProGateProps {
  /** Minimum tier required. Defaults to 'pro'. */
  requires?: Extract<Tier, "starter" | "pro">;
  children: ReactNode;
  /** Optional custom locked-state UI. Falls back to a standard upgrade card. */
  fallback?: ReactNode;
  /** Short label describing the gated feature, used in the default fallback. */
  featureName?: string;
}

const TIER_RANK: Record<Tier, number> = { free: 0, starter: 1, pro: 2 };

/**
 * Renders `children` only when the user's effective tier meets `requires`.
 * Otherwise shows an upgrade prompt (or a custom `fallback`). Note: this is a
 * UX gate only — server-side enforcement is the real boundary.
 */
export function ProGate({ requires = "pro", children, fallback, featureName }: ProGateProps) {
  const { status, loading } = useSubscription();
  if (loading) return null;

  const meets = TIER_RANK[status.effectiveTier] >= TIER_RANK[requires];
  if (meets) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  const label = requires === "pro" ? "Pro" : "Starter";
  return (
    <div
      role="note"
      className="pf-notice"
      style={{
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
        borderColor: "hsl(var(--primary) / 0.2)",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}
        className="text-foreground"
      >
        <Lock size={14} className="text-primary" />
        <span>
          {featureName ? `${featureName} is a ${label} feature` : `This is a ${label} feature`}
        </span>
      </div>
      <Link
        to="/profile?tab=plan"
        className="pf-btn"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}
      >
        <Crown size={14} />
        <span>Upgrade to {label}</span>
      </Link>
    </div>
  );
}
