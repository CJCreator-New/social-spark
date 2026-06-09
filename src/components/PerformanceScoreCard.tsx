import React, { useMemo } from "react";
import { Post } from "@/lib/calendarSchedule";
import { useWizardStore } from "@/stores/useWizardStore";
import {
  calculatePerformanceScore,
  getScoreColor,
  getReadabilityLabel,
  getRegenerationGuidance,
  getWeakestMetrics,
  suggestBetterCta,
  PerformanceFocusMetric
} from "@/lib/postPerformanceScore";

interface PerformanceScoreCardProps {
  post: Post;
  topic?: string;
  onEnhance?: () => void;
  onFocusedRegenerate?: (metric: PerformanceFocusMetric, guidance: string) => void;
  onApplyCta?: (newCta: string) => void;
}

const METRIC_LABELS: Record<PerformanceFocusMetric, string> = {
  hookStrength: "Weak Hook",
  ctaEffectiveness: "Weak CTA",
  hashtagRelevance: "Hashtags",
  readability: "Readability",
};

export const PerformanceScoreCard: React.FC<PerformanceScoreCardProps> = ({
  post,
  topic = "",
  onEnhance,
  onFocusedRegenerate,
  onApplyCta,
}) => {
  const keySource = useWizardStore((state) => state.keySource);
  const keyMode = useWizardStore((state) => state.keyMode);

  const score = useMemo(() => calculatePerformanceScore(post, topic), [post, topic]);

  const weakestMetrics = useMemo(() => getWeakestMetrics(score), [score]);
  const weakestMetric = weakestMetrics[0];

  const suggestedCtaText = useMemo(() => {
    if (score.ctaEffectiveness < 6) {
      return suggestBetterCta(post.cta, topic || post.topic, post.platform);
    }
    return null;
  }, [score.ctaEffectiveness, post.cta, topic, post.topic, post.platform]);

  return (
    <div className="performance-card">
      <div className="perf-header">
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
          <span>Performance Score</span>
          {keySource === "user" && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: "600",
                background: "rgba(200, 240, 154, 0.12)",
                color: "#c8f09a",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid rgba(200, 240, 154, 0.2)"
              }}
              title={keyMode === "always" ? "Your API key is set as the primary provider" : "Your API key was used as a fallback"}
            >
              {keyMode === "always" ? "Your key · Always" : "Your key · Fallback"}
            </span>
          )}
        </h3>
        <div className="perf-overall">
          <div
            className="perf-score-ring"
            style={{
              background: `conic-gradient(${getScoreColor(score.overallScore)} 0deg ${
                (score.overallScore / 10) * 360
              }deg, var(--border2) ${(score.overallScore / 10) * 360}deg)`,
            }}
          >
            <div className="perf-score-inner tabular-nums">{score.overallScore}</div>
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
            <span className="perf-metric-value tabular-nums" style={{ color: getScoreColor(score.hookStrength) }}>
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
            <span className="perf-metric-value tabular-nums" style={{ color: getScoreColor(score.ctaEffectiveness) }}>
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
          {suggestedCtaText && onApplyCta && (
            <div className="cta-suggestion-container" style={{ marginTop: 6 }}>
              <span style={{ fontSize: 10, color: "var(--text3)" }}>Suggested CTA:</span>
              <button
                className="cta-suggestion-chip"
                onClick={() => onApplyCta(suggestedCtaText)}
                title="Click to apply this suggestion"
                type="button"
              >
                "{suggestedCtaText.length > 50 ? suggestedCtaText.slice(0, 50) + "..." : suggestedCtaText}" →
              </button>
            </div>
          )}
        </div>

        <div className="perf-metric">
          <div className="perf-metric-label">
            <span>Hashtag Relevance</span>
            <span className="perf-metric-value tabular-nums" style={{ color: getScoreColor(score.hashtagRelevance / 10) }}>
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
              {getReadabilityLabel(score.readability)} (<span className="tabular-nums">Grade {score.readability}</span>)
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

      <div className="perf-actions" style={{ marginTop: 12, display: "flex", gap: 8, flexDirection: "column" }}>
        {typeof onEnhance === "function" && (
          <button className="cpbtn" onClick={onEnhance} style={{ fontSize: 13, width: "100%" }}>
            ✨ Enhance for performance
          </button>
        )}

        {score.overallScore < 7 && weakestMetric && onFocusedRegenerate && (
          <button
            className="cpbtn font-mono"
            onClick={() => onFocusedRegenerate(weakestMetric, getRegenerationGuidance(weakestMetric))}
            style={{
              fontSize: 12,
              width: "100%",
              borderColor: "var(--text-accent)",
              background: "rgba(200, 240, 154, 0.05)",
              color: "var(--text-accent)"
            }}
          >
            🎯 Fix: {METRIC_LABELS[weakestMetric]}
          </button>
        )}
      </div>
    </div>
  );
};
