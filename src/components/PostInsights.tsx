import React from "react";
import { insightFor } from "@/lib/postInsights";
import { formatForPlatform, niceLabelFor } from "@/lib/platformCopy";

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
  const ins = insightFor(post, platform || "LinkedIn");
  const f = formatForPlatform(post, platform || "LinkedIn");

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 12, background: "rgba(255,255,255,0.008)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#9a9aae", textTransform: "uppercase", letterSpacing: ".12em" }}>Post insights</div>
        <div style={{ fontSize: 11, color: "#7a7a8e" }}>{niceLabelFor(platform)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <div style={{ fontSize: 13 }}>
          <div style={{ color: "#7a7a8e", fontSize: 11 }}>Length</div>
          <div style={{ fontWeight: 600 }}>{f.charCount} chars / {f.limit}</div>
        </div>
        <div style={{ fontSize: 13 }}>
          <div style={{ color: "#7a7a8e", fontSize: 11 }}>Health</div>
          <div style={{ fontWeight: 600 }}>{ins.health}</div>
        </div>
        <div style={{ fontSize: 13 }}>
          <div style={{ color: "#7a7a8e", fontSize: 11 }}>Hashtag density</div>
          <div style={{ fontWeight: 600 }}>{ins.hashtagLabel} · {ins.hashtagState}</div>
        </div>
        <div style={{ fontSize: 13 }}>
          <div style={{ color: "#7a7a8e", fontSize: 11 }}>Hook strength</div>
          <div style={{ fontWeight: 600 }}>{ins.hookScore ? `${Math.round(ins.hookScore * 100)}%` : "—"}</div>
        </div>
      </div>
      {ins.recommendations && ins.recommendations.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#9a9aae" }}>
          <div style={{ marginBottom: 6, color: "#7a7a8e", fontSize: 11 }}>Suggestions</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {ins.recommendations.slice(0, 4).map((r: string, i: number) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
