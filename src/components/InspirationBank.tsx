import React, { useState, useMemo } from "react";
import { getTrendingTopicsForIndustry, getTrendingTopicsLastUpdated } from "@/lib/trendingTopics";
import { useGenerateTrendsMutation } from "@/hooks/useAppQueries";
import { toast } from "sonner";

interface InspirationBankProps {
  industry: string;
  platform?: string;
  onTopicClick: (topic: string) => void;
}

export const InspirationBank: React.FC<InspirationBankProps> = ({ industry, platform, onTopicClick }) => {
  const staticTopics = useMemo(() => getTrendingTopicsForIndustry(industry, platform), [industry, platform]);
  const staticUpdated = getTrendingTopicsLastUpdated();

  const [customTrends, setCustomTrends] = useState<any[] | null>(null);
  const generateTrendsMutation = useGenerateTrendsMutation();

  const loadAiTrending = async () => {
    try {
      const result = await generateTrendsMutation.mutateAsync({
        industry,
        platform: platform || "LinkedIn"
      });
      setCustomTrends(result);
      toast.success("AI generated trending topics successfully ✓");
    } catch (e) {
      toast.error("Failed to generate trending topics using AI");
      console.error(e);
    }
  };

  // Use AI-generated topics if available, else fallback to local curated topics
  const displayTopics = useMemo(() => {
    if (customTrends && customTrends.length > 0) {
      return customTrends.slice(0, 6);
    }
    return [...staticTopics]
      .sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0))
      .slice(0, 6);
  }, [staticTopics, customTrends]);

  const isAiGenerated = !!customTrends;

  return (
    <div className="inspiration-bank">
      <div className="insp-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div className="insp-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>💡 {isAiGenerated ? "AI Generated Trends" : "Curated Trends"}{platform ? ` on ${platform}` : ""}</span>
            {isAiGenerated && (
              <span style={{ fontSize: 9, padding: "2px 6px", background: "rgba(200,240,154,0.12)", color: "var(--accent)", border: "1px solid rgba(200,240,154,0.2)", borderRadius: 99 }}>
                AI Live
              </span>
            )}
          </div>
          <div className="insp-subtitle">Hot topics real professionals are discussing</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <button
            type="button"
            className="cpbtn"
            style={{ padding: "4px 8px", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 4 }}
            onClick={loadAiTrending}
            disabled={generateTrendsMutation.isPending}
          >
            {generateTrendsMutation.isPending ? "Generating…" : "🔥 Load AI Trending"}
          </button>
          <div className="insp-updated" style={{ fontSize: 9 }}>{isAiGenerated ? "Generated just now" : staticUpdated}</div>
        </div>
      </div>

      <div className="insp-topics">
        {displayTopics.map((t, i) => (
          <button
            key={i}
            className="insp-topic"
            onClick={() => onTopicClick(t.topic)}
            title={`${t.posts} posts this week`}
          >
            <div className="insp-topic-main">
              <span className="insp-topic-name">{t.topic}</span>
              {t.trending && <span className="insp-trending-badge">🔥</span>}
            </div>
            <div className="insp-topic-meta">
              <span className="insp-category">{t.category}</span>
              <span className="insp-count">{(t.posts / 100).toFixed(0)}k posts</span>
            </div>
          </button>
        ))}
      </div>

      <div className="insp-hint">
        ✨ Click any topic to add it to your week. Mix trending topics for maximum reach.
      </div>
    </div>
  );
};
