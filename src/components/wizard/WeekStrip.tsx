import React from "react";
import { Post } from "./constants";

interface WeekStripProps {
  posts: Post[];
  activeDay: number;
  setActiveDay: (idx: number) => void;
  lockedDays: Set<number>;
  draggedIndex: number | null;
  setDraggedIndex: (idx: number | null) => void;
  handleDayDrop: (source: number, target: number) => void;
  handleDragStart: (e: React.DragEvent, idx: number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, target: number) => number | null;
}

export const WeekStrip = React.memo(function WeekStrip({
  posts,
  activeDay,
  setActiveDay,
  lockedDays,
  draggedIndex,
  setDraggedIndex,
  handleDayDrop,
  handleDragStart,
  handleDragOver,
  handleDrop,
}: WeekStripProps) {
  return (
    <div className="week-strip" role="tablist" aria-label="Days of the week">
      {posts.map((post, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === activeDay}
          className={`dtab ${i === activeDay ? "on" : ""} ${lockedDays.has(post.day) ? "locked" : ""} ${draggedIndex === i ? "dragging" : ""}`}
          onClick={() => setActiveDay(i)}
          draggable
          onDragStart={(e) => {
            handleDragStart(e, i);
            setDraggedIndex(i);
          }}
          onDragOver={handleDragOver}
          onDrop={(e) => {
            const sourcIdx = handleDrop(e, i);
            if (sourcIdx !== null) {
              handleDayDrop(sourcIdx, i);
            }
          }}
          onDragEnd={() => setDraggedIndex(null)}
          title="Drag to reorder days"
        >
          <div className="dtab-dow">{post.dow}</div>
          <div className="dtab-n">{i + 1}</div>
        </button>
      ))}
    </div>
  );
});
