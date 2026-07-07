import React, { useMemo, useCallback } from "react";
import { Post } from "./constants";
import { motion } from "framer-motion";
import {
  getEngagementPrediction,
  ENGAGEMENT_BADGE,
  type EngagementLevel,
} from "@/lib/postPerformanceScore";
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

  const engagementLevels = useMemo(
    () => posts.map((post) => getEngagementPrediction(post, platform)),
    [posts, platform]
  );

  const badgeStyles = useMemo(
    () =>
      engagementLevels.map((level) => {
        const entry = ENGAGEMENT_BADGE[level];
        return { color: entry.color, background: entry.bg };
      }),
    [engagementLevels]
  );

  const dayNames = useMemo(() => {
    const base = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    return Array.from({ length: posts.length }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    });
  }, [posts.length, start]);

  const onClickDay = useCallback((i: number) => () => setActiveDay(i), [setActiveDay]);

  const onDragStartDay = useCallback(
    (i: number) => (e: React.DragEvent<HTMLElement>) => {
      handleDragStart(e, i);
      setDraggedIndex(i);
    },
    [handleDragStart, setDraggedIndex]
  );

  const onDropDay = useCallback(
    (i: number) => (e: React.DragEvent<HTMLElement>) => {
      const src = handleDrop(e, i);
      if (src !== null) handleDayDrop(src, i);
    },
    [handleDrop, handleDayDrop]
  );

  return (
    <div className="week-strip" role="tablist" aria-label="Days of the week">
      {posts.map((post, i) => {
        const level = engagementLevels[i];
        const badgeStyle = badgeStyles[i];
        const dayOfWeekName = dayNames[i];

        return (
          <motion.button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === activeDay}
            className={`dtab ${i === activeDay ? "on" : ""} ${lockedDays.has(post.day) ? "locked" : ""} ${draggedIndex === i ? "dragging" : ""}`}
            onClick={onClickDay(i)}
            draggable
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            onDragStart={onDragStartDay(i) as any}
            onDragOver={handleDragOver}
            onDrop={onDropDay(i) as any}
            onDragEnd={() => setDraggedIndex(null)}
            title={`Day ${i + 1} · ${dayOfWeekName} · Engagement: ${level}. Drag to reorder.`}
          >
            <div className="dtab-dow">{dayOfWeekName}</div>
            <div className="dtab-n tabular-nums">{i + 1}</div>
            <div
              title={`AI predicted engagement: ${level}`}
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
              {level}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
});
