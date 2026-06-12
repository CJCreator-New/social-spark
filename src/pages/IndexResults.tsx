import React, { Suspense } from "react";
import { formatForPlatform, niceLabelFor, stripMarkdown } from "@/lib/platformCopy";
import { suggestedTimeForDay } from "@/lib/postingTimes";
import { shortDateLabel, dateForDow } from "@/lib/calendarSchedule";
import { isEnabled } from "@/lib/featureFlags";
import { WeekStrip } from "@/components/wizard/WeekStrip";
import { PostDetailCard } from "@/components/wizard/PostDetailCard";
import { ToneConsistencyChecker } from "@/components/ToneConsistencyChecker";
import { PerformanceScoreCard } from "@/components/PerformanceScoreCard";
import PostInsights from "@/components/PostInsights";
import { renderLinkedInPreviewText } from "@/components/wizard/PlatformPreview";
import { toast } from "sonner";
import type { Post, WizardForm } from "@/components/wizard/constants";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface IndexResultsProps {
  posts: Post[];
  activeDay: number;
  setActiveDay: React.Dispatch<React.SetStateAction<number>>;
  lockedDays: Set<number>;
  toggleLock: (day: number) => void;
  form: WizardForm;
  savedId: string | null;
  setSavedId: (id: string | null) => void;
  sampleMode: boolean;
  exitSample: () => void;
  reformatTarget: string;
  setReformatTarget: (t: string) => void;
  reformatting: boolean;
  regenIdx: number | null;
  regenerateUnlocked: () => void;
  reformatAllForPlatform: (target: string) => void;
  draggedIndex: number | null;
  setDraggedIndex: (idx: number | null) => void;
  handleDayDrop: (idx: number) => void;
  postTimes: Record<string, string>;
  setPostTimes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  getClipboardStyle: () => any;
  copyPost: (idx: number) => void;
  copiedIdx: number | null;
  copyMenuOpen: boolean;
  setCopyMenuOpen: (o: boolean) => void;
  showRationale: boolean;
  setShowRationale: React.Dispatch<React.SetStateAction<boolean>>;
  enhanceCurrentPost: () => void;
  tweakRef: React.RefObject<HTMLDivElement | null>;
  copyMenuRef: React.RefObject<HTMLDivElement | null>;
  handleFocusedRegenerate: (metric: any, guidance: string) => void;
  handleApplyCta: (idx: number, newCta: string) => void;
  handleUseAsSeed: (post: Post) => void;
  handleApplyImage: (idx: number, imageUrl: string) => void;
  saveCalendar: () => void;
  saving: boolean;
  downloadTxt: () => void;
  exportIcs: () => void;
  setBatchEditOpen: (o: boolean) => void;
  copyAll: () => void;
  copiedAll: boolean;
  showPerformance: boolean;
  setShowPerformance: (p: boolean) => void;
  weekSummary: any;
  selectedIndustry: any;
  setStep: (s: number) => void;
  clearDraft: () => void;
  setPostsWithHistory: (p: Post[] | ((prev: Post[]) => Post[])) => void;
  setLockedDays: (s: Set<number>) => void;
  setError: (err: string) => void;
  generationMeta: { inferredTopics?: boolean } | null;
  weekStartDate: Date;
  toggleLockedDay: (day: number) => void;
  handleDragStart: (e: React.DragEvent<HTMLElement>, index: number) => void;
  handleDragOver: (e: React.DragEvent<HTMLElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLElement>, targetIndex: number) => number | null;
}

