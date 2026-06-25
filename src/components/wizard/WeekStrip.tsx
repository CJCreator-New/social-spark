import React from "react";
import { Post } from "./constants";
import { motion } from "framer-motion";
import { getEngagementPrediction } from "@/lib/postPerformanceScore";
import { useWizardStore } from "@/stores/useWizardStore";
import { parseLocalDate } from "@/lib/calendarSchedule";
import { Zap } from "lucide-react";

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
  weekStartDate?: Date;
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
  weekStartDate,
}: WeekStripProps) {
  const formWeekStart = useWizardStore((state) => state.form.weekStart);
  const start = weekStartDate || parseLocalDate(formWeekStart) || new Date();

  return (
    <div className="week-strip" role="tablist" aria-label="Days of the week">
      {posts.map((post, i) => {
        const engagementLevel = getEngagementPrediction(post, platform);
        const dayDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const dayOfWeekName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dayDate.getDay()];

        const badgeStyle = engagementLevel === "High"
          ? { color: "#15803d", background: "#dcfce7" }
          : engagementLevel === "Low"
          ? { color: "#b91c1c", background: "#fee2e2" }
          : { color: "#a16207", background: "#fef9c3" };

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
            title={`Day ${i + 1} · ${dayOfWeekName} · Engagement: ${engagementLevel}. Drag to reorder.`}
          >
            <div className="dtab-dow">{dayOfWeekName}</div>
            <div className="dtab-n tabular-nums">{i + 1}</div>
            {/* AI engagement prediction badge */}
            <div
              title={`AI predicted engagement: ${engagementLevel}`}
              style={{
                marginTop: 4,
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: ".04em",
                color: badgeStyle.color,
                background: badgeStyle.background,
                borderRadius: 4,
                padding: "1px 4px",
                lineHeight: 1.6,
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                transition: "opacity .2s",
                opacity: i === activeDay ? 1 : 0.72,
                textTransform: "uppercase",
              }}
            >
              <Zap size={7} style={{ flexShrink: 0 }} />
              {engagementLevel}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
});
