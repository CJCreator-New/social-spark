import React from "react";
import { PLATFORM_OPTIONS } from "./constants";

interface ReformatBarProps {
  platform: string;
  reformatTarget: string;
  setReformatTarget: (v: string) => void;
  reformatting: boolean;
  regenIdx: number | null;
  postsLength: number;
  lockedDaysSize: number;
  reformatAllForPlatform: (target: string) => void;
  regenerateUnlocked: () => void;
  userExists: boolean;
}

export function ReformatBar({
  platform,
  reformatTarget,
  setReformatTarget,
  reformatting,
  regenIdx,
  postsLength,
  lockedDaysSize,
  reformatAllForPlatform,
  regenerateUnlocked,
  userExists,
}: ReformatBarProps) {
  return (
    <div className="reformat-bar">
      <span className="reformat-label">Reformat for</span>
      <select
        className="reformat-sel"
        value={reformatTarget}
        onChange={(e) => setReformatTarget(e.target.value)}
        disabled={reformatting || regenIdx !== null}
        aria-label="Choose another platform to reformat for"
      >
        <option value="">Another platform…</option>
        {PLATFORM_OPTIONS.filter(po => po.id !== platform).map(po => (
          <option key={po.id} value={po.id}>{po.label}</option>
        ))}
      </select>
      <button
        type="button"
        className="reformat-btn"
        disabled={!reformatTarget || reformatting || regenIdx !== null || !userExists}
        onClick={() => reformatAllForPlatform(reformatTarget)}
        title={!userExists ? "Sign in — saved as a new calendar" : "Re-runs all posts; saved as a new calendar"}
      >
        {reformatting ? `Reformatting… ${regenIdx !== null ? `(${regenIdx + 1}/${postsLength})` : ""}` : `Reformat all ${postsLength} →`}
      </button>
      <span style={{ flex: 1 }} />
      <button
        type="button"
        className="reformat-btn"
        style={{ background: "transparent", color: "var(--text2)", borderColor: "var(--border2)" }}
        disabled={reformatting || regenIdx !== null || lockedDaysSize === postsLength}
        onClick={regenerateUnlocked}
        title="Re-roll only the days you haven't pinned"
      >
        ↻ Regenerate unlocked ({postsLength - lockedDaysSize})
      </button>
    </div>
  );
}
