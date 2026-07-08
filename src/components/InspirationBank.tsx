import React, { useState, useMemo, useEffect } from "react";
import {
  getTrendingTopicsForIndustry,
  getTrendingTopicsLastUpdated,
  type TrendingTopic,
} from "@/lib/trendingTopics";
import { useGenerateTrendsMutation } from "@/hooks/useAppQueries";
import { useWizardStore } from "@/stores/useWizardStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Row shape from the `trends` table populated by the trends-ingest cron
// (see supabase/functions/trends-ingest/index.ts). Not present in the
// generated Supabase types yet, so the table name is cast at the query site.
// The table is read-only here; RLS ("authenticated can SELECT true") already
// scopes access appropriately since this is shared, non-personal data.
interface TrendsRow {
  keyword: string;
  category: string;
  volume: number;
  last_seen: string;
}

/** Fetch the live `trends` table, loosely scoped to the given industry via a
 * case-insensitive category match, and adapt rows into the same shape the
 * static curated topic list uses. Resolves to [] on any failure — this is a
 * best-effort enhancement over the static fallback, never a hard dependency. */
async function fetchLiveTrends(industry: string): Promise<TrendingTopic[]> {
  try {
    let query = (supabase.from("trends" as any) as any)
      .select("keyword, category, volume, last_seen")
      .order("volume", { ascending: false })
      .limit(12);
    if (industry) query = query.ilike("category", `%${industry}%`);
    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return (data as TrendsRow[]).map((row) => ({
      topic: row.keyword,
      category: row.category,
      posts: row.volume,
      trending: new Date(row.last_seen).getTime() >= oneDayAgo,
    }));
  } catch {
    return [];
  }
}

interface InspirationBankProps {
  industry: string;
  platform?: string;
  onTopicClick: (topic: string) => void;
  onDraftFromTrend?: (topic: string) => void;
}

