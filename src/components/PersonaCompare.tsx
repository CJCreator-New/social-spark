import React, { useState, useEffect } from "react";
import { useRegeneratePostMutation } from "@/hooks/useAppQueries";
import { toast } from "sonner";
import type { Post } from "@/components/wizard/constants";
import { VOICE_OPTIONS, STYLE_OPTIONS } from "@/components/wizard/constants";

interface PersonaCompareProps {
  post: Post;
  platform: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyCompare: (rewrittenPost: Post) => void;
}

interface SavedPersona {
  name: string;
  voice: string;
  style: string;
  audiences?: string[];
  goals?: string[];
}

export const PersonaCompare: React.FC<PersonaCompareProps> = ({
  post,
  platform,
  isOpen,
  onClose,
  onApplyCompare,
}) => {
  const [personas, setPersonas] = useState<SavedPersona[]>([]);
  const [selectedPersonaName, setSelectedPersonaName] = useState<string>("custom");
  const [selectedVoice, setSelectedVoice] = useState<string>(VOICE_OPTIONS[0]);
  const [selectedStyle, setSelectedStyle] = useState<string>(STYLE_OPTIONS[0]);
  const [comparedPost, setComparedPost] = useState<Post | null>(null);

  const regeneratePostMutation = useRegeneratePostMutation();

  // Load saved personas from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("contentforge_personas_v4");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setPersonas(parsed);
          if (parsed.length > 0) {
            // Default to first saved persona if available
            const p = parsed[0];
            setSelectedPersonaName(p.name);
            setSelectedVoice(p.voice);
            setSelectedStyle(p.style);
          }
        }
      }
    } catch (e) {
      console.error("Failed to parse saved personas", e);
    }
  }, [isOpen]);

  // Sync selected voice/style when persona selection changes
  const handlePersonaChange = (name: string) => {
    setSelectedPersonaName(name);
    if (name === "custom") return;
    const found = personas.find(p => p.name === name);
    if (found) {
      setSelectedVoice(found.voice);
      setSelectedStyle(found.style);
    }
  };

  const handleGenerateCompare = async () => {
    try {
      // Build request body matching the regenerate-post spec
      const payload = {
        post,
        voice: selectedVoice,
        style: selectedStyle,
        platform,
        quality: "draft", // Quick comparison
      };

      const result = await regeneratePostMutation.mutateAsync(payload);
      if (result) {
        setComparedPost(result as Post);
        toast.success("Alternate persona version generated ✓");
      }
    } catch (e) {
      toast.error("Failed to generate alternate persona comparison");
      console.error(e);
    }
  };

  const handleApply = () => {
    if (comparedPost) {
      onApplyCompare(comparedPost);
      toast.success("Persona rewrite applied to active post ✓");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 24,
          maxWidth: 960,
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          color: "var(--text)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 500, fontFamily: "var(--font-display)" }}>
              Multi-Persona Comparison
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--text3)" }}>
              Compare active post with alternate voice / writing style persona side-by-side
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text3)",
              fontSize: 24,
              cursor: "pointer",
            }}
          >
            &times;
          </button>
        </div>

        {/* Persona Selectors */}
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            padding: 14,
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border2)",
            borderRadius: 10,
          }}
        >
          {personas.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase" }}>
                Saved Persona
              </label>
              <select
                value={selectedPersonaName}
                onChange={(e) => handlePersonaChange(e.target.value)}
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border2)",
                  borderRadius: 6,
                  padding: "6px 24px 6px 10px",
                  fontSize: 12,
                  color: "var(--text)",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="custom">Custom Configuration</option>
                {personas.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase" }}>
              Target Voice
            </label>
            <select
              value={selectedVoice}
              onChange={(e) => {
                setSelectedVoice(e.target.value);
                setSelectedPersonaName("custom");
              }}
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border2)",
                borderRadius: 6,
                padding: "6px 24px 6px 10px",
                fontSize: 12,
                color: "var(--text)",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase" }}>
              Target Writing Style
            </label>
            <select
              value={selectedStyle}
              onChange={(e) => {
                setSelectedStyle(e.target.value);
                setSelectedPersonaName("custom");
              }}
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border2)",
                borderRadius: 6,
                padding: "6px 24px 6px 10px",
                fontSize: 12,
                color: "var(--text)",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {STYLE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="cpbtn done"
            onClick={handleGenerateCompare}
            disabled={regeneratePostMutation.isPending}
            style={{
              padding: "8px 16px",
              fontSize: 12,
              marginLeft: "auto",
              alignSelf: "flex-end",
            }}
          >
            {regeneratePostMutation.isPending ? "Rewriting…" : "⚡ Compare & Rewrite"}
          </button>
        </div>

        {/* Side-by-Side Content Columns */}
        <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Current Post */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text3)", fontWeight: 500 }}>
              Original Draft
            </div>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.01)",
                border: "1px solid var(--border2)",
                borderRadius: 12,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {post.title && (
                <div>
                  <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Title</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{post.title}</div>
                </div>
              )}
              {post.hook && (
                <div>
                  <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Hook</div>
                  <div style={{ fontStyle: "italic", fontSize: 13, color: "var(--text2)", borderLeft: "2px solid rgba(200,240,154,0.28)", paddingLeft: 10 }}>
                    {post.hook}
                  </div>
                </div>
              )}
              {post.body && (
                <div>
                  <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Body</div>
                  <div style={{ fontSize: 12, color: "var(--text2)", whiteSpace: "pre-line", lineHeight: 1.6 }}>{post.body}</div>
                </div>
              )}
              {post.cta && (
                <div>
                  <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>CTA</div>
                  <div style={{ fontSize: 12, color: "var(--accent)" }}>{post.cta}</div>
                </div>
              )}
            </div>
          </div>

          {/* Alternate Persona Compare Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--accent)", fontWeight: 500, display: "flex", justifyContent: "space-between" }}>
              <span>Alternate Persona Draft</span>
              {comparedPost && (
                <span style={{ fontSize: 10, textTransform: "none", color: "var(--text3)" }}>
                  Voice: {selectedVoice}
                </span>
              )}
            </div>

            {comparedPost ? (
              <div
                style={{
                  background: "rgba(200, 240, 154, 0.02)",
                  border: "1px solid rgba(200, 240, 154, 0.2)",
                  borderRadius: 12,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {comparedPost.title && (
                  <div>
                    <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Title</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{comparedPost.title}</div>
                  </div>
                )}
                {comparedPost.hook && (
                  <div>
                    <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Hook</div>
                    <div style={{ fontStyle: "italic", fontSize: 13, color: "var(--text)", borderLeft: "2px solid var(--accent)", paddingLeft: 10 }}>
                      {comparedPost.hook}
                    </div>
                  </div>
                )}
                {comparedPost.body && (
                  <div>
                    <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>Body</div>
                    <div style={{ fontSize: 12, color: "var(--text)", whiteSpace: "pre-line", lineHeight: 1.6 }}>{comparedPost.body}</div>
                  </div>
                )}
                {comparedPost.cta && (
                  <div>
                    <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>CTA</div>
                    <div style={{ fontSize: 12, color: "var(--accent)" }}>{comparedPost.cta}</div>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px dashed var(--border2)",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.005)",
                  color: "var(--text3)",
                  fontSize: 12,
                  textAlign: "center",
                  padding: 24,
                }}
              >
                {regeneratePostMutation.isPending ? "Generating persona comparison..." : "Click 'Compare & Rewrite' above to generate the side-by-side comparison"}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 16, borderTop: "1px solid var(--border2)" }}>
          <button type="button" className="cpbtn" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="cpbtn done"
            disabled={!comparedPost}
            onClick={handleApply}
          >
            Apply Alternate Version
          </button>
        </div>
      </div>
    </div>
  );
};
export default PersonaCompare;
