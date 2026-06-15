import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X, Zap, ArrowRight } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

const SEEN_KEY = "social_spark_welcome_seen";

/**
 * Lightweight first-run welcome shown once per browser to orient new users:
 * what the product does, their remaining free generations, and where to start.
 * Dismissible; the "seen" flag lives in localStorage (no backend dependency, so
 * it works regardless of edge-function deploy state).
 */
export function WelcomeBanner() {
  const { status, loading } = useSubscription();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Don't show to returning users, to paid users, or while loading.
  if (dismissed || loading || status.effectiveTier !== "free") return null;

  const remaining = Math.max(0, status.limit - status.used);

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, "true");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div
      role="note"
      aria-label="Welcome to Social Spark"
      style={{
        position: "relative",
        marginBottom: 18,
        padding: "16px 18px",
        borderRadius: 14,
        border: "1px solid rgba(200,240,154,0.22)",
        background: "linear-gradient(135deg, rgba(200,240,154,0.08), rgba(200,240,154,0.02))",
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss welcome message"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "none",
          border: "none",
          color: "#7a7a8e",
          cursor: "pointer",
          padding: 2,
          display: "flex",
        }}
      >
        <X size={16} />
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Sparkles size={16} style={{ color: "#c8f09a" }} />
        <span style={{ fontWeight: 600, color: "#edeae3", fontSize: 15 }}>Welcome to Social Spark</span>
      </div>

      <p style={{ color: "#9a9aae", fontSize: 13, lineHeight: 1.55, margin: "0 0 12px", maxWidth: 560 }}>
        Generate a full week of platform-native posts — tailored to your niche, voice, and audience.
        Pick your niche and platform below, add a few topics, and let the AI draft your calendar.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: "4px 10px",
            borderRadius: 99,
            background: "rgba(200,240,154,0.12)",
            color: "#c8f09a",
            border: "1px solid rgba(200,240,154,0.2)",
          }}
        >
          <Zap size={12} />
          {remaining} free generation{remaining === 1 ? "" : "s"} left
        </span>

        <Link
          to="/profile?tab=plan"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "#9a9aae", textDecoration: "none" }}
        >
          See plans <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