export const InspirationBank: React.FC<InspirationBankProps> = ({
  industry,
  platform,
  onTopicClick,
  onDraftFromTrend,
}) => {
  const staticTopics = useMemo(
    () => getTrendingTopicsForIndustry(industry, platform),
    [industry, platform]
  );
  const staticUpdated = getTrendingTopicsLastUpdated();

  const [liveTrends, setLiveTrends] = useState<TrendingTopic[]>([]);
  const [customTrends, setCustomTrends] = useState<any[] | null>(null);
  const [reviewingTopic, setReviewingTopic] = useState<any | null>(null);
  const generateTrendsMutation = useGenerateTrendsMutation();

  const { selectedTrendingTopics, toggleTrendingTopic } = useWizardStore();

  // Best-effort: blend in the real trends-ingest pipeline's data when there's
  // a category match for this industry. Silently keeps the static curated
  // list if the table is empty/unreachable — see fetchLiveTrends above.
  useEffect(() => {
    let cancelled = false;
    fetchLiveTrends(industry).then((rows) => {
      if (!cancelled) setLiveTrends(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [industry]);

  const loadAiTrending = async () => {
    try {
      const result = await generateTrendsMutation.mutateAsync({
        industry,
        platform: platform || "LinkedIn",
      });
      setCustomTrends(result);
      toast.success("AI generated trending topics successfully ✓");
    } catch (e) {
      toast.error("Failed to generate trending topics using AI");
      console.error(e);
    }
  };

  // Priority: explicit AI-generated topics (user action) > live trends-ingest
  // pipeline data (real, but only when it has a category match) > static
  // curated fallback.
  const displayTopics = useMemo(() => {
    if (customTrends && customTrends.length > 0) {
      return customTrends.slice(0, 6);
    }
    if (liveTrends.length > 0) {
      return [...liveTrends].sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0)).slice(0, 6);
    }
    return [...staticTopics]
      .sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0))
      .slice(0, 6);
  }, [staticTopics, customTrends, liveTrends]);

  const isAiGenerated = !!customTrends;
  const isLiveFromPipeline = !customTrends && liveTrends.length > 0;
  const selectionCount = selectedTrendingTopics.length;

  return (
    <div className="inspiration-bank">
      <div
        className="insp-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div>
          <div className="insp-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>
              💡{" "}
              {isAiGenerated
                ? "AI Generated Trends"
                : isLiveFromPipeline
                  ? "Live Trends"
                  : "Curated Trends"}
              {platform ? ` on ${platform}` : ""}
            </span>
            {isAiGenerated && (
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 6px",
                  background: "var(--surface)",
                  color: "var(--accent)",
                  border: "1px solid var(--border2)",
                  borderRadius: 99,
                }}
              >
                AI Live
              </span>
            )}
            {/* Selected count badge — only shown when at least one topic is selected */}
            {selectionCount > 0 && (
              <span
                style={{
                  fontSize: 9,
                  padding: "2px 7px",
                  background: "var(--surface)",
                  color: "var(--accent)",
                  border: "1px solid var(--border2)",
                  borderRadius: 99,
                  fontWeight: 600,
                  letterSpacing: ".03em",
                }}
              >
                {selectionCount} selected for generation
              </span>
            )}
          </div>
          <div className="insp-subtitle">Hot topics real professionals are discussing</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <button
            type="button"
            className="cpbtn"
            style={{
              padding: "4px 8px",
              fontSize: 10,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
            onClick={loadAiTrending}
            disabled={generateTrendsMutation.isPending}
          >
            {generateTrendsMutation.isPending ? "Generating…" : "🔥 Load AI Trending"}
          </button>
          <div className="insp-updated" style={{ fontSize: 9 }}>
            {isAiGenerated ? "Generated just now" : staticUpdated}
          </div>
        </div>
      </div>

      <div className="insp-topics">
        {displayTopics.map((t, i) => {
          const isSelected = selectedTrendingTopics.includes(t.topic);
          return (
            <button
              key={i}
              className="insp-topic"
              onClick={() => setReviewingTopic(t)}
              title={`${t.posts} posts this week`}
              style={
                isSelected
                  ? {
                      borderColor: "var(--accent)",
                      background: "var(--surface)",
                    }
                  : undefined
              }
            >
              <div className="insp-topic-main">
                <span className="insp-topic-name">{t.topic}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {t.trending && <span className="insp-trending-badge">🔥</span>}
                  {isSelected && (
                    <span
                      aria-label="Selected"
                      style={{
                        fontSize: 10,
                        color: "var(--accent)",
                        fontWeight: 700,
                        lineHeight: 1,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </span>
              </div>
              <div className="insp-topic-meta">
                <span className="insp-category">{t.category}</span>
                <span className="insp-count">{new Intl.NumberFormat("en", { notation: "compact" }).format(t.posts)} posts</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="insp-hint">
        ✨ Click any topic to review it. Use <em>Use This Trend</em> inside the review to add it
        for generation.
      </div>

      {reviewingTopic && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
              maxWidth: 400,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
              color: "var(--text)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                Trending Topic Review
              </span>
              {reviewingTopic.trending && <span style={{ fontSize: 12 }}>🔥 Live Trend</span>}
            </div>

            <div>
              <h4
                style={{
                  margin: "2px 0 4px 0",
                  fontSize: 18,
                  fontWeight: 500,
                  color: "var(--text)",
                }}
              >
                {reviewingTopic.topic}
              </h4>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>
                Category: <span style={{ color: "var(--text2)" }}>{reviewingTopic.category}</span>
              </div>
            </div>

            <div
              style={{
                fontSize: 12,
                color: "var(--text2)",
                lineHeight: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div>
                <strong>Weekly Volume:</strong>{" "}
                {new Intl.NumberFormat("en", { notation: "compact" }).format(reviewingTopic.posts)}{" "}
                posts this week
              </div>
              <div
                style={{
                  padding: 12,
                  background: "rgba(255, 255, 255, 0.02)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: 11,
                  color: "var(--text2)",
                }}
              >
                💡 This topic is currently seeing a surge in engagement on{" "}
                {platform || "your selected platform"} among professionals in the {industry} space.
                Adding this topic will optimize your posts for current feed algorithms.
              </div>

              {/* Selection status indicator inside modal */}
              {selectedTrendingTopics.includes(reviewingTopic.topic) && (
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span>✓</span>
                  <span>Already added to generation queue</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <button
                type="button"
                className="cpbtn"
                onClick={() => setReviewingTopic(null)}
                style={{ fontSize: 11, padding: "5px 12px" }}
              >
                Cancel
              </button>

              {/* "Use This Trend" — toggles the topic in the store's selectedTrendingTopics */}
              <button
                type="button"
                className="cpbtn"
                onClick={() => {
                  toggleTrendingTopic(reviewingTopic.topic);
                  const nowSelected = !selectedTrendingTopics.includes(reviewingTopic.topic);
                  toast.success(
                    nowSelected
                      ? `"${reviewingTopic.topic}" added to trend queue ✓`
                      : `"${reviewingTopic.topic}" removed from trend queue`
                  );
                  setReviewingTopic(null);
                }}
                style={{
                  fontSize: 11,
                  padding: "5px 12px",
                  borderColor: selectedTrendingTopics.includes(reviewingTopic.topic)
                    ? "var(--accent)"
                    : undefined,
                  color: selectedTrendingTopics.includes(reviewingTopic.topic)
                    ? "var(--accent)"
                    : undefined,
                }}
              >
                {selectedTrendingTopics.includes(reviewingTopic.topic)
                  ? "✓ Remove from Trends"
                  : "Use This Trend"}
              </button>

              {onDraftFromTrend && (
                <button
                  type="button"
                  className="cpbtn done"
                  onClick={() => {
                    onDraftFromTrend(reviewingTopic.topic);
                    setReviewingTopic(null);
                    toast.success(`Drafting post from trend: "${reviewingTopic.topic}" ✓`);
                  }}
                  style={{ fontSize: 11, padding: "5px 12px" }}
                >
                  ✍️ Draft from this trend
                </button>
              )}

              <button
                type="button"
                className="cpbtn done"
                onClick={() => {
                  onTopicClick(reviewingTopic.topic);
                  setReviewingTopic(null);
                  toast.success(`Added "${reviewingTopic.topic}" to selection ✓`);
                }}
                style={{ fontSize: 11, padding: "5px 12px" }}
              >
                Confirm &amp; Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
