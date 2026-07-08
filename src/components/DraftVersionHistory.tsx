import { useState, useEffect, useCallback } from "react";
import { readSnapshots, deleteSnapshot, type DraftSnapshot } from "@/lib/draftSnapshots";

interface DraftVersionHistoryProps {
  calendarId: string;
  onRestore: (posts: unknown[]) => void;
}

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

export function DraftVersionHistory({ calendarId, onRestore }: DraftVersionHistoryProps) {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<DraftSnapshot[]>([]);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useEffect(() => {
    setSnapshots(readSnapshots(calendarId));
  }, [calendarId, refreshCounter]);

  const handleDelete = useCallback(
    (snapshotId: string) => {
      deleteSnapshot(calendarId, snapshotId);
      setRefreshCounter((c) => c + 1);
    },
    [calendarId]
  );

  const handleRestore = useCallback(
    (snapshot: DraftSnapshot) => {
      const ok = window.confirm(
        `Restore "${snapshot.label}" from ${relativeTime(snapshot.savedAt)}?\nThis will replace the current posts in the editor.`
      );
      if (!ok) return;
      onRestore(snapshot.posts);
    },
    [onRestore]
  );

  return (
    <div
      style={{
        marginBottom: 16,
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--surface)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text2)",
          fontSize: 13,
          fontWeight: 600,
        }}
        aria-expanded={open}
      >
        <span>🕐 Version History ({snapshots.length})</span>
        <span style={{ fontSize: 10, color: "var(--text3)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Collapsible body */}
      {open && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {snapshots.length === 0 ? (
            <p
              style={{
                margin: 0,
                padding: "12px 14px",
                fontSize: 12,
                color: "var(--text3)",
              }}
            >
              No saved versions yet. Versions are created automatically when you save.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: "4px 0",
              }}
            >
              {snapshots.map((snap) => (
                <li
                  key={snap.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 14px",
                    gap: 8,
                    borderBottom: "1px solid var(--border2, var(--border))",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {snap.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>
                      {relativeTime(snap.savedAt)} · {snap.posts.length} post
                      {snap.posts.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      className="cpbtn"
                      onClick={() => handleRestore(snap)}
                      style={{ fontSize: 10 }}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(snap.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text3)",
                        fontSize: 13,
                        lineHeight: 1,
                        padding: "2px 4px",
                      }}
                      aria-label="Delete snapshot"
                      title="Delete this version"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
