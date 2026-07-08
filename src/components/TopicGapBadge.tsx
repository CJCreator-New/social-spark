import React, { useState } from "react";

interface TopicGapBadgeProps {
  topic: string;
  rationale?: string;
  isInferred: boolean;
}

export const TopicGapBadge: React.FC<TopicGapBadgeProps> = ({ topic, rationale, isInferred }) => {
  const [showPopover, setShowPopover] = useState(false);

  if (!isInferred) return null;

  return (
    <div
      className="topic-gap-wrapper"
      onMouseEnter={() => setShowPopover(true)}
      onMouseLeave={() => setShowPopover(false)}
    >
      <span className="topic-gap-badge" role="status">
        🤖 AI-inferred topic
      </span>
      {showPopover && rationale && (
        <div className="topic-gap-popover">
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Why this topic?</div>
          <div>{rationale}</div>
        </div>
      )}
    </div>
  );
};
