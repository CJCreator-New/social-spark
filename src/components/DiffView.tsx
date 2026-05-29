import React from "react";
import Modal from "@/components/ui/Modal";
import { diff_match_patch } from "diff-match-patch";

interface DiffViewProps {
  before: string;
  after: string;
  onAccept: () => void;
  onReject: () => void;
  title?: string;
}

function computeWordDiff(before: string, after: string): { removed: number; added: number } {
  const beforeWords = before.split(/\s+/).filter(Boolean);
  const afterWords = after.split(/\s+/).filter(Boolean);

  const removed = Math.max(0, beforeWords.length - afterWords.length);
  const added = Math.max(0, afterWords.length - beforeWords.length);

  return { removed, added };
}

function highlightDiff(before: string, after: string): { before: React.ReactNode; after: React.ReactNode } {
  const dmp = new diff_match_patch();
  const diffs = dmp.diff_main(before, after);
  dmp.diff_cleanupSemantic(diffs);

  const renderDiff = (diffs: [number, string][], isBefore: boolean) => {
    const result: React.ReactNode[] = [];

    diffs.forEach(([op, diffText], idx) => {
      if (op === 0) { // EQUAL
        result.push(<span key={idx}>{diffText}</span>);
      } else if (op === -1 && isBefore) { // DELETE in before
        result.push(<span key={idx} className="diff-removed">{diffText}</span>);
      } else if (op === 1 && !isBefore) { // INSERT in after
        result.push(<span key={idx} className="diff-added">{diffText}</span>);
      }
    });

    return result;
  };

  const beforeDiffs: [number, string][] = diffs.filter(([op]) => op === -1 || op === 0) as [number, string][];
  const afterDiffs: [number, string][] = diffs.filter(([op]) => op === 1 || op === 0) as [number, string][];

  const beforeEl = (
    <div className="diff-side diff-before">
      {renderDiff(beforeDiffs, true)}
    </div>
  );

  const afterEl = (
    <div className="diff-side diff-after">
      {renderDiff(afterDiffs, false)}
    </div>
  );

  return { before: beforeEl, after: afterEl };
}

export const DiffView: React.FC<DiffViewProps> = ({ before, after, onAccept, onReject, title = "Review changes" }) => {
  const { removed, added } = computeWordDiff(before, after);
  const { before: beforeEl, after: afterEl } = highlightDiff(before, after);
  const beforeChars = before.length;
  const afterChars = after.length;
  const charDelta = afterChars - beforeChars;

  return (
    <Modal onClose={onReject} className="diff-modal">
      <div className="diff-header">
        <h2>{title}</h2>
        <div className="diff-stats">
          <span className={charDelta < 0 ? "stat positive" : charDelta > 0 ? "stat negative" : "stat"}>
            {charDelta < 0 ? `−${Math.abs(charDelta)}` : `+${charDelta}`} chars
          </span>
          {removed > 0 && <span className="stat removed">−{removed} words</span>}
          {added > 0 && <span className="stat added">+{added} words</span>}
        </div>
      </div>

      <div className="diff-content">
        <div className="diff-comparison">
          <div className="diff-col">
            <div className="diff-col-label">Before</div>
            {beforeEl}
          </div>
          <div className="diff-col">
            <div className="diff-col-label">After</div>
            {afterEl}
          </div>
        </div>
      </div>

      <div className="diff-actions">
        <button className="btn btn-s" style={{ background: "transparent", borderColor: "var(--border2)", color: "var(--text2)" }} onClick={onReject}>
          Keep original
        </button>
        <button className="btn btn-p" onClick={onAccept}>
          Accept changes
        </button>
      </div>
    </Modal>
  );
};
