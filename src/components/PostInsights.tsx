import React from "react";
import { insightFor } from "@/lib/postInsights";
import { formatForPlatform, niceLabelFor } from "@/lib/platformCopy";
import { useWizardStore } from "@/stores/useWizardStore";

interface Post {
  day: number;
  dow: string;
  topic: string;
  format: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string;
  rationale: string;
  hook_options?: string[];
  cta_options?: string[];
  variant_scores?: Record<string, number>[];
  chosen_index?: number;
}

export default function PostInsights({ post, platform, topic }: { post: Post; platform?: string; topic?: string }) {
  const keySource = useWizardStore((state) => state.keySource);
  const keyMode = useWizardStore((state) => state.keyMode);
  const ins = insightFor(post, platform || "LinkedIn");
  const f = formatForPlatform(post, platform || "LinkedIn");

  const percentOfLimit = Math.round((f.charCount / f.limit) * 100);
  const healthColor =
    ins.health === "good" ? "#15803d" :
    ins.health === "warn" ? "#a16207" :
    "#b91c1c";
  const healthTooltip =
    ins.health === "good" ? "No warning signs detected. Looking good!" :
    ins.health === "warn" ? "Some minor issues found (e.g. sparse hashtags or close to character limits)." :
    "Critical issues found (e.g. over the character limit or too many hashtags).";

  const aiEngagement =
    ins.hookScore && ins.hookScore >= 0.7 ? "High" :
    ins.hookScore && ins.hookScore >= 0.4 ? "Medium" : "Low";
  const aiEngagementStyle =
    aiEngagement === "High"  ? { background: "#dcfce7", color: "#15803d" } :
    aiEngagement === "Medium" ? { background: "#fef9c3", color: "#a16207" } :
                                { background: "#fee2e2", color: "#b91c1c" };

  return (
    <div style={{
      border: "1px solid #e7e5e4",
      borderRadius: 12,
      padding: 16,
      background: "#ffffff",
      boxShadow: "0 4px 20px rgba(120,113,108,0.04)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #f5f5f4" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#44403c", textTransform: "uppercase", letterSpacing: ".08em", fontFamily: "var(--font-display,'Lora',Georgia,serif)" }}>
            Editorial Insights
          </div>
          {keySource === "user" && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: "600",
                background: "#ffedd5",
                color: "#c2410c",
                padding: "1px 6px",
                borderRadius: "4px",
                border: "1px solid #ffedd5",
              }}
              title={keyMode === "always" ? "Your API key is set as the primary provider" : "Your API key was used as a fallback"}
            >
              {keyMode === "always" ? "Your key · Always" : "Your key · Fallback"}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#78716c", fontWeight: 500 }}>{niceLabelFor(platform)}</div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 13 }}>
          <div style={{ color: "#78716c", fontSize: 11, marginBottom: 2 }}>Length</div>
          <div style={{ fontWeight: 600, color: "#1c1917" }}>{f.charCount.toLocaleString()} / {f.limit.toLocaleString()} <span style={{ fontWeight: 400, color: "#78716c" }}>({percentOfLimit}%)</span></div>
        </div>
        <div style={{ fontSize: 13 }} title={healthTooltip}>
          <div style={{ color: "#78716c", fontSize: 11, marginBottom: 2 }}>Health</div>
          <div style={{ fontWeight: 600, color: healthColor, textTransform: "capitalize" }}>{ins.health}</div>
        </div>
        <div style={{ fontSize: 13 }}>
          <div style={{ color: "#78716c", fontSize: 11, marginBottom: 2 }}>Hashtags</div>
          <div style={{ fontWeight: 600, color: "#1c1917" }}>{ins.hashtagLabel} <span style={{ fontWeight: 400, color: "#78716c" }}>· {ins.hashtagState}</span></div>
        </div>
        <div style={{ fontSize: 13 }}>
          <div style={{ color: "#78716c", fontSize: 11, marginBottom: 2 }}>Hook strength</div>
          <div style={{ fontWeight: 600, color: "#1c1917" }}>{ins.hookScore ? `${Math.round(ins.hookScore * 100)}%` : "—"}</div>
        </div>
      </div>

      {/* AI Predicted Engagement row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px dashed #e7e5e4", marginBottom: ins.recommendations?.length ? 10 : 0 }}>
        <span style={{ fontSize: 12, color: "#44403c", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
          AI Predicted Engagement
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 3, ...aiEngagementStyle }}>
          {aiEngagement}
        </span>
      </div>

      {/* Suggestions */}
      {ins.recommendations && ins.recommendations.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12 }}>
          <div style={{ marginBottom: 6, color: "#78716c", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Suggestions</div>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {ins.recommendations.slice(0, 4).map((r: string, i: number) => (
              <li key={i} style={{ color: "#57534e", paddingLeft: 14, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: "#c2410c", fontWeight: 600 }}>→</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
