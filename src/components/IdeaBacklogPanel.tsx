import React, { useState, useMemo, useCallback } from "react";
import {
  readIdeaBacklog,
  markIdeaAsUsed,
  removeIdeaFromBacklog,
  type IdeaBacklogItem,
} from "@/lib/ideaBacklog";

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
  /** The authenticated user's ID — used as the localStorage namespace key */
  userId: string;
  /** Optional platform filter label shown in the panel header */
  platform?: string;
  /** Called with the idea angle text when the user clicks "Draft →" */
  onDraftIdea: (idea: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const IdeaBacklogPanel: React.FC<IdeaBacklogPanelProps> = ({
  userId,
  platform,
  onDraftIdea,
}) => {
  const [open, setOpen] = useState(false);
  // Version counter: incrementing forces a re-read from localStorage
  const [version, setVersion] = useState(0);

  const backlog = useMemo(
    () => readIdeaBacklog(userId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, version]
  );

  const unusedIdeas = useMemo(
    () => backlog.filter((item) => !item.usedAt),
    [backlog]
  );

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const handleDraft = useCallback(
    (item: IdeaBacklogItem) => {
      markIdeaAsUsed(userId, item.id);
      refresh();
      onDraftIdea(item.angle);
    },
    [userId, onDraftIdea, refresh]
  );

  const handleRemove = useCallback(
    (ideaId: string) => {
      removeIdeaFromBacklog(userId, ideaId);
      refresh();
    },
    [userId, refresh]
  );

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
          💡 Idea Backlog ({unusedIdeas.length})
          {platform && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                color: "var(--text3)",
                fontWeight: 400,
              }}
            >
              · {platform}
            </span>
          )}
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
          {unusedIdeas.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--text3)",
                fontStyle: "italic",
              }}
            >
              No saved ideas yet. Ideas from Source-to-Post will appear here.
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
              {unusedIdeas.map((item) => (
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
                      {timeAgo(item.createdAt)}
                    </span>

                    <div style={{ display: "flex", gap: 6 }}>
                      {/* Draft button */}
                      <button
                        type="button"
                        className="cpbtn done"
                        style={{ fontSize: 10 }}
                        onClick={() => handleDraft(item)}
                      >
                        Draft →
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
                        title="Remove idea"
                        onClick={() => handleRemove(item.id)}
                      >
                        ✕
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
