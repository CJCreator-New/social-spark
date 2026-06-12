import React, { useState } from "react";
import { Post, WizardForm } from "./constants";
import { FontStyle, applyStyle } from "@/lib/unicodeFonts";
import { resolvePlatform, niceLabelFor, formatForPlatform, buildRawMarkdown, writeToClipboard } from "@/lib/platformCopy";
import { suggestedTimeForDay } from "@/lib/postingTimes";
import { shortDateLabel, dateForDow } from "@/lib/calendarSchedule";
import { calculatePerformanceScore } from "@/lib/postPerformanceScore";
import { toast } from "sonner";

import { PerformanceScoreCard } from "@/components/PerformanceScoreCard";
import PostInsights from "@/components/PostInsights";
import { TopicGapBadge } from "@/components/TopicGapBadge";
import { CoverImageGenerator } from "./CoverImageGenerator";

export function hasEmoji(text: string): boolean {
  return /\p{Emoji}/u.test(text);
}

export function formatBadgeForPlatform(format: string, platform: string): string {
  if (resolvePlatform(platform) !== "twitter") return format;
  return /list|bullet|thread/i.test(format) ? "THREAD FORMAT" : "SINGLE TWEET";
}

export function postText(p: Post, getClipboardStyle: () => FontStyle) {
  const text = `${p.title}\n\n${p.hook}\n\n${p.body}\n\n${p.cta}\n\n${p.hashtags}`;
  const style = getClipboardStyle();
  return style === FontStyle.None ? text : applyStyle(text, style);
}

function calculateScore(scores: Record<string, number>): number {
  const keys = Object.keys(scores);
  if (keys.length === 0) return 0;
  const sum = keys.reduce((acc, k) => acc + scores[k], 0);
  return Number((sum / keys.length).toFixed(1));
}

interface PostDetailCardProps {
  post: Post;
  activeDay: number;
  form: WizardForm;
  weekStartDate: Date;
  postTimes: Record<string, string>;
  setPostTimes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  lockedDays: Set<number>;
  toggleLock: (day: number) => void;
  regenerateDay: (idx: number, tweak?: string) => void | Promise<void>;
  regenIdx: number | null;
  reformatting: boolean;
  tweakOpenIdx: number | null;
  setTweakOpenIdx: (idx: number | null) => void;
  getClipboardStyle: () => FontStyle;
  copyPost: (idx: number) => void;
  copiedIdx: number | null;
  copyMenuOpen: boolean;
  setCopyMenuOpen: (open: boolean) => void;
  showRationale: boolean;
  setShowRationale: React.Dispatch<React.SetStateAction<boolean>>;
  enhanceCurrentPost: () => void | Promise<void>;
  tweakRef: React.RefObject<HTMLDivElement | null>;
  copyMenuRef: React.RefObject<HTMLDivElement | null>;
  onFocusedRegenerate?: (metric: any, guidance: string) => void;
  onApplyCta?: (newCta: string) => void;
  onUseAsSeed?: () => void;
  onApplyImage?: (imageUrl: string) => void;
  calendarId?: string;
}

