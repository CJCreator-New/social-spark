import React, { useState } from "react";

export default function FeedbackModal({ open, onClose, onSubmit, submitting }: { open: boolean; onClose: () => void; onSubmit: (payload: { feedback: string; category?: string; rating?: number }) => Promise<void> | void; submitting?: boolean }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("other");
  const [rating, setRating] = useState(0);

  const resetAndClose = () => {
    setText("");
    setCategory("other");
    setRating(0);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="card" style={{ maxWidth: 740, margin: "18px auto", padding: 18 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Regenerate feedback</div>
          <h3 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)", fontSize: 20 }}>What should change in this post?</h3>
          <div className="mb-2 text-muted-foreground">Add a short note so the rewrite can focus on tone, length, structure, or the CTA. This is optional, but specific feedback works better than a generic retry.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="rounded-lg border border-border bg-transparent px-4 py-2 text-sm text-muted-foreground" onClick={resetAndClose} disabled={submitting}>Cancel</button>
          <button className="control-button" onClick={async () => { await onSubmit({ feedback: text.trim(), category, rating }); resetAndClose(); }} disabled={submitting}>{submitting ? "Sending…" : "Send feedback & regenerate"}</button>
        </div>
      </div>

      <div className="grid gap-4 pt-2">
          <label className="grid gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Category</span>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="control-input"
            >
              <option value="other">General</option>
              <option value="tone">Tone / voice</option>
              <option value="length">Too long / too short</option>
              <option value="hashtags">Hashtags</option>
              <option value="facts">Factual / stats</option>
              <option value="cta">Call to action</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Feedback</span>
            <textarea
              rows={5}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Example: make the hook sharper and cut the body by about 20%"
              className="control-input min-h-[120px] leading-6"
            />
          </label>

          <div className="grid gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Rating</span>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`h-9 w-9 rounded-md border text-sm transition-colors ${n <= rating ? "border-primary/50 bg-accent text-primary" : "border-border bg-transparent text-foreground hover:border-primary/30"}`}
                  aria-pressed={n <= rating}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
