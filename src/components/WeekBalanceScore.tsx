import React, { useMemo } from "react";
import type { Post } from "@/components/wizard/constants";

interface WeekBalanceScoreProps {
  posts: Post[];
}

interface BalanceWarning {
  type: "consecutive_format" | "repeated_topic" | "poor_distribution" | "all_same_format";
  message: string;
}

interface BalanceResult {
  score: number; // 0-100
  label: "Excellent" | "Good" | "Fair" | "Needs Work";
  color: string;
  barColor: string;
  warnings: BalanceWarning[];
}

function computeWeekBalance(posts: Post[]): BalanceResult {
  if (posts.length === 0) return { score: 100, label: "Excellent", color: "#c8f09a", barColor: "#c8f09a", warnings: [] };

  const warnings: BalanceWarning[] = [];
  let deductions = 0;

  // 1) Format diversity: penalize if all posts are the same format
  const formats = posts.map(p => (p.format || "").toLowerCase());
  const uniqueFormats = new Set(formats);
  if (uniqueFormats.size === 1 && posts.length >= 3) {
    warnings.push({ type: "all_same_format", message: `All ${posts.length} posts use the same format (${formats[0]}). Mix in lists, stories, or tips for variety.` });
    deductions += 25;
  } else if (uniqueFormats.size <= 2 && posts.length >= 5) {
    warnings.push({ type: "all_same_format", message: "Low format variety — try mixing opinion posts, how-tos, and list formats." });
    deductions += 12;
  }

  // 2) Consecutive same format penalty
  let maxConsec = 1, cur = 1;
  for (let i = 1; i < formats.length; i++) {
    if (formats[i] === formats[i - 1]) { cur++; maxConsec = Math.max(maxConsec, cur); }
    else cur = 1;
  }
  if (maxConsec >= 3) {
    warnings.push({ type: "consecutive_format", message: `${maxConsec} consecutive posts share the same format. Stagger different styles.` });
    deductions += maxConsec >= 4 ? 20 : 10;
  }

  // 3) Topic diversity: penalize repeated topics
  const topics = posts.map(p => (p.topic || "").toLowerCase().trim());
  const topicCounts: Record<string, number> = {};
  for (const t of topics) { topicCounts[t] = (topicCounts[t] || 0) + 1; }
  const repeated = Object.entries(topicCounts).filter(([, c]) => c > 1);
  if (repeated.length > 0) {
    const repeatedNames = repeated.map(([t]) => t).join(", ");
    warnings.push({ type: "repeated_topic", message: `Repeated topics: "${repeatedNames}". Each day should ideally cover a distinct angle.` });
    deductions += repeated.reduce((acc, [, c]) => acc + (c - 1) * 8, 0);
  }

  // 4) CTA distribution: if all CTAs look the same, flag it
  const ctas = posts.map(p => (p.cta || "").toLowerCase().slice(0, 30));
  const uniqueCtas = new Set(ctas);
  if (uniqueCtas.size <= 1 && posts.length >= 3) {
    warnings.push({ type: "poor_distribution", message: "CTAs look similar across posts — vary your calls-to-action for better engagement spread." });
    deductions += 10;
  }

  const score = Math.max(0, Math.min(100, 100 - deductions));

  let label: BalanceResult["label"];
  let color: string;
  let barColor: string;

  if (score >= 80) { label = "Excellent"; color = "#c8f09a"; barColor = "#c8f09a"; }
  else if (score >= 60) { label = "Good"; color = "#a3d977"; barColor = "#a3d977"; }
  else if (score >= 40) { label = "Fair"; color = "#f0d49a"; barColor = "#f0d49a"; }
  else { label = "Needs Work"; color = "#f09a9a"; barColor = "#f09a9a"; }

  return { score, label, color, barColor, warnings };
}

export const WeekBalanceScore: React.FC<WeekBalanceScoreProps> = ({ posts }) => {
  const balance = useMemo(() => computeWeekBalance(posts), [posts]);
  const [expanded, setExpanded] = React.useState(false);

  if (posts.length < 2) return null;

  return (
    <div
      style={{
        marginBottom: 14,
        padding: "10px 14px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        cursor: balance.warnings.length > 0 ? "pointer" : "default",
      }}
      onClick={() => balance.warnings.length > 0 && setExpanded(v => !v)}
      role={balance.warnings.length > 0 ? "button" : undefined}
      aria-expanded={balance.warnings.length > 0 ? expanded : undefined}
      title={balance.warnings.length > 0 ? "Click to see balance details" : undefined}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text2)", fontWeight: 500, whiteSpace: "nowrap" }}>
          Week Balance
        </div>
        <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${balance.score}%`,
              background: balance.barColor,
              borderRadius: 99,
              transition: "width .4s ease",
            }}
          />
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: balance.color, whiteSpace: "nowrap" }}>
          {balance.label}
          {balance.warnings.length > 0 && (
            <span style={{ marginLeft: 5, opacity: 0.7 }}>{expanded ? "▲" : "▼"}</span>
          )}
        </div>
      </div>
      {expanded && balance.warnings.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {balance.warnings.map((w, i) => (
            <div
              key={i}
              style={{
                fontSize: 11, color: "var(--text2)", padding: "7px 10px",
                background: "rgba(255,255,255,0.02)", borderRadius: 8,
                border: "1px solid var(--border)", lineHeight: 1.5,
              }}
            >
              ⚠️ {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WeekBalanceScore;