export const PostDetailCard = React.memo(function PostDetailCard({
  post,
  activeDay,
  form,
  weekStartDate,
  postTimes,
  setPostTimes,
  lockedDays,
  toggleLock,
  regenerateDay,
  regenIdx,
  reformatting,
  tweakOpenIdx,
  setTweakOpenIdx,
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
  onFocusedRegenerate,
  onApplyCta,
  onUseAsSeed,
  onApplyImage,
  calendarId,
}: PostDetailCardProps) {
  const [showImageGen, setShowImageGen] = useState(false);
  const niceLabel = niceLabelFor(form.platform);
  const f = formatForPlatform(post, form.platform, { style: getClipboardStyle() });
  const ratio = f.charCount / f.limit;
  const budgetCls = f.charCount > f.limit ? "over" : ratio >= 0.9 ? "warn" : "";

  const isInferred = !form.topics.some(t => t && t.trim().toLowerCase() === post.topic.trim().toLowerCase());

  return (
    <div className="pcard">
      <div className="ph">
        <div className="ptags" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span className="ptag pt-day">Day {post.day} · {post.dow}</span>
          <span className="ptag pt-date">{shortDateLabel(dateForDow(weekStartDate, post.dow))}</span>
          <span className="ptag pt-topic">{post.topic}</span>
          <TopicGapBadge topic={post.topic} rationale={post.rationale} isInferred={isInferred} />
          <span className="ptag pt-fmt">{formatBadgeForPlatform(post.format, form.platform)}</span>
          {post.variant_scores && post.chosen_index !== undefined && post.variant_scores[post.chosen_index] && (() => {
            const s = post.variant_scores[post.chosen_index];
            const avg = calculateScore(s);
            const breakdown = Object.entries(s)
              .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}/5`)
              .join("\n");
            return (
              <span className="ptag pt-fmt" style={{ background: "rgba(255, 215, 0, 0.15)", color: "#FFD700", border: "1px solid rgba(255, 215, 0, 0.3)" }} title={`AI Quality Score (LLM-as-judge)\n\n${breakdown}\n\nSelected from ${post.variant_scores.length} variants.`}>
                ✨ {avg}/5.0
              </span>
            );
          })()}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", position: "relative" }} ref={tweakOpenIdx === activeDay ? tweakRef as any : undefined}>
          {onUseAsSeed && (
            <button
              type="button"
              className="cpbtn"
              onClick={onUseAsSeed}
              title="Start a new calendar using this post as seed"
              style={{ padding: "6px 10px", fontSize: 11 }}
            >
              🔄 Use as seed
            </button>
          )}
          <button
            type="button"
            className={`pin-btn ${lockedDays.has(post.day) ? "on" : ""}`}
            onClick={() => toggleLock(post.day)}
            title={lockedDays.has(post.day) ? "Pinned — won't be touched by 'Regenerate unlocked'" : "Pin this post to protect it"}
            aria-pressed={lockedDays.has(post.day)}
          >
            {lockedDays.has(post.day) ? "📌" : "📍"}
          </button>
          <button
            className="cpbtn"
            onClick={() => regenerateDay(activeDay)}
            disabled={regenIdx !== null || reformatting}
            title="Re-roll this single day without touching the other six"
          >
            {regenIdx === activeDay ? "Regenerating…" : "↻ Regenerate"}
          </button>
          <div className="tweak-wrap">
            <button
              className="cpbtn"
              disabled={regenIdx !== null || reformatting}
              onClick={() => setTweakOpenIdx(tweakOpenIdx === activeDay ? null : activeDay)}
              aria-haspopup="menu"
              aria-expanded={tweakOpenIdx === activeDay}
              title="Quick tweaks that preserve the angle"
            >
              ⚡ Tweak ▾
            </button>
            {tweakOpenIdx === activeDay && (
              <div className="tweak-menu" role="menu">
                <button className="tweak-opt" onClick={() => regenerateDay(activeDay, "shorter")}>Make shorter</button>
                <button className="tweak-opt" onClick={() => regenerateDay(activeDay, "punchier")}>Make punchier</button>
                <button className="tweak-opt" onClick={() => regenerateDay(activeDay, "add-stat")}>Add a stat</button>
                <button
                  className="tweak-opt"
                  onClick={() => regenerateDay(activeDay, "remove-emoji")}
                  disabled={!hasEmoji(post.title + " " + post.hook + " " + post.body + " " + post.cta)}
                  title={!hasEmoji(post.title + " " + post.hook + " " + post.body + " " + post.cta) ? "No emoji detected" : "Remove emojis from this post"}
                >
                  Remove emoji
                </button>
                <button className="tweak-opt" onClick={() => regenerateDay(activeDay, "clean-formatting")}>Clean formatting symbols</button>
                <button className="tweak-opt" onClick={() => regenerateDay(activeDay, "more-personal")}>More personal</button>
                <button className="tweak-opt" onClick={() => regenerateDay(activeDay, "enhance")}>Enhance for performance</button>
              </div>
            )}
          </div>
          <span
            className={`budget ${budgetCls}`}
            title={`Post-format length for ${niceLabel}`}
            aria-label={`${f.charCount} of ${f.limit} characters used for ${niceLabel}`}
          >
            <span className="budget-dot" aria-hidden="true" />
            {f.charCount.toLocaleString()} / {f.limit.toLocaleString()}
          </span>
          <div className="copy-split" ref={copyMenuOpen ? copyMenuRef as any : undefined}>
            <button
              className={`cpbtn copy-split-main ${copiedIdx === activeDay ? "done" : ""}`}
              onClick={() => copyPost(activeDay)}
              title={`${f.charCount} / ${f.limit} chars`}
            >
              {copiedIdx === activeDay ? "Copied ✓" : `Copy for ${niceLabel}`}
            </button>
            <button
              type="button"
              className="copy-split-caret"
              onClick={() => setCopyMenuOpen(!copyMenuOpen)}
              aria-haspopup="menu"
              aria-expanded={copyMenuOpen}
              aria-label="More copy options"
            >
              ▾
            </button>
            {copyMenuOpen && (
              <div className="copy-menu" role="menu">
                <button
                  type="button"
                  className="copy-menu-opt"
                  onClick={async () => {
                    const ok = await writeToClipboard(buildRawMarkdown(post));
                    setCopyMenuOpen(false);
                    if (ok) toast.success("Copied raw markdown ✓");
                    else toast.error("Could not copy");
                  }}
                >
                  Copy as raw markdown
                </button>
                <button
                  type="button"
                  className="copy-menu-opt"
                  onClick={async () => {
                    const ok = await writeToClipboard(postText(post, getClipboardStyle));
                    setCopyMenuOpen(false);
                    if (ok) toast.success("Copied as plain text ✓");
                    else toast.error("Could not copy");
                  }}
                >
                  Copy as plain text (no formatting)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="time-row">
        <span className="time-label">Post time</span>
        <input
          type="time"
          className="time-input"
          value={postTimes[String(post.day)] || suggestedTimeForDay(post.day, form.platform)}
          onChange={e => setPostTimes(prev => ({ ...prev, [String(post.day)]: e.target.value }))}
        />
        <span className="time-hint">{shortDateLabel(dateForDow(weekStartDate, post.dow))} at {postTimes[String(post.day)] || suggestedTimeForDay(post.day, form.platform)}</span>
      </div>

      <div className="ptitle" style={{ marginTop: 18 }}>{post.title}</div>

      <div className="blabel">Hook</div>
      <div className="hook-block"><div className="hook-text">{post.hook}</div></div>

      <div className="blabel">Post body</div>
      <div className="body-text">{post.body}</div>

      <div className="blabel">CTA</div>
      <div className="cta-block">{post.cta}</div>

      <div className="blabel">Hashtags</div>
      <div className="htags">{post.hashtags}</div>

      <div className="blabel" style={{ marginTop: 16 }}>Why this works</div>
      <button
        type="button"
        className="restart"
        onClick={() => setShowRationale(v => !v)}
        style={{ marginTop: 0 }}
      >
        {showRationale ? "Hide reasoning ↑" : "See why this works →"}
      </button>
      {showRationale && <div className="rationale">{post.rationale}</div>}

      <div className="blabel" style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Cinematic image prompt</span>
        <button
          type="button"
          className="cpbtn"
          style={{ padding: "4px 10px", fontSize: 11 }}
          onClick={() => setShowImageGen(true)}
        >
          {post.cover_image ? "🎨 Regenerate Image" : "🎨 Generate Cover Image"}
        </button>
      </div>
      <div className="rationale" style={{ whiteSpace: 'pre-wrap' }}>{post.image_prompt || "No image prompt generated yet."}</div>

      {post.cover_image && (
        <div style={{ marginTop: 12, border: "2px solid var(--color-border)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
          <img src={post.cover_image} alt="Generated cover" style={{ width: "100%", height: "auto", display: "block" }} />
          <button
            type="button"
            className="cpbtn"
            style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.8)", color: "#fff", border: "1px solid #333", padding: "4px 8px", fontSize: 11 }}
            onClick={() => onApplyImage && onApplyImage("")}
          >
            Remove Image
          </button>
        </div>
      )}

      {showImageGen && onApplyImage && (
        <CoverImageGenerator
          post={post}
          calendarId={calendarId || "guest-calendar"}
          onApplyImage={onApplyImage}
          onClose={() => setShowImageGen(false)}
        />
      )}

      <PerformanceScoreCard
        post={post}
        topic={form.coreIdea}
        onEnhance={enhanceCurrentPost}
        onFocusedRegenerate={onFocusedRegenerate}
        onApplyCta={onApplyCta}
      />
      <div style={{ marginTop: 12 }}>
        <PostInsights post={post} platform={form.platform} topic={form.coreIdea} />
      </div>
    </div>
  );
});
