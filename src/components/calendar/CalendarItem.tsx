import React from "react";
import { Link } from "react-router-dom";
import type { SavedCalendar } from "@/pages/MyCalendars";

interface CalendarItemProps {
  it: SavedCalendar;
  renamingId: string | null;
  renameValue: string;
  renameSaving: boolean;
  setRenameValue: (val: string) => void;
  saveRename: () => void;
  setRenamingId: (id: string | null) => void;
  startRename: (it: SavedCalendar) => void;
  duplicate: (it: SavedCalendar) => void;
  duplicatingId: string | null;
  setPendingDelete: (it: SavedCalendar) => void;
  toggleFavorite: (it: SavedCalendar) => void;
}

export const CalendarItem = React.memo(function CalendarItem({
  it,
  renamingId,
  renameValue,
  renameSaving,
  setRenameValue,
  saveRename,
  setRenamingId,
  startRename,
  duplicate,
  duplicatingId,
  setPendingDelete,
  toggleFavorite,
}: CalendarItemProps) {
  return (
    <div className="mc-item">
      <button
        type="button"
        className={`mc-star ${it.is_favorite ? "on" : ""}`}
        onClick={() => toggleFavorite(it)}
        aria-pressed={!!it.is_favorite}
        aria-label={it.is_favorite ? "Unstar" : "Star"}
        title={it.is_favorite ? "Unstar" : "Star"}
      >
        {it.is_favorite ? "★" : "☆"}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        {renamingId === it.id ? (
          <input
            className="mc-rename-input"
            autoFocus
            value={renameValue}
            disabled={renameSaving}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveRename();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setRenamingId(null);
              }
            }}
            onBlur={saveRename}
          />
        ) : (
          <Link to={`/calendar/${it.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <h2 className="mc-item-title">{it.title}</h2>
          </Link>
        )}
        <div className="mc-meta" style={{ marginTop: 4 }}>
          {Array.isArray(it.posts) && it.posts.length === 1 && <span className="mc-tag">1-day</span>}
          {it.industry_label && <span className="mc-tag">{it.industry_label}</span>}
          {it.platform && <span className="mc-tag">{it.platform}</span>}
          <span>{new Date(it.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="mc-actions">
        {renamingId === it.id ? (
          <button className="mc-act" onClick={() => setRenamingId(null)} disabled={renameSaving}>
            {renameSaving ? "Saving…" : "Cancel"}
          </button>
        ) : (
          <>
            <button className="mc-act" onClick={() => startRename(it)}>
              Rename
            </button>
            <button className="mc-act" onClick={() => duplicate(it)} disabled={duplicatingId === it.id}>
              {duplicatingId === it.id ? "Copying…" : "Duplicate"}
            </button>
            <button className="mc-del" onClick={() => setPendingDelete(it)}>
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
});
