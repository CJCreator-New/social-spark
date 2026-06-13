import React from "react";
import { Post } from "./constants";
import { motion } from "framer-motion";
import { getEngagementPrediction, ENGAGEMENT_BADGE } from "@/lib/postPerformanceScore";

interface WeekStripProps {
  posts: Post[];
  activeDay: number;
  setActiveDay: (idx: number) => void;
  lockedDays: Set<number>;
  draggedIndex: number | null;
  setDraggedIndex: (idx: number | null) => void;
  handleDayDrop: (source: number, target: number) => void;
  handleDragStart: (e: React.DragEvent<HTMLElement>, idx: number) => void;
  handleDragOver: (e: React.DragEvent<HTMLElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLElement>, target: number) => number | null;
  platform?: string;
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
  platform = "",
}: WeekStripProps) {
  return (
    <div className="week-strip" role="tablist" aria-label="Days of the week">
      {posts.map((post, i) => {
        const engagementLevel = getEngagementPrediction(post, platform);
        const badge = ENGAGEMENT_BADGE[engagementLevel];
        return (
          <motion.button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === activeDay}
            className={`dtab ${i === activeDay ? "on" : ""} ${lockedDays.has(post.day) ? "locked" : ""} ${draggedIndex === i ? "dragging" : ""}`}
            onClick={() => setActiveDay(i)}
            draggable
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            onDragStart={(e) => {
              handleDragStart(e as unknown as React.DragEvent<HTMLElement>, i);
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
            title={`Day ${i + 1} · ${post.dow} · Engagement: ${engagementLevel}. Drag to reorder.`}
          >
            <div className="dtab-dow">{post.dow}</div>
            <div className="dtab-n tabular-nums">{i + 1}</div>
            {/* Engagement prediction badge */}
            <div
              title={`Predicted engagement: ${engagementLevel}`}
              style={{
                marginTop: 3,
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: ".04em",
                color: badge.color,
                background: badge.bg,
                borderRadius: 99,
                padding: "1px 4px",
                lineHeight: 1.6,
                display: "inline-block",
                transition: "opacity .2s",
                opacity: i === activeDay ? 1 : 0.7,
              }}
            >
              {badge.emoji} {engagementLevel}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
});
