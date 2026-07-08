import { useEffect, useState } from "react";
import type { Post } from "@/components/wizard/constants";

const REPURPOSE_TARGETS = ["X", "Instagram", "Facebook", "LinkedIn", "Newsletter"] as const;

function hasContent(post: Post): boolean {
  return Boolean((post.title || post.hook || post.body || "").trim());
}

export interface BulkRepurposeModalProps {
  open: boolean;
  posts: Post[];
  currentPlatform: string;
  onClose: () => void;
  onStart: (selectedDays: number[], targetPlatform: string) => void;
}

export function BulkRepurposeModal({
  open,
  posts,
  currentPlatform,
  onClose,
  onStart,
}: BulkRepurposeModalProps) {
  const eligiblePosts = posts.filter(hasContent);
  const targets = REPURPOSE_TARGETS.filter(
    (t) => t.toLowerCase() !== (currentPlatform || "").toLowerCase()
  );

  const [target, setTarget] = useState<string>("");
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!open) return;
    // Reset selection each time the modal opens — default: all days with content.
    setSelectedDays(new Set(eligiblePosts.map((p) => p.day)));
    setTarget((prev) => ((targets as readonly string[]).includes(prev) ? prev : targets[0] || ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function toggleDay(day: number) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  function selectAll() {
    setSelectedDays(new Set(eligiblePosts.map((p) => p.day)));
  }

  function selectNone() {
    setSelectedDays(new Set());
  }

  const canStart = !!target && selectedDays.size > 0;

  return (
    <div className="cd-modal-bg" onClick={onClose} role="presentation">
      <div
        className="cd-modal"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Repurpose week to another platform"
      >
        <div className="cd-hero-kicker">♻️ Bulk Repurpose</div>
        <h3 className="cd-title" style={{ marginTop: 0 }}>
          Repurpose week to…
        </h3>
        <p className="cd-meta" style={{ marginBottom: 16 }}>
          Pick a target platform and the days you want rewritten. Nothing is saved until you
          review and confirm each post.
        </p>

        <div className="cd-blabel">
          <span>Target platform</span>
        </div>
        <select
          className="cd-reformat-sel"
          aria-label="Target platform"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          style={{ marginBottom: 16, width: "100%" }}
        >
          <option value="" disabled>
            Choose platform…
          </option>
          {targets.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <div
          className="cd-blabel"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span>Days to repurpose ({selectedDays.size} of {eligiblePosts.length})</span>
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" className="cd-fav-btn" onClick={selectAll}>
              Select all
            </button>
            <button type="button" className="cd-fav-btn" onClick={selectNone}>
              Select none
            </button>
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: 260,
            overflowY: "auto",
            marginBottom: 20,
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            padding: 8,
          }}
        >
          {eligiblePosts.length === 0 && (
            <div className="cd-meta">No posts with content to repurpose yet.</div>
          )}
          {eligiblePosts.map((post) => (
            <label
              key={post.day}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
            >
              <input
                type="checkbox"
                checked={selectedDays.has(post.day)}
                onChange={() => toggleDay(post.day)}
                aria-label={`Include Day ${post.day} (${post.dow}) — ${post.topic || post.title}`}
              />
              <span style={{ fontWeight: 600 }}>
                {post.dow} · Day {post.day}
              </span>
              <span style={{ color: "var(--color-text-muted)" }}>
                {post.topic || post.title || "Untitled"}
              </span>
            </label>
          ))}
        </div>

        <div className="cd-modal-actions">
          <button
            className="cd-btn"
            style={{ background: "var(--color-primary)", color: "var(--color-surface)" }}
            disabled={!canStart}
            onClick={() => onStart(Array.from(selectedDays), target)}
          >
            Repurpose {selectedDays.size} post{selectedDays.size === 1 ? "" : "s"} →
          </button>
          <button className="cd-fav-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default BulkRepurposeModal;
