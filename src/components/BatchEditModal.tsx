import React, { useState } from "react";

export interface BatchEditPayload {
  brandMention: string;
  hashtag: string;
  ctaStyle: string;
  updateTimes: boolean;
}

interface BatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (payload: BatchEditPayload) => void;
  totalPosts: number;
  currentPlatform: string;
}

const CTA_STYLES = [
  "Share & repost bait",
  "Spark comments & debate",
  "Drive to profile / newsletter",
  "Collect leads",
  "Build community",
  "No hard CTA",
];

export const BatchEditModal: React.FC<BatchEditModalProps> = ({ isOpen, onClose, onApply, totalPosts, currentPlatform }) => {
  const [brandMention, setBrandMention] = useState<string>("");
  const [hashtag, setHashtag] = useState<string>("");
  const [ctaStyle, setCtaStyle] = useState<string>("");
  const [updateTimes, setUpdateTimes] = useState<boolean>(false);

  const handleApply = () => {
    if (!brandMention && !hashtag && !ctaStyle && !updateTimes) {
      return; // No changes to apply
    }

    onApply({
      brandMention,
      hashtag,
      ctaStyle,
      updateTimes,
    });

    // Reset form
    setBrandMention("");
    setHashtag("");
    setCtaStyle("");
    setUpdateTimes(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Batch edit all {totalPosts} posts</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="brand-mention">
              Brand mention
              <span className="hint">Append to end of CTA (e.g., "by HIMS")</span>
            </label>
            <input
              id="brand-mention"
              type="text"
              placeholder="e.g., by HIMS, · Powered by MedTech"
              value={brandMention}
              onChange={(e) => setBrandMention(e.target.value)}
              maxLength={50}
            />
            <div className="char-count">{brandMention.length} / 50</div>
          </div>

          <div className="form-group">
            <label htmlFor="hashtag">
              Add hashtag
              <span className="hint">Add to all posts (e.g., #AyushmanBharat)</span>
            </label>
            <input
              id="hashtag"
              type="text"
              placeholder="e.g., #AyushmanBharat"
              value={hashtag}
              onChange={(e) => setHashtag(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
              maxLength={30}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cta-style">
              Change CTA style
              <span className="hint">Replace CTA across all posts</span>
            </label>
            <select
              id="cta-style"
              value={ctaStyle}
              onChange={(e) => setCtaStyle(e.target.value)}
            >
              <option value="">Keep current CTAs</option>
              {CTA_STYLES.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={updateTimes}
                onChange={(e) => setUpdateTimes(e.target.checked)}
              />
              <span>Reset posting times to platform defaults</span>
              <span className="hint">All {totalPosts} posts will reset to optimized times for {currentPlatform}</span>
            </label>
          </div>

          <div className="preview-box">
            <div className="preview-label">Changes summary:</div>
            <ul className="preview-list">
              {brandMention && <li>✓ Append "{brandMention}" to CTAs</li>}
              {hashtag && <li>✓ Add "{hashtag}" to hashtags</li>}
              {ctaStyle && <li>✓ Update CTA style to "{ctaStyle}"</li>}
              {updateTimes && <li>✓ Reset all posting times</li>}
              {!brandMention && !hashtag && !ctaStyle && !updateTimes && <li className="empty">No changes selected</li>}
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-s" style={{ background: "transparent", borderColor: "var(--border2)", color: "var(--text2)" }} onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-p"
            onClick={handleApply}
            disabled={!brandMention && !hashtag && !ctaStyle && !updateTimes}
            title={!brandMention && !hashtag && !ctaStyle && !updateTimes ? "Select at least one change to apply" : ""}
          >
            Apply to all {totalPosts}
          </button>
        </div>
      </div>
    </div>
  );
};
