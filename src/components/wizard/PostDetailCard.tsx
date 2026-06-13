import React, { useState, useRef, useCallback } from "react";
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
import { useGeneratePostImageMutation } from "@/hooks/useAppQueries";

import { HashtagChipEditor } from "@/components/HashtagChipEditor";

export function hasEmoji(text: string): boolean {
  return /\p{Emoji}/u.test(text);
}

export function formatBadgeForPlatform(format: string, platform: string): string {
  if (resolvePlatform(platform) !== "twitter") return format;
  return /list|bullet|thread/i.test(format) ? "THREAD FORMAT" : "SINGLE TWEET";
}

function cssAspectRatioForPlatform(platform?: string): string {
  const normalized = resolvePlatform(platform || "");
  if (normalized === "instagram") return "4 / 5";
  if (normalized === "twitter") return "16 / 9";
  return "1.91 / 1";
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
  onHashtagsChange?: (newHashtags: string) => void;
  onToneShift?: (level: number) => void;
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
  onHashtagsChange,
  onToneShift,
  calendarId,
}: PostDetailCardProps) {

  const [pasteImageUrl, setPasteImageUrl] = useState("");
  const [pasteImageOpen, setPasteImageOpen] = useState(false);
  const [toneLevel, setToneLevel] = useState(3); // 1=Formal, 5=Casual
  const [prompt, setPrompt] = useState(post.image_prompt || `${post.title}. Modern digital art, vector illustration.`);
  const generateMutation = useGeneratePostImageMutation();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter an image prompt");
      return;
    }
    try {
      const data = await generateMutation.mutateAsync({
        calendarId: calendarId || "guest-calendar",
        postDay: post.day,
        post: {
          title: post.title,
          hook: post.hook,
          body: post.body,
          cta: post.cta,
          hashtags: post.hashtags,
          topic: post.topic,
          format: post.format,
        },
        prompt: prompt.trim(),
        aspectRatio: "1:1",
      });

      if (data?.publicUrl) {
        if (onApplyImage) onApplyImage(data.publicUrl);
        toast.success("Cover image generated successfully ✓");
      } else {
        throw new Error("No image URL returned");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate image");
    }
  };

  const toneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
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

      {/* ── Tone Slider ──────────────────────────────────────────────────── */}
      {onToneShift && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text2)", fontWeight: 500 }}>Tone</span>
            <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 500 }}>
              {toneLevel === 1 ? "Very Formal" : toneLevel === 2 ? "Formal" : toneLevel === 3 ? "Balanced" : toneLevel === 4 ? "Casual" : "Very Casual"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "var(--text3)" }}>Formal</span>
            <input
              type="range" min="1" max="5" step="1"
              value={toneLevel}
              onChange={e => {
                const v = Number(e.target.value);
                setToneLevel(v);
                if (toneDebounce.current) clearTimeout(toneDebounce.current);
                toneDebounce.current = setTimeout(() => {
                  if (v !== 3) onToneShift(v);
                }, 700);
              }}
              style={{ flex: 1, accentColor: "var(--accent)", cursor: "pointer" }}
            />
            <span style={{ fontSize: 10, color: "var(--text3)" }}>Casual</span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 5, fontStyle: "italic" }}>Adjusts register only — content and structure stay the same</div>
        </div>
      )}

      <div className="blabel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Hashtags</span>
      </div>
      {onHashtagsChange ? (
        <HashtagChipEditor
          hashtags={post.hashtags}
          platform={form.platform}
          onChange={onHashtagsChange}
        />
      ) : (
        <div className="htags">{post.hashtags}</div>
      )}

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
        <span>Image generation prompt</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            type="button"
            className="cpbtn"
            style={{ padding: "4px 10px", fontSize: 11 }}
            onClick={() => setPasteImageOpen(v => !v)}
            title="Paste your own image URL to preview it inline"
          >
            🔗 Paste URL
          </button>
        </div>
      </div>
      
      <div style={{ marginTop: 8, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
        <textarea
          className="text-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          style={{ width: "100%", fontSize: 13, padding: 10, background: "transparent", border: "none", outline: "none", resize: "none", color: "var(--text)" }}
          placeholder="Describe the image you want to generate..."
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, marginBottom: 12 }}>
          {["Photorealistic", "Flat design", "3D render", "Hand-drawn", "Data visual", "Abstract"].map(style => (
            <button
              key={style}
              type="button"
              className={`chip ${prompt.includes(style) ? "on" : ""}`}
              onClick={() => {
                if (prompt.includes(style)) {
                  setPrompt(prompt.replace(new RegExp(`\\b${style}\\b,?\\s*`, "gi"), "").trim());
                } else {
                  setPrompt(prompt ? `${prompt}, ${style}` : style);
                }
              }}
              style={{ fontSize: 11, padding: "4px 10px", margin: 0, border: prompt.includes(style) ? "1px solid var(--accent)" : "1px solid var(--border)" }}
            >
              {style}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="btn btn-p"
          style={{ width: "100%", padding: "8px", fontSize: 13 }}
        >
          {generateMutation.isPending ? "Generating..." : "Generate prompt"}
        </button>
      </div>
      {pasteImageOpen && onApplyImage && (
        <div style={{ marginTop: 10, padding: "12px 14px", background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(200,240,154,0.2)", borderRadius: 10 }}>
          <div style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text2)", fontWeight: 500, marginBottom: 8 }}>Paste Your Own Image URL</div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="url"
              value={pasteImageUrl}
              onChange={e => setPasteImageUrl(e.target.value)}
              placeholder="https://your-image-url.com/image.jpg"
              style={{
                flex: 1, background: "var(--bg)", border: "1px solid var(--border2)",
                borderRadius: 6, padding: "7px 10px", fontSize: 12, color: "var(--text)",
                fontFamily: "var(--font-body)", outline: "none",
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && pasteImageUrl.startsWith("http")) {
                  onApplyImage(pasteImageUrl);
                  setPasteImageOpen(false);
                  toast.success("Image URL applied ✓");
                }
              }}
            />
            <button
              type="button"
              className="cpbtn done"
              style={{ padding: "5px 12px", fontSize: 11 }}
              disabled={!pasteImageUrl.startsWith("http")}
              onClick={() => {
                if (pasteImageUrl.startsWith("http")) {
                  onApplyImage(pasteImageUrl);
                  setPasteImageOpen(false);
                  toast.success("Image URL applied ✓");
                }
              }}
            >
              Apply
            </button>
          </div>
          {pasteImageUrl.startsWith("http") && (
            <div 
              style={{ 
                marginTop: 10, 
                borderRadius: 8, 
                overflow: "hidden", 
                border: "1px solid var(--border)",
                aspectRatio: cssAspectRatioForPlatform(form.platform),
                backgroundColor: "rgba(0,0,0,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <img
                src={pasteImageUrl}
                alt="Preview"
                style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 6, fontStyle: "italic" }}>Paste a direct image URL (JPG, PNG, WebP). Press Enter or click Apply.</div>
        </div>
      )}

      {post.cover_image && (
        <div 
          style={{ 
            marginTop: 12, 
            border: "1px solid var(--border)", 
            borderRadius: 10, 
            overflow: "hidden", 
            position: "relative",
            aspectRatio: cssAspectRatioForPlatform(form.platform),
            backgroundColor: "rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <img 
            src={post.cover_image} 
            alt="Generated cover" 
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} 
          />
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
