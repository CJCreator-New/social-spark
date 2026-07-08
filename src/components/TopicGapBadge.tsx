import React, { useState } from "react";

interface TopicGapBadgeProps {
  topic: string;
  rationale?: string;
  isInferred: boolean;
  isMissing?: boolean;
  isTrending?: boolean;
  onGenerate?: () => void;
  generating?: boolean;
}

export const TopicGapBadge: React.FC<TopicGapBadgeProps> = ({
  topic,
  rationale,
  isInferred,
  isMissing = false,
  isTrending = false,
  onGenerate,
  generating = false,
}) => {
  const [showPopover, setShowPopover] = useState(false);

  // If it's neither inferred nor missing, don't show anything
  if (!isInferred && !isMissing) return null;

  return (
    <div
      className="topic-gap-wrapper"
      style={{
        position: "relative",
        display: "inline-block",
      }}
      onMouseEnter={() => setShowPopover(true)}
      onMouseLeave={() => setShowPopover(false)}
    >
      <span
        className={`topic-gap-badge ${isMissing ? "missing-gap" : ""}`}
        role="status"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          background: isMissing ? "transparent" : "var(--surface)",
          color: isMissing ? "var(--text2)" : "var(--accent)",
          border: isMissing ? "1px dashed var(--border2)" : "1px solid var(--border2)",
          cursor: "pointer",
        }}
      >
        {isMissing ? `🔍 ${topic}` : `🤖 AI: ${topic}`}
        {isTrending && <span style={{ fontSize: 10 }}>🔥</span>}
      </span>

      {showPopover && (
        <div
          className="topic-gap-popover"
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: 8,
            width: 240,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 12,
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
            zIndex: 100,
            color: "var(--text)",
            fontSize: 11,
          }}
        >
          {isMissing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <strong>Missing Theme:</strong> This topic is in your campaign plan but has no draft posts yet.
                {isTrending && <span style={{ color: "var(--accent)", display: "block", marginTop: 4 }}>🔥 Trending topic on feed algorithm!</span>}
              </div>
              {onGenerate && (
                <button
                  type="button"
                  className="cpbtn done"
                  disabled={generating}
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerate();
                  }}
                  style={{
                    width: "100%",
                    fontSize: 11,
                    padding: "4px 8px",
                    textAlign: "center",
                  }}
                >
                  {generating ? "Generating..." : "Generate post for this theme"}
                </button>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>AI-Inferred Theme</div>
              <div>{rationale || "AI inferred this topic based on the core focus of your posts."}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
