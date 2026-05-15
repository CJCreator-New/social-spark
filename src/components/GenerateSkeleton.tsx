import React from "react";

export default function GenerateSkeleton() {
  const dayBoxes = Array.from({ length: 7 }).map((_, i) => (
    <div key={i} style={{ flex: "1 1 0", minWidth: 80, margin: 6 }}>
      <div style={{ height: 16, width: "60%", background: "rgba(255,255,255,0.06)", borderRadius: 6, marginBottom: 8 }} />
      <div style={{ height: 72, width: "100%", background: "rgba(255,255,255,0.04)", borderRadius: 10 }} />
    </div>
  ));

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <div style={{ height: 40, width: 40, borderRadius: 12, background: "rgba(255,255,255,0.04)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, width: "40%", background: "rgba(255,255,255,0.06)", borderRadius: 6, marginBottom: 6 }} />
          <div style={{ height: 10, width: "30%", background: "rgba(255,255,255,0.04)", borderRadius: 6 }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto" }}>
        {dayBoxes}
      </div>
    </div>
  );
}