export function IndexResults({
  posts,
  activeDay,
  setActiveDay,
  lockedDays,
  toggleLock,
  form,
  savedId,
  setSavedId,
  sampleMode,
  exitSample,
  reformatTarget,
  setReformatTarget,
  reformatting,
  regenIdx,
  regenerateUnlocked,
  reformatAllForPlatform,
  draggedIndex,
  setDraggedIndex,
  handleDayDrop,
  postTimes,
  setPostTimes,
  getClipboardStyle,
  copyPost,
  copiedIdx,
  copyMenuOpen,
  setCopyMenuOpen,
  showRationale,
  setShowRationale,
  enhanceCurrentPost,
  tweakRef,
  copyMenuRef,
  handleFocusedRegenerate,
  handleApplyCta,
  handleUseAsSeed,
  handleApplyImage,
  saveCalendar,
  saving,
  downloadTxt,
  exportIcs,
  setBatchEditOpen,
  copyAll,
  copiedAll,
  showPerformance,
  setShowPerformance,
  weekSummary,
  selectedIndustry,
  setStep,
  clearDraft,
  setPostsWithHistory,
  setLockedDays,
  setError,
  generationMeta,
  weekStartDate,
  toggleLockedDay,
  handleDragStart,
  handleDragOver,
  handleDrop,
}: IndexResultsProps) {
  const p = posts[activeDay];

  const handleDownloadMd = async () => {
    try {
      const { downloadMd } = await import("@/lib/exportCalendar");
      downloadMd({
        title: form.coreIdea.slice(0, 80) || `${selectedIndustry?.label || "Calendar"} — ${form.platform}`,
        industryLabel: selectedIndustry?.label,
        platform: form.platform,
        coreIdea: form.coreIdea,
      }, posts, { style: getClipboardStyle() });
      toast.success("Downloaded .md ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download .md failed");
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const { downloadPdf } = await import("@/lib/exportCalendar");
      downloadPdf({
        title: form.coreIdea.slice(0, 80) || `${selectedIndustry?.label || "Calendar"} — ${form.platform}`,
        industryLabel: selectedIndustry?.label,
        platform: form.platform,
        coreIdea: form.coreIdea,
      }, posts);
      toast.success("Downloaded .pdf ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download .pdf failed");
    }
  };

  return (
    <div className="step4-layout">
      <div className="step4-main">
        <>
          {generationMeta?.inferredTopics && !sampleMode && (
            <div className="sample-banner" style={{ marginBottom: 14 }}>
              <div className="sample-banner-text">
                <strong>Topics were inferred.</strong> The generator filled the gap from your core idea and industry, so you can still refine the angles later.
              </div>
            </div>
          )}
          {sampleMode && (
            <div className="sample-banner">
              <div className="sample-banner-text">
                <strong>Sample calendar.</strong> This is a pre-baked example to show you the layout.
                Save isn't available — start your own to keep results.
              </div>
              <button type="button" className="sample-cta" onClick={exitSample}>Start my own →</button>
            </div>
          )}

          {!sampleMode && (
            <div className="reformat-bar">
              <span className="reformat-label">Reformat for</span>
              <select
                className="reformat-sel"
                value={reformatTarget}
                onChange={(e) => setReformatTarget(e.target.value)}
                disabled={reformatting || regenIdx !== null}
                aria-label="Choose another platform to reformat for"
              >
                <option value="">Another platform…</option>
                {form.platform && niceLabelFor(form.platform) && (
                  <>
                    {form.platform !== "LinkedIn" && <option value="LinkedIn">LinkedIn</option>}
                    {form.platform !== "Twitter/X" && <option value="Twitter/X">Twitter/X</option>}
                    {form.platform !== "Instagram" && <option value="Instagram">Instagram</option>}
                    {form.platform !== "Facebook" && <option value="Facebook">Facebook</option>}
                    {form.platform !== "Newsletter" && <option value="Newsletter">Newsletter</option>}
                    {form.platform !== "Blog" && <option value="Blog">Blog</option>}
                  </>
                )}
              </select>
              <button
                type="button"
                className="reformat-btn"
                disabled={!reformatTarget || reformatting || regenIdx !== null}
                onClick={() => reformatAllForPlatform(reformatTarget)}
                title="Re-runs all 7 posts; saved as a new calendar"
              >
                {reformatting ? `Reformatting… ${regenIdx !== null ? `(${regenIdx + 1}/${posts.length})` : ""}` : `Reformat all ${posts.length} →`}
              </button>
              <span style={{ flex: 1 }} />
              <button
                type="button"
                className="reformat-btn"
                style={{ background: "transparent", color: "var(--text2)", borderColor: "var(--border2)" }}
                disabled={reformatting || regenIdx !== null || lockedDays.size === posts.length}
                onClick={regenerateUnlocked}
                title="Re-roll only the days you haven't pinned"
              >
                {reformatting && regenIdx !== null ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Re-rolling {posts.length - lockedDays.size} posts…
                  </span>
                ) : (
                  <>↻ Regenerate unlocked ({posts.length - lockedDays.size})</>
                )}
              </button>
            </div>
          )}

          {posts.length > 1 && (
            <WeekStrip
              posts={posts}
              activeDay={activeDay}
              setActiveDay={setActiveDay}
              lockedDays={lockedDays}
              draggedIndex={draggedIndex}
              setDraggedIndex={setDraggedIndex}
              handleDayDrop={handleDayDrop}
              handleDragStart={handleDragStart}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
            />
          )}
          {p && (
            <div>
              <PostDetailCard
                post={p}
                activeDay={activeDay}
                form={form}
                weekStartDate={weekStartDate}
                postTimes={postTimes}
                setPostTimes={setPostTimes}
                lockedDays={lockedDays}
                toggleLock={toggleLock}
                regenerateDay={undefined as any} // we will pass callbacks
                regenIdx={regenIdx}
                reformatting={reformatting}
                tweakOpenIdx={null}
                setTweakOpenIdx={() => {}}
                getClipboardStyle={getClipboardStyle}
                copyPost={copyPost}
                copiedIdx={copiedIdx}
                copyMenuOpen={copyMenuOpen}
                setCopyMenuOpen={setCopyMenuOpen}
                showRationale={showRationale}
                setShowRationale={setShowRationale}
                enhanceCurrentPost={enhanceCurrentPost}
                tweakRef={tweakRef}
                copyMenuRef={copyMenuRef}
                onFocusedRegenerate={handleFocusedRegenerate}
                onApplyCta={(newCta) => handleApplyCta(activeDay, newCta)}
                onUseAsSeed={() => handleUseAsSeed(p)}
                onApplyImage={(imageUrl) => handleApplyImage(activeDay, imageUrl)}
                calendarId={savedId || undefined}
              />
              <ToneConsistencyChecker posts={posts} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Button
              variant="ghost"
              size="default"
              className="min-h-11"
              onClick={() => { clearDraft(); setPostsWithHistory([]); setActiveDay(0); setSavedId(null); setLockedDays(new Set()); setStep(1); setError(""); }}
            >
              ← Start over
            </Button>
            <Button
              variant="ghost"
              size="default"
              className="min-h-11"
              onClick={() => { setError(""); setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            >
              ✎ Edit inputs
            </Button>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="default"
                className="min-h-11"
                onClick={saveCalendar}
                disabled={saving || !!savedId || sampleMode}
                title={sampleMode ? "Sample mode — start your own to save" : ""}
              >
                {sampleMode ? "Save (sample only)" : savedId ? "Saved ✓" : saving ? "Saving…" : "Save calendar"}
              </Button>
              <Button variant="outline" size="default" className="min-h-11" onClick={downloadTxt}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6.5 1v7M4 5.5l2.5 2.5L9 5.5M1 9.5v1A1.5 1.5 0 002.5 12h8A1.5 1.5 0 0012 10.5v-1" />
                </svg>
                .txt
              </Button>
              <Button variant="outline" size="default" className="min-h-11" onClick={handleDownloadMd}>.md</Button>
              <Button variant="outline" size="default" className="min-h-11" onClick={handleDownloadPdf}>.pdf</Button>
              <Button
                variant="outline"
                size="default"
                className="min-h-11"
                onClick={exportIcs}
                title="Export to Google Calendar / Outlook / Apple Cal"
              >
                📅 .ics
              </Button>
              <Button
                variant="outline"
                size="default"
                className="min-h-11"
                onClick={() => setBatchEditOpen(true)}
                title="Apply brand mention, hashtag, or CTA to all 7 posts at once (Ctrl+Shift+E)"
              >
                ⚙️ Batch edit
              </Button>
              <Button variant="default" size="default" className="min-h-11" onClick={copyAll}>
                {copiedAll ? "All copied ✓" : `Copy all ${posts.length} for ${niceLabelFor(form.platform)}`}
              </Button>
            </div>
          </div>
        </>
      </div>
      <div className="step4-side">
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button
            className={`cpbtn ${!showPerformance ? "done" : ""}`}
            onClick={() => setShowPerformance(false)}
            style={{ flex: 1, textAlign: "center" }}
            title="Week summary and stats"
          >
            Week Summary
          </button>
          <button
            className={`cpbtn ${showPerformance ? "done" : ""}`}
            onClick={() => setShowPerformance(true)}
            style={{ flex: 1, textAlign: "center" }}
            title="Performance score for current post"
            disabled={!posts[activeDay]}
          >
            Performance
          </button>
        </div>

        {!showPerformance ? (
          <div className="summary-card">
            <div className="summary-head">
              <div>
                <div className="sh" style={{ marginBottom: 6 }}>Week at a glance</div>
                <div className="time-hint">A fast read before you copy, tweak, or save.</div>
              </div>
              <div className="summary-stat">
                <b>{weekSummary.totalPosts}</b>
                <span>Posts</span>
              </div>
            </div>
            <div className="summary-list">
              <div className="summary-row"><span>Average length</span><strong>{weekSummary.avgChars} chars</strong></div>
              <div className="summary-row"><span>Within platform limit</span><strong>{weekSummary.withinLimitPct}%</strong></div>
              <div className="summary-row"><span>Hashtags per post</span><strong>{weekSummary.hashtagCounts.length ? weekSummary.hashtagCounts.join(" · ") : "—"}</strong></div>
            </div>
            <div className="summary-meta">
              {Object.entries(weekSummary.formatCounts).slice(0, 4).map(([label, count]: [string, any]) => (
                <span key={label} className="summary-pill">{count} {label.toLowerCase()}</span>
              ))}
            </div>
            <div className="summary-list" style={{ marginTop: 14 }}>
              {weekSummary.postingTimes.map((slot: any) => (
                <div key={slot.day} className="summary-row">
                  <span>Day {slot.day} · {slot.dow}</span>
                  <strong>{slot.time}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : posts[activeDay] ? (
          <>
            <PerformanceScoreCard post={posts[activeDay]} topic={form.coreIdea} onEnhance={enhanceCurrentPost} />
            <div style={{ marginTop: 12 }}>
              <PostInsights post={posts[activeDay]} platform={form.platform} topic={form.coreIdea} />
            </div>
          </>
        ) : null}

        {posts[activeDay] && (
          <div className="li-preview">
            <div className="li-head">
              <div className="li-avatar">{(selectedIndustry?.label || form.platform || "C").slice(0, 1)}</div>
              <div>
                <div className="li-name">{selectedIndustry?.label || "ContentForge"}</div>
                <div className="li-meta">{niceLabelFor(form.platform)} preview</div>
              </div>
              <div className="li-dot" />
            </div>
            <div className="li-body">
              {(() => {
                const previewSource = [posts[activeDay].title, posts[activeDay].hook, posts[activeDay].body, posts[activeDay].cta].join("\n\n");
                const previewPlain = stripMarkdown(previewSource);
                return (
                  <>
                    <div className="li-content">{renderLinkedInPreviewText(previewSource)}</div>
                    {previewPlain.length > 210 && <><div className="li-fade" /><div className="li-more">See more</div></>}
                  </>
                );
              })()}
            </div>
            <div className="li-tags">
              {posts[activeDay].hashtags.split(/\s+/).filter(Boolean).map(tag => <span key={tag} className="li-tag">{tag}</span>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default IndexResults;
