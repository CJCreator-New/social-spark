import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { SavedCalendar } from "@/pages/MyCalendars";
import { motion } from "framer-motion";
import { Star, MoreVertical } from "lucide-react";

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

function platformBadgeStyle(platform?: string | null): React.CSSProperties {
  if (!platform) return { background: "#f5f5f4", color: "#5a5753", border: "1px solid #e7e5e4" };
  const p = platform.toLowerCase();
  if (p.includes("linkedin"))  return { background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe" };
  if (p.includes("twitter") || p.includes("x")) return { background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" };
  if (p.includes("instagram")) return { background: "#fce7f3", color: "#be185d", border: "1px solid #fbcfe8" };
  if (p.includes("facebook"))  return { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" };
  if (p.includes("newsletter") || p.includes("blog")) return { background: "#fef3c7", color: "#d97706", border: "1px solid #fde68a" };
  return { background: "#f5f5f4", color: "#5a5753", border: "1px solid #e7e5e4" };
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
  const navigate = useNavigate();
  const isRenaming = renamingId === it.id;
  const postCount = Array.isArray(it.posts) ? it.posts.length : 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <motion.div
      className="relative flex flex-col justify-between overflow-hidden group cursor-pointer"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 16,
        padding: 24,
        minHeight: 200,
        boxShadow: "0 4px 20px rgba(120,113,108,0.04)",
        border: "1px solid #e7e5e4",
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      onClick={() => { if (!isRenaming) navigate(`/calendar/${it.id}`); }}
      whileHover={{ y: -4, boxShadow: "0 12px 30px rgba(120,113,108,0.08)" } as never}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      <div>
        {/* Card Header */}
        <div className="flex justify-between items-start gap-3 mb-3">
          <span
            className="text-[10px] font-semibold tracking-wider uppercase rounded-md"
            style={{ padding: "3px 8px", ...platformBadgeStyle(it.platform) }}
          >
            {it.platform || "Generic"}
          </span>

          <div className="flex items-center gap-1" ref={menuRef}>
            {/* Star toggle with Lucide icon */}
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
                color: it.is_favorite ? "#f59e0b" : "#a8a29e",
                transition: "color 0.15s",
              }}
              onClick={(e) => { e.stopPropagation(); toggleFavorite(it); }}
              aria-pressed={!!it.is_favorite}
              aria-label={it.is_favorite ? "Unstar" : "Star"}
            >
              <Star
                size={15}
                style={{ fill: it.is_favorite ? "#f59e0b" : "none", strokeWidth: 1.5 }}
              />
            </button>

            {/* Actions menu */}
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
                color: "#5a5753",
                transition: "color 0.15s",
              }}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
              aria-label="Calendar actions"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={15} />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-30"
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e7e5e4",
                  borderRadius: 8,
                  boxShadow: "0 8px 24px rgba(120,113,108,0.10)",
                  minWidth: 120,
                  overflow: "hidden",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {[
                  { label: "Rename", action: () => { setMenuOpen(false); startRename(it); }, color: "#57534e" },
                  { label: duplicatingId === it.id ? "Copying…" : "Duplicate", action: () => { setMenuOpen(false); duplicate(it); }, color: "#57534e" },
                  { label: "Delete", action: () => { setMenuOpen(false); setPendingDelete(it); }, color: "#ef4444" },
                ].map(({ label, action, color }) => (
                  <button
                    key={label}
                    type="button"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 14px",
                      fontSize: 12,
                      color,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      display: "block",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#faf8f4")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                    onClick={(e) => { e.stopPropagation(); action(); }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Title / rename input */}
        {isRenaming ? (
          <input
            className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-3"
            style={{
              backgroundColor: "#faf8f4",
              border: "1.5px solid #c2410c",
              color: "#1c1917",
              fontFamily: "inherit",
            }}
            autoFocus
            value={renameValue}
            disabled={renameSaving}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") { e.preventDefault(); saveRename(); }
              if (e.key === "Escape") { e.preventDefault(); setRenamingId(null); }
            }}
            onBlur={saveRename}
          />
        ) : (
          <h2
            className="text-base font-semibold leading-snug truncate mb-2"
            style={{
              fontFamily: "var(--font-display, 'Lora', Georgia, serif)",
              color: "#1c1917",
              transition: "color 0.15s",
            }}
            title={it.title}
          >
            {it.title}
          </h2>
        )}

        {/* Core idea excerpt */}
        {it.core_idea && (
          <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "#57534e" }}>
            {it.core_idea}
          </p>
        )}
      </div>

      {/* Card footer */}
      <div className="flex justify-between items-center mt-4 pt-3" style={{ borderTop: "1px solid #f5f5f4" }}>
        <div className="flex gap-2 text-[11px]" style={{ color: "#5a5753" }}>
          <span>{postCount} posts</span>
          {it.industry_label && (
            <>
              <span>·</span>
              <span className="truncate max-w-[110px]">{it.industry_label}</span>
            </>
          )}
        </div>
        <span className="text-[11px]" style={{ color: "#5a5753" }}>
          {new Date(it.created_at).toLocaleDateString()}
        </span>
      </div>
    </motion.div>
  );
});
