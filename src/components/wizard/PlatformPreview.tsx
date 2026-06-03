import React from "react";
import { Post } from "./constants";
import { niceLabelFor, stripMarkdown } from "@/lib/platformCopy";

export function renderLinkedInPreviewText(text: string) {
  return text.split(/\n/).map((line, lineIndex) => {
    const chunks = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <div key={lineIndex} style={{ marginBottom: lineIndex === 0 ? 0 : 8 }}>
        {chunks.map((chunk, chunkIndex) => {
          if (chunk.startsWith("**") && chunk.endsWith("**")) {
            return <strong key={`${lineIndex}-${chunkIndex}`}>{chunk.slice(2, -2)}</strong>;
          }
          return <span key={`${lineIndex}-${chunkIndex}`}>{chunk}</span>;
        })}
      </div>
    );
  });
}

interface PlatformPreviewProps {
  post: Post;
  platform: string;
  selectedIndustryLabel: string;
}

export function PlatformPreview({ post, platform, selectedIndustryLabel }: PlatformPreviewProps) {
  const previewSource = [post.title, post.hook, post.body, post.cta].join("\n\n");
  const previewPlain = stripMarkdown(previewSource);

  return (
    <div className="li-preview">
      <div className="li-head">
        <div className="li-avatar">{(selectedIndustryLabel || platform || "C").slice(0, 1)}</div>
        <div>
          <div className="li-name">{selectedIndustryLabel || "ContentForge"}</div>
          <div className="li-meta">{niceLabelFor(platform)} preview</div>
        </div>
        <div className="li-dot" />
      </div>
      <div className="li-body">
        <div className="li-content">{renderLinkedInPreviewText(previewSource)}</div>
        {previewPlain.length > 210 && (
          <>
            <div className="li-fade" />
            <div className="li-more">See more</div>
          </>
        )}
      </div>
      <div className="li-tags">
        {post.hashtags.split(/\s+/).filter(Boolean).map(tag => (
          <span key={tag} className="li-tag">{tag}</span>
        ))}
      </div>
    </div>
  );
}
