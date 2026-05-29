import React, { useMemo } from "react";
import { getTrendingTopicsForIndustry, getTrendingTopicsLastUpdated } from "@/lib/trendingTopics";

interface InspirationBankProps {
  industry: string;
  platform?: string;
  onTopicClick: (topic: string) => void;
}

export const InspirationBank: React.FC<InspirationBankProps> = ({ industry, platform, onTopicClick }) => {
  const topics = useMemo(() => getTrendingTopicsForIndustry(industry, platform), [industry, platform]);
  const lastUpdated = getTrendingTopicsLastUpdated();

  // Show top 6 trending topics
  const displayTopics = [...topics]
    .sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0))
    .slice(0, 6);

  return (
    <div className="inspiration-bank">
      <div className="insp-header">
        <div>
          <div className="insp-title">💡 Trending this week{platform ? ` on ${platform}` : ""}</div>
          <div className="insp-subtitle">Hot topics real professionals are discussing</div>
        </div>
        <div className="insp-updated">{lastUpdated}</div>
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
