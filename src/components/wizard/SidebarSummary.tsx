import React from "react";

interface SidebarSummaryProps {
  weekSummary: {
    totalPosts: number;
    avgChars: number;
    withinLimitPct: number;
    formatCounts: Record<string, number>;
    hashtagCounts: number[];
    postingTimes: Array<{ day: number; dow: string; time: string }>;
  };
}

export function SidebarSummary({ weekSummary }: SidebarSummaryProps) {
  return (
    <div className="summary-card">
      <div className="summary-head">
        <div>
          <div className="sh" style={{ marginBottom: 6 }}>Week at a glance</div>
          <div className="time-hint">A fast read before you copy, tweak, or save.</div>
        </div>
        <div className="summary-stat">
          <b>{weekSummary.totalPosts}</b>
          <span>Posts</span>
        </div>
      </div>
      <div className="summary-list">
        <div className="summary-row"><span>Average length</span><strong>{weekSummary.avgChars} chars</strong></div>
        <div className="summary-row"><span>Within platform limit</span><strong>{weekSummary.withinLimitPct}%</strong></div>
        <div className="summary-row"><span>Hashtags per post</span><strong>{weekSummary.hashtagCounts.length ? weekSummary.hashtagCounts.join(" · ") : "—"}</strong></div>
      </div>
      <div className="summary-meta">
        {Object.entries(weekSummary.formatCounts).slice(0, 4).map(([label, count]) => (
          <span key={label} className="summary-pill">{count} {label.toLowerCase()}</span>
        ))}
      </div>
      <div className="summary-list" style={{ marginTop: 14 }}>
        {weekSummary.postingTimes.map(slot => (
          <div key={slot.day} className="summary-row">
            <span>Day {slot.day} · {slot.dow}</span>
            <strong>{slot.time}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
