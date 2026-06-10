import React from "react";
import { Link } from "react-router-dom";
import type { SavedCalendar } from "@/pages/MyCalendars";
import { motion } from "framer-motion";

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

function platformColorStyle(platform?: string | null): React.CSSProperties {
  if (!platform) return { background: "rgba(124, 130, 148, 0.1)", color: "#7c8294", borderColor: "rgba(124, 130, 148, 0.2)" };
  const p = platform.toLowerCase();
  if (p.includes("linkedin")) return { background: "rgba(10, 102, 194, 0.1)", color: "#70b5f9", borderColor: "rgba(10, 102, 194, 0.3)" };
  if (p.includes("twitter") || p.includes("x")) return { background: "rgba(255, 255, 255, 0.05)", color: "#edeae3", borderColor: "rgba(255, 255, 255, 0.1)" };
  if (p.includes("instagram")) return { background: "rgba(225, 48, 108, 0.1)", color: "#ff7da4", borderColor: "rgba(225, 48, 108, 0.3)" };
  if (p.includes("facebook")) return { background: "rgba(24, 119, 242, 0.1)", color: "#6ca8ff", borderColor: "rgba(24, 119, 242, 0.3)" };
  return { background: "rgba(124, 130, 148, 0.1)", color: "#7c8294", borderColor: "rgba(124, 130, 148, 0.2)" };
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
  const isRenaming = renamingId === it.id;
  const postCount = Array.isArray(it.posts) ? it.posts.length : 0;

  return (
    <motion.div
      className="glass-card p-5 flex flex-col justify-between min-h-[190px] border border-white/5 relative overflow-hidden group transition-all duration-300 hover:border-white/10 hover:shadow-lg"
      style={{
        background: "linear-gradient(145deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%)",
      }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div>
        {/* Card Header row */}
        <div className="flex justify-between items-start gap-4 mb-4">
          <span
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wider uppercase border"
            style={platformColorStyle(it.platform)}
          >
            {it.platform || "Generic"}
          </span>

          <button
            type="button"
            className={`text-base p-1 transition-colors ${
              it.is_favorite ? "text-[#c8f09a]" : "text-slate-600 hover:text-slate-400"
            }`}
            onClick={() => toggleFavorite(it)}
            aria-pressed={!!it.is_favorite}
            aria-label={it.is_favorite ? "Unstar" : "Star"}
          >
            {it.is_favorite ? "★" : "☆"}
          </button>
        </div>

        {/* Title / Input */}
        {isRenaming ? (
          <input
            className="w-full bg-[#07080d] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#edeae3] outline-none focus:border-[#c8f09a]/30 mb-3"
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
          <Link to={`/calendar/${it.id}`} className="block group-hover:text-[#c8f09a] transition-colors mb-3">
            <h2 className="font-display text-base font-normal leading-snug truncate">
              {it.title}
            </h2>
          </Link>
        )}

        {/* Core Idea preview */}
        {it.core_idea && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
            {it.core_idea}
          </p>
        )}
      </div>

      {/* Card Footer info / actions */}
      <div className="border-t border-white/5 pt-4 mt-auto">
        <div className="flex justify-between items-center text-[11px] text-slate-500">
          <div className="flex gap-2.5">
            <span>{postCount} posts</span>
            {it.industry_label && (
              <>
                <span>•</span>
                <span className="truncate max-w-[100px]">{it.industry_label}</span>
              </>
            )}
          </div>
          <span>{new Date(it.created_at).toLocaleDateString()}</span>
        </div>

        {/* Action button deck */}
        <div className="flex justify-end gap-3 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {isRenaming ? (
            <button
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-200"
              onClick={() => setRenamingId(null)}
              disabled={renameSaving}
            >
              Cancel
            </button>
          ) : (
            <>
              <button
                className="text-[11px] font-semibold text-slate-400 hover:text-[#c8f09a] transition-colors"
                onClick={() => startRename(it)}
              >
                Rename
              </button>
              <button
                className="text-[11px] font-semibold text-slate-400 hover:text-[#c8f09a] transition-colors"
                onClick={() => duplicate(it)}
                disabled={duplicatingId === it.id}
              >
                {duplicatingId === it.id ? "Copying…" : "Duplicate"}
              </button>
              <button
                className="text-[11px] font-semibold text-slate-500 hover:text-red-400 transition-colors"
                onClick={() => setPendingDelete(it)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
});
