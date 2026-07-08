import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { fetchHookCtaInsights } from "@/lib/insights/hookCtaInsights";
import { WorkspacePage } from "@/components/layout/WorkspacePage";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/SkeletonList";
import { APP_NAME } from "@/constants/branding";

const STAT_CARDS: Array<{
  key: "hookRegenerateCount" | "ctaSuggestionAppliedCount" | "ctaRegenerateCount" | "postsKept" | "postsRegeneratedAgain";
  label: string;
}> = [
  { key: "hookRegenerateCount", label: "Hooks regenerated" },
  { key: "ctaSuggestionAppliedCount", label: "CTA suggestions applied" },
  { key: "ctaRegenerateCount", label: "CTAs regenerated" },
  { key: "postsKept", label: "Posts kept as-is" },
  { key: "postsRegeneratedAgain", label: "Posts regenerated again before saving" },
];

export default function Insights() {
  const { user } = useAuth();
  const {
    data: insights,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["hookCtaInsights", user?.id],
    queryFn: () => fetchHookCtaInsights(30),
    enabled: !!user,
  });

  const isEmpty =
    !!insights &&
    insights.hookRegenerateCount === 0 &&
    insights.ctaRegenerateCount === 0 &&
    insights.ctaSuggestionAppliedCount === 0 &&
    insights.postsKept === 0 &&
    insights.postsRegeneratedAgain === 0;

  const byPlatformEntries = insights ? Object.entries(insights.byPlatform) : [];
  const maxPlatformCount = byPlatformEntries.reduce((max, [, count]) => Math.max(max, count), 0);

  return (
    <>
      <Helmet>
        <title>Insights — {APP_NAME}</title>
      </Helmet>
      <WorkspacePage size="wide">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--color-text)" }}>
          Hook &amp; CTA insights
        </h1>
        <p className="text-sm mt-1 mb-6" style={{ color: "var(--color-text-secondary)" }}>
          A look at how often you fine-tune hooks and CTAs, and how often those changes stick — over
          the last 30 days.
        </p>

        {isLoading && <SkeletonList rows={5} />}

        {!isLoading && isError && (
          <ErrorState
            title="Couldn't load insights"
            description="Something went wrong while fetching your insights. Please try again."
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && insights && isEmpty && (
          <div className="flex flex-col gap-6">
            <div
              className="rounded-2xl border border-dashed p-8 text-center"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface-muted)",
                color: "var(--color-text-secondary)",
              }}
            >
              <p className="mb-4">Not enough data yet — regenerate a few hooks or CTAs to see insights here.</p>
              <Link
                to="/app"
                className="inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold"
                style={{
                  background: "var(--color-primary)",
                  color: "var(--color-surface)",
                }}
              >
                Go to Generator →
              </Link>
            </div>
            <div
              className="rounded-2xl border p-6"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface)",
              }}
            >
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--color-text)" }}>
                Tips for Better Hooks &amp; CTAs
              </h3>
              <ul className="text-xs space-y-2 list-disc pl-4" style={{ color: "var(--color-text-secondary)" }}>
                <li><strong>Start strong:</strong> Use a contrarian hook or ask a question that challenges common industry beliefs.</li>
                <li><strong>Clear Call to Action:</strong> Keep CTAs focused on a single next step (e.g., "repost this" or "drop a comment below").</li>
                <li><strong>A/B Test your tone:</strong> Shift between technical/analytical and conversational styles using the slider inside the calendar workspace.</li>
              </ul>
            </div>
          </div>
        )}

        {!isLoading && !isError && insights && !isEmpty && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {STAT_CARDS.map(({ key, label }) => (
                <div
                  key={key}
                  className="rounded-2xl border p-5"
                  style={{
                    borderColor: "var(--color-border)",
                    background: "var(--color-surface)",
                  }}
                >
                  <div
                    className="text-3xl font-semibold tabular-nums"
                    style={{ color: "var(--color-primary)" }}
                  >
                    {insights[key]}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--color-text-secondary)" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {byPlatformEntries.length > 0 && (
              <div
                className="mt-8 rounded-2xl border p-5"
                style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
              >
                <h2
                  className="text-xs font-semibold uppercase tracking-wide mb-4"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  By platform
                </h2>
                <div className="flex flex-col gap-3">
                  {byPlatformEntries
                    .sort((a, b) => b[1] - a[1])
                    .map(([platform, count]) => (
                      <div key={platform} className="flex items-center gap-3">
                        <span
                          className="text-xs w-24 shrink-0 truncate"
                          style={{ color: "var(--color-text)" }}
                          title={platform}
                        >
                          {platform}
                        </span>
                        <div
                          className="flex-1 rounded-full h-2 overflow-hidden"
                          style={{ background: "var(--color-surface-hover)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${maxPlatformCount ? (count / maxPlatformCount) * 100 : 0}%`,
                              background: "var(--color-primary)",
                            }}
                          />
                        </div>
                        <span
                          className="text-xs w-8 text-right tabular-nums"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          {count}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </WorkspacePage>
    </>
  );
}
