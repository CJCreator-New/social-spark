import React, { Suspense, useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatForPlatform, niceLabelFor, stripMarkdown } from "@/lib/platformCopy";
import type { PerformanceFocusMetric } from "@/lib/postPerformanceScore";
import { suggestedTimeForDay } from "@/lib/postingTimes";
import { shortDateLabel, dateForDow } from "@/lib/calendarSchedule";
import { WeekStrip } from "@/components/wizard/WeekStrip";
import { PostDetailCard } from "@/components/wizard/PostDetailCard";
import { ToneConsistencyChecker } from "@/components/ToneConsistencyChecker";
import { PerformanceScoreCard } from "@/components/PerformanceScoreCard";
import PostInsights from "@/components/PostInsights";
import { WeekBalanceScore } from "@/components/WeekBalanceScore";
import { BufferScheduler } from "@/components/BufferScheduler";
import { PersonaCompare } from "@/components/PersonaCompare";
import { renderLinkedInPreviewText } from "@/components/wizard/PlatformPreview";
import { useGeneratePostImageMutation } from "@/hooks/useAppQueries";
import { hasEmoji } from "@/components/wizard/PostDetailCard";

import { toast } from "sonner";
import type { Post, WizardForm } from "@/components/wizard/constants";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  Loader2,
  Key,
  Sparkles,
  Check,
  Pin,
  RefreshCw,
  Sliders,
  Image as ImageIcon,
  Eye,
  Download,
  Users,
  Settings,
} from "lucide-react";

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
  handleApplyCompare?: (idx: number, post: Post) => void;
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
  generationMeta: { inferredTopics?: boolean; source?: "ai" | "template_fallback" } | null;
  weekStartDate: Date;
  toggleLockedDay: (day: number) => void;
  handleDragStart: (e: React.DragEvent<HTMLElement>, index: number) => void;
  handleDragOver: (e: React.DragEvent<HTMLElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLElement>, targetIndex: number) => number | null;
  onHashtagsChange?: (idx: number, newHashtags: string) => void;
  onToneShift?: (idx: number, level: number) => void;
  regenerateDay: (
    idx: number,
    tweak?: string,
    focusMetric?: PerformanceFocusMetric,
    guidance?: string
  ) => void | Promise<void>;
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
  handleApplyCompare,
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
  onHashtagsChange,
  onToneShift,
  regenerateDay,
}: IndexResultsProps) {
  const p = posts[activeDay];
  const [personaCompareOpen, setPersonaCompareOpen] = useState(false);
  const [tweakOpenIdx, setTweakOpenIdx] = useState<number | null>(null);
  const [confirmStartOver, setConfirmStartOver] = useState(false);

  // AI Image generation states
  const [pasteImageUrl, setPasteImageUrl] = useState("");
  const [pasteImageOpen, setPasteImageOpen] = useState(false);
  const [toneLevel, setToneLevel] = useState(3);
  const [imagePrompt, setImagePrompt] = useState("");
  const generateImageMutation = useGeneratePostImageMutation();

  useEffect(() => {
    if (p) {
      setImagePrompt(p.image_prompt || `${p.title}. Modern digital art, vector illustration.`);
    }
  }, [p]);

  const handleFieldChange = (field: "title" | "hook" | "body" | "cta", value: string) => {
    const updated = [...posts];
    if (updated[activeDay]) {
      updated[activeDay] = { ...updated[activeDay], [field]: value };
      setPostsWithHistory(updated);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      toast.error("Please enter an image prompt");
      return;
    }
    try {
      const data = await generateImageMutation.mutateAsync({
        calendarId: savedId || "guest-calendar",
        postDay: p.day,
        post: {
          title: p.title,
          hook: p.hook,
          body: p.body,
          cta: p.cta,
          hashtags: p.hashtags,
          topic: p.topic,
          format: p.format,
        },
        prompt: imagePrompt.trim(),
        aspectRatio: "1:1",
      });

      if (data?.publicUrl) {
        handleApplyImage(activeDay, data.publicUrl);
        toast.success("Cover image generated successfully ✓");
      } else {
        throw new Error("No image URL returned");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate image");
    }
  };

  const handleDownloadMd = async () => {
    try {
      const { downloadMd } = await import("@/lib/exportCalendar");
      downloadMd(
        {
          title:
            form.coreIdea.slice(0, 80) ||
            `${selectedIndustry?.label || "Calendar"} — ${form.platform}`,
          industryLabel: selectedIndustry?.label,
          platform: form.platform,
          coreIdea: form.coreIdea,
        },
        posts,
        { style: getClipboardStyle() }
      );
      toast.success("Downloaded .md ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download .md failed");
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const { downloadPdf } = await import("@/lib/exportCalendar");
      downloadPdf(
        {
          title:
            form.coreIdea.slice(0, 80) ||
            `${selectedIndustry?.label || "Calendar"} — ${form.platform}`,
          industryLabel: selectedIndustry?.label,
          platform: form.platform,
          coreIdea: form.coreIdea,
        },
        posts
      );
      toast.success("Downloaded .pdf ✓");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download .pdf failed");
    }
  };

  const niceLabel = niceLabelFor(form.platform);
  const toneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <div className="step4-layout relative">
      <div className="step4-main" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {generationMeta?.source === "template_fallback" && !sampleMode && (
          <div
            className="sample-banner"
            style={{ marginBottom: 0 }}
            role="status"
            data-testid="template-fallback-banner"
          >
            <div className="sample-banner-text">
              <strong>Template fallback content.</strong> Live AI generation was unavailable, so
              this calendar was generated locally from templates — not by the AI model. Results
              may be lower quality; try regenerating once AI generation is available.
            </div>
          </div>
        )}
        {generationMeta?.inferredTopics && !sampleMode && (
          <div className="sample-banner" style={{ marginBottom: 0 }}>
            <div className="sample-banner-text">
              <strong>Topics were inferred.</strong> The generator filled the gap from your core
              idea and industry, so you can still refine the angles later.
            </div>
          </div>
        )}
        {sampleMode && (
          <div className="sample-banner" style={{ marginBottom: 0 }}>
            <div className="sample-banner-text">
              <strong>Sample calendar.</strong> This is a pre-baked example to show you the layout.
              Save isn't available — start your own to keep results.
            </div>
            <button type="button" className="sample-cta" onClick={exitSample}>
              Start my own →
            </button>
          </div>
        )}

        {/* Reformat options */}
        {!sampleMode && (
          <div className="reformat-bar" style={{ marginBottom: 0, padding: 12 }}>
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
            >
              {reformatting ? `Reformatting…` : `Reformat all ${posts.length} →`}
            </button>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              className="reformat-btn"
              style={{
                background: "transparent",
                color: "var(--text2)",
                borderColor: "var(--border2)",
              }}
              disabled={reformatting || regenIdx !== null || lockedDays.size === posts.length}
              onClick={regenerateUnlocked}
            >
              {reformatting && regenIdx !== null ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Re-rolling unlocked posts…
                </span>
              ) : (
                <>↻ Regenerate unlocked ({posts.length - lockedDays.size})</>
              )}
            </button>
          </div>
        )}

        {/* Day navigation tabs list */}
        {posts.length > 1 && (
          <>
            <WeekBalanceScore posts={posts} />
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
              platform={form.platform}
            />
          </>
        )}

        {/* Main Workspace Editor Card */}
        {p && (
          <div className="workspace-editor-card">
            <h2
              className="editor-h"
              style={{ fontSize: 18, fontWeight: 500, color: "var(--text)", marginBottom: 12 }}
            >
              ✏️ Review & Edit Day {p.day}
            </h2>
            <PostDetailCard
              post={p}
              activeDay={activeDay}
              form={form}
              weekStartDate={weekStartDate}
              onHashtagsChange={
                onHashtagsChange ? (newTags) => onHashtagsChange(activeDay, newTags) : undefined
              }
              onFieldChange={handleFieldChange}
              showRationale={showRationale}
              setShowRationale={setShowRationale}
            />
            <ToneConsistencyChecker posts={posts} />
          </div>
        )}

        {/* Workspace navigation/exit actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              if (savedId) {
                clearDraft();
                setPostsWithHistory([]);
                setActiveDay(0);
                setSavedId(null);
                setLockedDays(new Set());
                setStep(1);
                setError("");
              } else {
                setConfirmStartOver(true);
              }
            }}
          >
            ← Start over
          </Button>
          {confirmStartOver && (
            <ConfirmDialog
              title="Start over?"
              message="This will discard your generated posts. This can't be undone unless you've already saved this calendar."
              confirmLabel="Discard and start over"
              onCancel={() => setConfirmStartOver(false)}
              onConfirm={() => {
                setConfirmStartOver(false);
                clearDraft();
                setPostsWithHistory([]);
                setActiveDay(0);
                setSavedId(null);
                setLockedDays(new Set());
                setStep(1);
                setError("");
              }}
            />
          )}
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => {
              setError("");
              setStep(2);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            ✎ Edit Inputs
          </Button>
        </div>
      </div>

      {/* RIGHT SIDE ACTION PANEL */}
      <div className="step4-side" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Section 1: Export & Schedule (Primary CTA) */}
        <div
          className="action-block primary-action"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border2)",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h3
            style={{
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: ".06em",
              color: "var(--accent)",
              fontWeight: 600,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>🚀 Publish & Schedule</span>
          </h3>
          <p style={{ fontSize: 11, color: "var(--text3)", marginBottom: 12 }}>
            Push your calendar updates directly to Buffer or Hootsuite feeds.
          </p>

          <BufferScheduler posts={posts} platform={form.platform} postTimes={postTimes} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            {savedId ? (
              <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                <Link to={`/calendar/${savedId}`}>View saved calendar →</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={saveCalendar}
                disabled={saving || sampleMode}
                title={sampleMode ? "Sample mode — start your own to save" : ""}
              >
                {saving ? "Saving…" : "Save Calendar"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => setBatchEditOpen(true)}
              title="Apply brand mention, hashtag, or CTA to all posts at once"
            >
              ⚙️ Batch Edit
            </Button>
          </div>

          <div style={{ display: "flex", gap: 6, width: "100%", marginTop: 8 }}>
            <Button
              variant="default"
              size="sm"
              className="w-full font-medium"
              style={{ background: "var(--accent)", color: "var(--color-text)" }}
              onClick={copyAll}
            >
              {copiedAll ? "All copied ✓" : `Copy all ${posts.length} posts`}
            </Button>
          </div>

          {/* Export formats group */}
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px dashed color-mix(in srgb, var(--color-surface) 8%, transparent)",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <Button variant="ghost" className="h-8 text-xs p-2" onClick={downloadTxt}>
              .TXT
            </Button>
            <Button variant="ghost" className="h-8 text-xs p-2" onClick={handleDownloadMd}>
              .MD
            </Button>
            <Button variant="ghost" className="h-8 text-xs p-2" onClick={handleDownloadPdf}>
              .PDF
            </Button>
            <Button variant="ghost" className="h-8 text-xs p-2" onClick={exportIcs}>
              📅 .ICS
            </Button>
          </div>
        </div>

        {/* Section 2: Edit & Tweak Panel */}
        {p && (
          <div
            className="action-block"
            style={{
              background: "color-mix(in srgb, var(--color-surface) 2%, transparent)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <h3
              style={{
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: ".06em",
                color: "var(--text2)",
                fontWeight: 600,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Sliders size={14} />
              <span>Tweak & Adjust</span>
            </h3>

            {/* Post Time Input */}
            <div style={{ marginBottom: 14 }}>
              <label
                className="time-label"
                htmlFor={`cf-time-input-${p.day}`}
                style={{ display: "block", fontSize: 11, color: "var(--text3)", marginBottom: 4 }}
              >
                Posting schedule time
              </label>
              <input
                id={`cf-time-input-${p.day}`}
                type="time"
                className="time-input w-full"
                value={postTimes[String(p.day)] || suggestedTimeForDay(p.day, form.platform)}
                onChange={(e) =>
                  setPostTimes((prev) => ({ ...prev, [String(p.day)]: e.target.value }))
                }
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border2)",
                  borderRadius: 6,
                  padding: "5px 8px",
                  fontSize: 12,
                  color: "var(--text)",
                  width: "100%",
                }}
              />
            </div>

            {/* Quick Actions grid: Pin, Regenerate, Persona Compare */}
            <div
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}
            >
              <button
                type="button"
                className={`cpbtn flex justify-center items-center gap-1.5 ${lockedDays.has(p.day) ? "done" : ""}`}
                onClick={() => toggleLock(p.day)}
                style={{ fontSize: 11, padding: "8px 0" }}
              >
                <Pin size={11} />
                <span>{lockedDays.has(p.day) ? "Pinned" : "Pin Post"}</span>
              </button>

              <button
                type="button"
                className="cpbtn flex justify-center items-center gap-1.5"
                onClick={() => regenerateDay(activeDay)}
                disabled={regenIdx !== null || reformatting}
                style={{ fontSize: 11, padding: "8px 0" }}
              >
                <RefreshCw size={11} className={regenIdx === activeDay ? "animate-spin" : ""} />
                <span>{regenIdx === activeDay ? "Re-rolling..." : "Regenerate"}</span>
              </button>
            </div>

            {/* Quick tweaks dropdown */}
            <div
              className="tweak-wrap relative"
              ref={tweakOpenIdx === activeDay ? (tweakRef as any) : undefined}
              style={{ marginBottom: 14 }}
            >
              <button
                className="cpbtn w-full text-center"
                disabled={regenIdx !== null || reformatting}
                onClick={() => setTweakOpenIdx(tweakOpenIdx === activeDay ? null : activeDay)}
                aria-haspopup="menu"
                aria-expanded={tweakOpenIdx === activeDay}
                style={{ padding: "8px 0", width: "100%" }}
              >
                ⚡ Quick Tone Tweaks ▾
              </button>
              {tweakOpenIdx === activeDay && (
                <div
                  className="tweak-menu absolute left-0 right-0 z-50 mt-1 bg-card border border-border rounded-md shadow-xl"
                  role="menu"
                >
                  <button
                    className="tweak-opt w-full text-left p-2 text-xs text-foreground hover:bg-muted"
                    onClick={() => {
                      regenerateDay(activeDay, "shorter");
                      setTweakOpenIdx(null);
                    }}
                  >
                    Make shorter
                  </button>
                  <button
                    className="tweak-opt w-full text-left p-2 text-xs text-foreground hover:bg-muted"
                    onClick={() => {
                      regenerateDay(activeDay, "punchier");
                      setTweakOpenIdx(null);
                    }}
                  >
                    Make punchier
                  </button>
                  <button
                    className="tweak-opt w-full text-left p-2 text-xs text-foreground hover:bg-muted"
                    onClick={() => {
                      regenerateDay(activeDay, "add-stat");
                      setTweakOpenIdx(null);
                    }}
                  >
                    Add a stat
                  </button>
                  <button
                    className="tweak-opt w-full text-left p-2 text-xs text-foreground hover:bg-muted"
                    onClick={() => {
                      regenerateDay(activeDay, "remove-emoji");
                      setTweakOpenIdx(null);
                    }}
                    disabled={!hasEmoji(p.title + " " + p.hook + " " + p.body + " " + p.cta)}
                  >
                    Remove emoji
                  </button>
                  <button
                    className="tweak-opt w-full text-left p-2 text-xs text-foreground hover:bg-muted"
                    onClick={() => {
                      regenerateDay(activeDay, "clean-formatting");
                      setTweakOpenIdx(null);
                    }}
                  >
                    Clean formatting symbols
                  </button>
                  <button
                    className="tweak-opt w-full text-left p-2 text-xs text-foreground hover:bg-muted"
                    onClick={() => {
                      regenerateDay(activeDay, "more-personal");
                      setTweakOpenIdx(null);
                    }}
                  >
                    More personal
                  </button>
                  <button
                    className="tweak-opt w-full text-left p-2 text-xs text-foreground hover:bg-muted"
                    onClick={() => {
                      regenerateDay(activeDay, "enhance");
                      setTweakOpenIdx(null);
                    }}
                  >
                    Enhance for performance
                  </button>
                </div>
              )}
            </div>

            {/* Tone slider register */}
            {onToneShift && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "color-mix(in srgb, var(--color-surface) 2%, transparent)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: "var(--text2)",
                      fontWeight: 500,
                    }}
                  >
                    Tone Register
                  </span>
                  <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 500 }}>
                    {toneLevel === 1
                      ? "Very Formal"
                      : toneLevel === 2
                        ? "Formal"
                        : toneLevel === 3
                          ? "Balanced"
                          : toneLevel === 4
                            ? "Casual"
                            : "Very Casual"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, color: "var(--text3)" }}>Formal</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    aria-label="Tone slider register"
                    value={toneLevel}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setToneLevel(v);
                      if (toneDebounce.current) clearTimeout(toneDebounce.current);
                      toneDebounce.current = setTimeout(() => {
                        if (v !== 3) onToneShift(activeDay, v);
                      }, 700);
                    }}
                    style={{ flex: 1, accentColor: "var(--accent)", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 9, color: "var(--text3)" }}>Casual</span>
                </div>
              </div>
            )}

            {/* Persona comparison */}
            <div style={{ marginTop: 14 }}>
              <button
                type="button"
                className="cpbtn w-full flex justify-center items-center gap-1.5"
                style={{ borderColor: "var(--border2)" }}
                onClick={() => setPersonaCompareOpen(true)}
              >
                <Users size={12} />
                <span>👥 Compare Personas</span>
              </button>
            </div>
          </div>
        )}

        {/* Section 3: AI Image Generation Prompt & Preview */}
        {p && (
          <div
            className="action-block"
            style={{
              background: "color-mix(in srgb, var(--color-surface) 2%, transparent)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <h3
              style={{
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: ".06em",
                color: "var(--text2)",
                fontWeight: 600,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <ImageIcon size={14} />
              <span>AI Cover Image</span>
            </h3>

            <textarea
              className="text-input"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              rows={3}
              aria-label="Describe the image you want to generate"
              style={{
                width: "100%",
                fontSize: 12,
                padding: 8,
                background: "var(--bg)",
                border: "1px solid var(--border2)",
                borderRadius: 6,
                outline: "none",
                resize: "none",
                color: "var(--text)",
                marginBottom: 10,
              }}
              placeholder="Describe the image you want to generate..."
            />

            <button
              type="button"
              onClick={handleGenerateImage}
              disabled={generateImageMutation.isPending}
              className="btn btn-p w-full"
              style={{ padding: "6px", fontSize: 12, width: "100%" }}
            >
              {generateImageMutation.isPending ? "Generating image…" : "✨ Generate cover art"}
            </button>

            <button
              type="button"
              className="cpbtn w-full mt-2"
              onClick={() => setPasteImageOpen(!pasteImageOpen)}
              style={{ padding: "6px", fontSize: 11 }}
            >
              🔗 Paste Image URL
            </button>

            {/* Custom Paste Image block */}
            {pasteImageOpen && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  border: "1px dashed var(--border)",
                  borderRadius: 8,
                }}
              >
                <input
                  type="url"
                  value={pasteImageUrl}
                  onChange={(e) => setPasteImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                  aria-label="Paste Image URL"
                  style={{
                    width: "100%",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    padding: 6,
                    fontSize: 11,
                    color: "var(--text)",
                    borderRadius: 4,
                    outline: "none",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pasteImageUrl.startsWith("http")) {
                      handleApplyImage(activeDay, pasteImageUrl);
                      setPasteImageOpen(false);
                      toast.success("Cover image URL updated");
                    }
                  }}
                />
                <button
                  type="button"
                  className="cpbtn done w-full mt-2"
                  disabled={!pasteImageUrl.startsWith("http")}
                  onClick={() => {
                    handleApplyImage(activeDay, pasteImageUrl);
                    setPasteImageOpen(false);
                    toast.success("Cover image URL updated");
                  }}
                  style={{ fontSize: 10 }}
                >
                  Apply URL
                </button>
              </div>
            )}

            {/* Cover image preview */}
            {p.cover_image && (
              <div
                style={{
                  marginTop: 12,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  position: "relative",
                }}
              >
                <img
                  src={p.cover_image}
                  alt="Post cover art"
                  style={{ display: "block", width: "100%", height: "auto" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    toast.error("Cover image failed to load or invalid URL");
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleApplyImage(activeDay, "")}
                  style={{
                    position: "absolute",
                    bottom: 6,
                    right: 6,
                    background: "color-mix(in srgb, var(--color-text) 85%, transparent)",
                    color: "var(--color-error)",
                    border: "1px solid var(--color-overlay-border)",
                    borderRadius: 4,
                    padding: "2px 6px",
                    fontSize: 9,
                    cursor: "pointer",
                  }}
                >
                  Remove Cover
                </button>
              </div>
            )}
          </div>
        )}

        {/* Section 4: Live feed preview */}
        {p && (
          <div
            className="action-block"
            role="region"
            aria-label="Feed preview"
            style={{
              background: "color-mix(in srgb, var(--color-surface) 2%, transparent)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <h3
              style={{
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: ".06em",
                color: "var(--text2)",
                fontWeight: 600,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Eye size={14} />
              <span>Feed Preview</span>
            </h3>

            <div className="li-preview" style={{ margin: 0 }}>
              <div className="li-head">
                <div className="li-avatar">
                  {(selectedIndustry?.label || form.platform || "C").slice(0, 1)}
                </div>
                <div>
                  <div className="li-name">{selectedIndustry?.label || "ContentForge"}</div>
                  <div className="li-meta">{niceLabel} preview</div>
                </div>
                <div className="li-dot" />
              </div>
              <div className="li-body">
                {(() => {
                  const previewSource = [p.title, p.hook, p.body, p.cta].join("\n\n");
                  const previewPlain = stripMarkdown(previewSource);
                  return (
                    <>
                      <div className="li-content" style={{ fontSize: 12, lineHeight: 1.45 }}>
                        {renderLinkedInPreviewText(previewSource)}
                      </div>
                      {previewPlain.length > 210 && (
                        <>
                          <div className="li-fade" />
                          <div className="li-more">See more</div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="li-tags">
                {p.hashtags
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((tag) => (
                    <span key={tag} className="li-tag">
                      {tag}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Section 5: Performance & Insights */}
        {p && (
          <div
            className="action-block"
            style={{
              background: "color-mix(in srgb, var(--color-surface) 2%, transparent)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 18,
            }}
          >
            <h3
              style={{
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: ".06em",
                color: "var(--text2)",
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              📊 Post Quality Audit
            </h3>

            <PerformanceScoreCard
              post={p}
              topic={form.coreIdea}
              onEnhance={enhanceCurrentPost}
              onFocusedRegenerate={(metric, guidance) =>
                regenerateDay(activeDay, "focused-fix", metric, guidance)
              }
              onApplyCta={(newCta) => handleFieldChange("cta", newCta)}
            />
            <div style={{ marginTop: 12 }}>
              <PostInsights post={p} platform={form.platform} topic={form.coreIdea} />
            </div>
          </div>
        )}

        {/* Section 6: Weekly summary statistics */}
        <div
          className="action-block"
          style={{
            background: "color-mix(in srgb, var(--color-surface) 2%, transparent)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: 18,
          }}
        >
          <h3
            style={{
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: ".06em",
              color: "var(--text2)",
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            📅 Week Summary
          </h3>
          <div className="summary-list">
            <div
              className="summary-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                marginBottom: 6,
              }}
            >
              <span>Total posts</span>
              <strong>{weekSummary.totalPosts}</strong>
            </div>
            <div
              className="summary-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                marginBottom: 6,
              }}
            >
              <span>Average length</span>
              <strong>{weekSummary.avgChars} Chars</strong>
            </div>
            <div
              className="summary-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                marginBottom: 6,
              }}
            >
              <span>In limit</span>
              <strong>{weekSummary.withinLimitPct}%</strong>
            </div>
          </div>
          <div
            className="summary-meta"
            style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}
          >
            {Object.entries(weekSummary.formatCounts)
              .slice(0, 4)
              .map(([label, count]: [string, any]) => (
                <span
                  key={label}
                  className="summary-pill text-[10px]"
                  style={{
                    background: "color-mix(in srgb, var(--color-surface) 4%, transparent)",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  {count} {label.toLowerCase()}
                </span>
              ))}
          </div>
        </div>
      </div>

      {p && (
        <PersonaCompare
          post={p}
          platform={form.platform}
          isOpen={personaCompareOpen}
          onClose={() => setPersonaCompareOpen(false)}
          onApplyCompare={(rewritten) => handleApplyCompare?.(activeDay, rewritten)}
        />
      )}
    </div>
  );
}

export default IndexResults;
