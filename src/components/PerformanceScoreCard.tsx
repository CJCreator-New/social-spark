import React, { useMemo } from "react";
import { Post } from "@/lib/calendarSchedule";
import { calculatePerformanceScore, getScoreColor, getReadabilityLabel } from "@/lib/postPerformanceScore";

interface PerformanceScoreCardProps {
  post: Post;
  topic?: string;
  onEnhance?: () => void;
}

export const PerformanceScoreCard: React.FC<PerformanceScoreCardProps> = ({ post, topic = "", onEnhance }) => {
  const score = useMemo(() => calculatePerformanceScore(post, topic), [post, topic]);

  return (
    <div className="performance-card">
      <div className="perf-header">
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Performance Score</h3>
        <div className="perf-overall">
          <div
            className="perf-score-ring"
            style={{
              background: `conic-gradient(${getScoreColor(score.overallScore)} 0deg ${
                (score.overallScore / 10) * 360
              }deg, var(--border2) ${(score.overallScore / 10) * 360}deg)`,
            }}
          >
            <div className="perf-score-inner">{score.overallScore}</div>
          </div>
          <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500 }}>
            {score.overallScore >= 8 ? "Great" : score.overallScore >= 6 ? "Good" : "Fair"}
          </span>
        </div>
      </div>

      <div className="perf-metrics">
        <div className="perf-metric">
          <div className="perf-metric-label">
            <span>Hook Strength</span>
            <span className="perf-metric-value" style={{ color: getScoreColor(score.hookStrength) }}>
              {score.hookStrength}/10
            </span>
          </div>
          <div className="perf-bar">
            <div
              className="perf-bar-fill"
              style={{
                width: `${(score.hookStrength / 10) * 100}%`,
                background: getScoreColor(score.hookStrength),
              }}
            />
          </div>
        </div>

        <div className="perf-metric">
          <div className="perf-metric-label">
            <span>CTA Effectiveness</span>
            <span className="perf-metric-value" style={{ color: getScoreColor(score.ctaEffectiveness) }}>
              {score.ctaEffectiveness}/10
            </span>
          </div>
          <div className="perf-bar">
            <div
              className="perf-bar-fill"
              style={{
                width: `${(score.ctaEffectiveness / 10) * 100}%`,
                background: getScoreColor(score.ctaEffectiveness),
              }}
            />
          </div>
        </div>

        <div className="perf-metric">
          <div className="perf-metric-label">
            <span>Hashtag Relevance</span>
            <span className="perf-metric-value" style={{ color: getScoreColor(score.hashtagRelevance / 10) }}>
              {score.hashtagRelevance}%
            </span>
          </div>
          <div className="perf-bar">
            <div
              className="perf-bar-fill"
              style={{
                width: `${score.hashtagRelevance}%`,
                background: getScoreColor(score.hashtagRelevance / 10),
              }}
            />
          </div>
        </div>

        <div className="perf-metric">
          <div className="perf-metric-label">
            <span>Readability</span>
            <span className="perf-metric-value" style={{ color: "rgba(200,240,154,.7)" }}>
              {getReadabilityLabel(score.readability)} (Grade {score.readability})
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
            {score.readability < 8
              ? "Easy to follow"
              : score.readability < 12
              ? "Well-balanced"
              : "May need simplification"}
          </div>
        </div>
      </div>

      {score.feedback.length > 0 && (
        <div className="perf-feedback">
          <div style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>
            Suggestions
          </div>
          <div className="perf-tips">
            {score.feedback.slice(0, 3).map((tip, i) => (
              <div key={i} className="perf-tip">
                {tip}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 10, fontStyle: "italic" }}>
        💡 Tip: Higher scores mean better engagement potential. Aim for 7+.
      </div>
      {typeof onEnhance === "function" && (
        <div style={{ marginTop: 10 }}>
          <button className="cpbtn" onClick={onEnhance} style={{ fontSize: 13 }}>
            ✨ Enhance for performance
          </button>
        </div>
      )}
    </div>
  );
};
