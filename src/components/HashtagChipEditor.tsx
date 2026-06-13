import React, { useState, useRef, useCallback } from "react";
import { resolvePlatform } from "@/lib/platformCopy";

export function platformHashtagGuidance(platform: string): { label: string; color: string } {
  const s = (platform || "").toLowerCase();
  if (s.includes("instagram") || s === "ig") return { label: "Instagram: 20–30 hashtags", color: "#f0d49a" };
  if (s.includes("linkedin")) return { label: "LinkedIn: 3–5 hashtags", color: "#9ab5f0" };
  if (s.includes("twitter") || s.includes("x/") || s === "x") return { label: "Twitter/X: 1–2 hashtags", color: "#9aecf0" };
  if (s.includes("facebook") || s === "fb") return { label: "Facebook: 2–3 hashtags", color: "#9a9af0" };
  if (s.includes("newsletter")) return { label: "Newsletter: hashtags optional", color: "#c8f09a" };
  if (s.includes("blog")) return { label: "Blog: hashtags optional", color: "#c8f09a" };
  return { label: "Hashtags optional", color: "#c8f09a" };
}

export function parseHashtagsFromString(raw: string): string[] {
  return raw.split(/[\s,]+/).map(t => t.trim()).filter(t => t.length > 0).map(t => t.startsWith("#") ? t : `#${t}`);
}

interface HashtagChipEditorProps {
  hashtags: string;
  platform: string;
  onChange: (newHashtags: string) => void;
}

export const HashtagChipEditor: React.FC<HashtagChipEditorProps> = ({ hashtags, platform, onChange }) => {
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const chips = parseHashtagsFromString(hashtags);
  const guidance = platformHashtagGuidance(platform);

  const removeChip = useCallback((tag: string) => {
    const next = chips.filter(t => t !== tag);
    onChange(next.join(" "));
  }, [chips, onChange]);

  const addChip = useCallback(() => {
    const val = inputVal.trim();
    if (!val) return;
    const newTag = val.startsWith("#") ? val : `#${val}`;
    if (!chips.includes(newTag)) {
      onChange([...chips, newTag].join(" "));
    }
    setInputVal("");
  }, [inputVal, chips, onChange]);

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8, minHeight: 28 }}>
        {chips.length === 0 && <span style={{ fontSize: 11, color: "var(--text3)", fontStyle: "italic" }}>No hashtags yet — add below</span>}
        {chips.map((tag, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 9px", borderRadius: 99,
              background: "rgba(200,240,154,0.08)", border: "1px solid rgba(200,240,154,0.22)",
              color: "rgba(200,240,154,0.85)", fontSize: 12, fontWeight: 400,
              cursor: "default",
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeChip(tag)}
              aria-label={`Remove ${tag}`}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(200,240,154,0.4)", fontSize: 14, lineHeight: 1,
                padding: "0 0 0 2px", display: "flex", alignItems: "center",
                transition: "color .12s",
              }}
              onMouseOver={e => (e.currentTarget.style.color = "rgba(200,240,154,0.9)")}
              onMouseOut={e => (e.currentTarget.style.color = "rgba(200,240,154,0.4)")}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addChip(); } }}
          placeholder="Add hashtag (without #)…"
          style={{
            flex: 1, background: "var(--bg)", border: "1px solid var(--border2)",
            borderRadius: 6, padding: "5px 10px", fontSize: 12, color: "var(--text)",
            fontFamily: "var(--font-body)", outline: "none",
          }}
        />
        <button
          type="button"
          onClick={addChip}
          style={{
            padding: "5px 12px", borderRadius: 6, background: "rgba(200,240,154,0.1)",
            border: "1px solid rgba(200,240,154,0.22)", color: "var(--accent)",
            fontSize: 11, cursor: "pointer", fontFamily: "var(--font-body)", whiteSpace: "nowrap",
          }}
        >
          Add
        </button>
      </div>
      <div style={{ marginTop: 5, fontSize: 10, color: guidance.color, opacity: 0.75 }}>
        📌 {guidance.label} · {chips.length} used
      </div>
    </div>
  );
};

export default HashtagChipEditor;
