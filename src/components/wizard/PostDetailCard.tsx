import React from "react";
import { Post, WizardForm } from "./constants";
import { shortDateLabel, dateForDow } from "@/lib/calendarSchedule";
import { resolvePlatform } from "@/lib/platformCopy";
import { TopicGapBadge } from "@/components/TopicGapBadge";
import { HashtagChipEditor } from "@/components/HashtagChipEditor";

export function hasEmoji(text: string): boolean {
  return /\p{Emoji}/u.test(text);
}

export function formatBadgeForPlatform(format: string, platform: string): string {
  const norm = (platform || "").toLowerCase();
  if (!norm.includes("twitter") && !norm.includes("x")) return format;
  return /list|bullet|thread/i.test(format) ? "THREAD FORMAT" : "SINGLE TWEET";
}

interface PostDetailCardProps {
  post: Post;
  activeDay: number;
  form: WizardForm;
  weekStartDate: Date;
  onHashtagsChange?: (newHashtags: string) => void;
  onFieldChange: (field: 'title' | 'hook' | 'body' | 'cta', value: string) => void;
  showRationale: boolean;
  setShowRationale: (show: boolean) => void;
}

export const PostDetailCard = React.memo(function PostDetailCard({
  post,
  activeDay,
  form,
  weekStartDate,
  onHashtagsChange,
  onFieldChange,
  showRationale,
  setShowRationale,
}: PostDetailCardProps) {
  const isInferred = !form.topics.some(t => t && t.trim().toLowerCase() === post.topic.trim().toLowerCase());

  return (
    <div className="pcard editor-workspace">
      {/* Editor Header Tags */}
      <div className="ph" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14, marginBottom: 18 }}>
        <div className="ptags" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span className="ptag pt-day">Day {post.day} · {post.dow}</span>
          <span className="ptag pt-date">{shortDateLabel(dateForDow(weekStartDate, post.dow))}</span>
          <span className="ptag pt-topic">{post.topic}</span>
          <TopicGapBadge topic={post.topic} rationale={post.rationale} isInferred={isInferred} />
          <span className="ptag pt-fmt">{formatBadgeForPlatform(post.format, form.platform)}</span>
        </div>
      </div>

      {/* Title Editor */}
      <div className="csect" style={{ marginBottom: 16 }}>
        <label className="flabel" htmlFor={`cf-title-${post.day}`}>Title</label>
        <textarea
          id={`cf-title-${post.day}`}
          className="text-input ptitle-input focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus:outline-none"
          value={post.title || ""}
          onChange={e => onFieldChange("title", e.target.value)}
          rows={1}
          placeholder="Write an engaging title..."
          style={{ width: "100%", fontSize: 16, fontWeight: 500, padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", resize: "none" }}
        />
      </div>

      {/* Hook Editor */}
      <div className="csect" style={{ marginBottom: 16 }}>
        <label className="flabel" htmlFor={`cf-hook-${post.day}`}>Hook</label>
        <textarea
          id={`cf-hook-${post.day}`}
          className="text-input phook-input focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus:outline-none"
          value={post.hook || ""}
          onChange={e => onFieldChange("hook", e.target.value)}
          rows={2}
          placeholder="Hook (the first 1-2 sentences)..."
          style={{ width: "100%", fontSize: 14, padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", resize: "vertical" }}
        />
      </div>

      {/* Body Editor */}
      <div className="csect" style={{ marginBottom: 16 }}>
        <label className="flabel" htmlFor={`cf-body-${post.day}`}>Post Body</label>
        <textarea
          id={`cf-body-${post.day}`}
          className="text-input pbody-input focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus:outline-none"
          value={post.body || ""}
          onChange={e => onFieldChange("body", e.target.value)}
          rows={6}
          placeholder="Write the core value or message of the post..."
          style={{ width: "100%", fontSize: 13, padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", resize: "vertical" }}
        />
      </div>

      {/* CTA Editor */}
      <div className="csect" style={{ marginBottom: 16 }}>
        <label className="flabel" htmlFor={`cf-cta-${post.day}`}>Call to Action (CTA)</label>
        <textarea
          id={`cf-cta-${post.day}`}
          className="text-input pcta-input focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus:outline-none"
          value={post.cta || ""}
          onChange={e => onFieldChange("cta", e.target.value)}
          rows={2}
          placeholder="Call to action..."
          style={{ width: "100%", fontSize: 13, padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", resize: "none" }}
        />
      </div>

      {/* Hashtags Editor */}
      <div className="csect" style={{ marginBottom: 16 }}>
        <label className="flabel">Hashtags</label>
        {onHashtagsChange ? (
          <HashtagChipEditor
            hashtags={post.hashtags}
            platform={form.platform}
            onChange={onHashtagsChange}
          />
        ) : (
          <div className="htags">{post.hashtags}</div>
        )}
      </div>

      {/* Why This Works Rationale */}
      {post.rationale && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div className="blabel" style={{ margin: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Why this works</span>
            <button
              type="button"
              className="restart"
              onClick={() => setShowRationale(!showRationale)}
              style={{ marginTop: 0, padding: "4px 8px", fontSize: 11 }}
            >
              {showRationale ? "Hide reasoning ↑" : "See why this works →"}
            </button>
          </div>
          {showRationale && <div className="rationale" style={{ marginTop: 10 }}>{post.rationale}</div>}
        </div>
      )}
    </div>
  );
});
