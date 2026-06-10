import React, { useState } from "react";
import { useGeneratePostImageMutation } from "@/hooks/useAppQueries";
import { Post } from "./constants";
import { toast } from "sonner";

interface CoverImageGeneratorProps {
  post: Post;
  calendarId: string;
  onApplyImage: (imageUrl: string) => void;
  onClose: () => void;
}

export const CoverImageGenerator: React.FC<CoverImageGeneratorProps> = ({
  post,
  calendarId,
  onApplyImage,
  onClose,
}) => {
  const [prompt, setPrompt] = useState(post.image_prompt || `${post.title}. Modern digital art, vector illustration.`);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(post.cover_image || null);
  const generateMutation = useGeneratePostImageMutation();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter an image prompt");
      return;
    }

    try {
      const data = await generateMutation.mutateAsync({
        calendarId: calendarId || "guest-calendar",
        postDay: post.day,
        post: {
          title: post.title,
          hook: post.hook,
          body: post.body,
          cta: post.cta,
          hashtags: post.hashtags,
          topic: post.topic,
          format: post.format,
        },
        prompt: prompt.trim(),
        aspectRatio,
      });

      if (data?.publicUrl) {
        setGeneratedUrl(data.publicUrl);
        toast.success("Cover image generated successfully ✓");
      } else {
        throw new Error("No image URL returned");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to generate image");
    }
  };

  return (
    <div className="custom-modal-overlay">
      <div className="custom-modal-content" style={{ maxWidth: 500, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 20, fontFamily: "var(--font-heading)", fontWeight: "bold" }}>AI Cover Image Generator</h3>
          <button onClick={onClose} className="cpbtn" style={{ padding: "4px 8px" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Image Description / Prompt
            </label>
            <textarea
              className="text-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              style={{ width: "100%", fontSize: 13, padding: 10 }}
              placeholder="Describe the image you want to generate..."
            />
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: "bold", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Aspect Ratio
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "var(--color-bg)",
                  border: "2px solid var(--color-border)",
                  color: "var(--color-text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  outline: "none",
                }}
              >
                <option value="1:1">Square (1:1)</option>
                <option value="16:9">Landscape (16:9)</option>
                <option value="9:16">Portrait (9:16)</option>
              </select>
            </div>
          </div>

          {generateMutation.isPending && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ display: "inline-block", width: 24, height: 24, border: "3px solid var(--color-border)", borderTopColor: "var(--color-primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--color-muted)", fontFamily: "var(--font-mono)" }}>
                Generating visual concept...
              </div>
            </div>
          )}

          {generatedUrl && !generateMutation.isPending && (
            <div className="bg-card" style={{ border: "2px solid var(--color-border)", borderRadius: 4, overflow: "hidden" }}>
              <img
                src={generatedUrl}
                alt="Generated concept"
                style={{ width: "100%", height: "auto", display: "block", maxHeight: 300, objectFit: "contain" }}
              />
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="cpbtn"
              style={{ flex: 1, padding: "10px 16px", background: "var(--color-primary)", color: "var(--color-bg)", fontWeight: "bold" }}
            >
              {generateMutation.isPending ? "Generating..." : "Generate Concept"}
            </button>
            {generatedUrl && (
              <button
                onClick={() => {
                  onApplyImage(generatedUrl);
                  onClose();
                }}
                className="cpbtn"
                style={{ flex: 1, padding: "10px 16px" }}
              >
                Apply Image
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
