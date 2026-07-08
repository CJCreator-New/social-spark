import { PerformanceScoreCard } from "@/components/PerformanceScoreCard";
import type { BulkRepurposeItem } from "@/hooks/useBulkRepurpose";

const STATUS_META: Record<
  BulkRepurposeItem["status"],
  { label: string; emoji: string; color: string }
> = {
  pending: { label: "Pending", emoji: "⏳", color: "var(--color-text-muted)" },
  running: { label: "Rewriting…", emoji: "✍️", color: "var(--color-primary)" },
  success: { label: "Ready", emoji: "✅", color: "var(--color-success-text, #16a34a)" },
  failed: { label: "Failed", emoji: "⚠️", color: "var(--color-error-text)" },
  blocked: { label: "Quota reached", emoji: "🚫", color: "var(--color-error-text)" },
};

export interface BulkRepurposePanelProps {
  items: BulkRepurposeItem[];
  targetPlatform: string;
  running: boolean;
  settled: boolean;
  counts: { total: number; done: number; success: number; failed: number; blocked: number };
  topic?: string;
  saving?: boolean;
  onToggleIncluded: (day: number) => void;
  onRetryFailed: () => void;
  onSave: () => void;
  onClose: () => void;
}

export function BulkRepurposePanel({
  items,
  targetPlatform,
  running,
  settled,
  counts,
  topic,
  saving,
  onToggleIncluded,
  onRetryFailed,
  onSave,
  onClose,
}: BulkRepurposePanelProps) {
  if (items.length === 0) return null;

  const includedSuccessCount = items.filter((it) => it.status === "success" && it.included).length;

  return (
    <div className="cd-modal-bg" role="presentation">
      <div
        className="cd-modal"
        style={{ maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Bulk repurpose to ${targetPlatform}`}
      >
        <div className="cd-hero-kicker">♻️ Bulk Repurpose</div>
        <h3 className="cd-title" style={{ marginTop: 0 }}>
          Repurposing for {targetPlatform}
        </h3>

        <p className="cd-meta" style={{ marginBottom: 12 }}>
          {counts.done} of {counts.total} done
          {counts.failed > 0 ? `, ${counts.failed} failed` : ""}
          {counts.blocked > 0 ? `, ${counts.blocked} blocked (quota reached)` : ""}
        </p>

        {counts.blocked > 0 && (
          <div
            className="cd-card"
            style={{
              background: "var(--color-warning-bg, #fff7ed)",
              padding: 10,
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            You've hit your generation quota or rate limit. Already-succeeded posts below are
            preserved — you can save them now and retry the rest later.
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginBottom: 16,
            maxHeight: settled ? 160 : 320,
            overflowY: "auto",
          }}
        >
          {items.map((item) => {
            const meta = STATUS_META[item.status];
            return (
              <div
                key={item.day}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  fontSize: 13,
                  padding: "4px 0",
                }}
              >
                <span>
                  {item.dow} · Day {item.day} — {item.sourcePost.topic || item.sourcePost.title || "Untitled"}
                </span>
                <span
                  className="cd-chip"
                  style={{ color: meta.color }}
                  title={item.error || meta.label}
                >
                  {meta.emoji} {meta.label}
                </span>
              </div>
            );
          })}
        </div>

        {!settled && (
          <div className="cd-modal-actions">
            <button className="cd-fav-btn" onClick={onClose} disabled={running}>
              {running ? "Repurposing…" : "Close"}
            </button>
          </div>
        )}

        {settled && (
          <>
            <div className="cd-blabel">
              <span>Review results ({includedSuccessCount} selected)</span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                marginBottom: 20,
                maxHeight: 420,
                overflowY: "auto",
              }}
            >
              {items
                .filter((it) => it.status === "success" && it.result)
                .map((item) => (
                  <div
                    key={item.day}
                    className="cd-card"
                    style={{ padding: 14, borderRadius: 10, border: "1px solid var(--color-border)" }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                        fontWeight: 600,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={item.included}
                        onChange={() => onToggleIncluded(item.day)}
                        aria-label={`Include Day ${item.day} in save`}
                      />
                      {item.dow} · Day {item.day} — {item.result!.topic || item.result!.title}
                    </label>
                    <div
                      style={{
                        whiteSpace: "pre-wrap",
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "var(--color-text)",
                        marginBottom: 8,
                        maxHeight: 140,
                        overflowY: "auto",
                      }}
                    >
                      {item.result!.body}
                    </div>
                    <PerformanceScoreCard post={item.result!} topic={topic} />
                  </div>
                ))}

              {items.some((it) => it.status === "failed" || it.status === "blocked") && (
                <div className="cd-meta">
                  {items.filter((it) => it.status === "failed" || it.status === "blocked").length}{" "}
                  post(s) did not complete — retry below, or save the ones that succeeded.
                </div>
              )}
            </div>

            <div className="cd-modal-actions">
              {counts.failed > 0 && (
                <button className="cd-btn" onClick={onRetryFailed} disabled={saving}>
                  Retry failed ({counts.failed})
                </button>
              )}
              <button
                className="cd-btn"
                style={{ background: "var(--color-primary)", color: "var(--color-surface)" }}
                onClick={onSave}
                disabled={saving || includedSuccessCount === 0}
              >
                {saving
                  ? "Saving…"
                  : `📥 Save ${includedSuccessCount} repurposed post${includedSuccessCount === 1 ? "" : "s"}`}
              </button>
              <button className="cd-fav-btn" onClick={onClose} disabled={saving}>
                Discard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default BulkRepurposePanel;
