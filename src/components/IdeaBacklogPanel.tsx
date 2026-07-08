import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import type { IdeaBacklogRow } from "@/hooks/queries/shared";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Returns a human-readable "time ago" string from an ISO date string.
 * E.g. "2h ago", "3d ago", "just now".
 */
function timeAgo(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// ============================================================================
// PROPS
// ============================================================================

interface IdeaBacklogPanelProps {
  /** Unused backlog rows to render. This component performs no data-fetching. */
  items: IdeaBacklogRow[];
  /** True while the backlog list is loading for the first time. */
  loading?: boolean;
  /** Called with the full row when the user clicks "Draft this". */
  onDraftIdea: (item: IdeaBacklogRow) => void;
  /** Called with the row id when the user clicks "Remove". */
  onRemoveIdea: (id: string) => void;
  /** Id of the row currently being removed, so its button can show a spinner. */
  removingId?: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const IdeaBacklogPanel: React.FC<IdeaBacklogPanelProps> = ({
  items,
  loading = false,
  onDraftIdea,
  onRemoveIdea,
  removingId = null,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        marginTop: 12,
      }}
    >
      {/* ── Header / Toggle ── */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text)",
          fontSize: 13,
          fontWeight: 500,
          textAlign: "left",
        }}
      >
        <span>
          Idea Backlog ({items.length})
        </span>
        <span style={{ fontSize: 11, color: "var(--text3)" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* ── Expanded content ── */}
      {open && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "8px 12px 12px",
          }}
        >
          {loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "var(--text3)",
              }}
              role="status"
            >
              <Loader2 size={14} className="rp-spin" aria-hidden />
              Loading saved ideas…
            </div>
          ) : items.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--text3)",
                fontStyle: "italic",
              }}
            >
              No saved ideas yet. Extract ideas above and save the ones you want to keep for
              later.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {items.map((item) => (
                <li
                  key={item.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border2)",
                    borderRadius: 6,
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {/* Angle text */}
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text)",
                      lineHeight: 1.4,
                    }}
                  >
                    {item.angle}
                  </span>

                  {item.format && (
                    <span style={{ fontSize: 10, color: "var(--text3)" }}>{item.format}</span>
                  )}

                  {/* Meta row: timestamp + actions */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      marginTop: 2,
                    }}
                  >
                    <span style={{ fontSize: 10, color: "var(--text3)" }}>
                      {timeAgo(item.created_at)}
                    </span>

                    <div style={{ display: "flex", gap: 6 }}>
                      {/* Draft button */}
                      <button
                        type="button"
                        className="cpbtn done"
                        style={{ fontSize: 10 }}
                        onClick={() => onDraftIdea(item)}
                      >
                        Draft this
                      </button>

                      {/* Remove button */}
                      <button
                        type="button"
                        style={{
                          fontSize: 10,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text3)",
                          padding: "2px 4px",
                          borderRadius: 4,
                          lineHeight: 1,
                        }}
                        aria-label="Remove idea"
                        disabled={removingId === item.id}
                        onClick={() => onRemoveIdea(item.id)}
                      >
                        {removingId === item.id ? (
                          <Loader2 size={10} className="rp-spin" aria-hidden />
                        ) : (
                          "Remove"
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
