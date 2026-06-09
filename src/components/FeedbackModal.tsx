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
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(200,240,154,0.12)", background: "rgba(200,240,154,0.06)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em", color: "#c8f09a", fontWeight: 600 }}>Regenerate feedback</div>
          <h3 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)", fontSize: 20 }}>What should change in this post?</h3>
          <div style={{ color: "#7a7a8e", marginBottom: 8 }}>Add a short note so the rewrite can focus on tone, length, structure, or the CTA. This is optional, but specific feedback works better than a generic retry.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm text-[#9a9aae]" onClick={resetAndClose} disabled={submitting}>Cancel</button>
          <button className="rounded-lg border border-[#c8f09a]/30 bg-[#c8f09a] px-4 py-2 text-sm font-medium text-[#07080d]" onClick={async () => { await onSubmit({ feedback: text.trim(), category, rating }); resetAndClose(); }} disabled={submitting}>{submitting ? "Sending…" : "Send feedback & regenerate"}</button>
        </div>
      </div>

      <div className="grid gap-4 pt-2">
          <label className="grid gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#7a7a8e]">Category</span>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#07080d] px-3 py-2 text-sm text-[#edeae3] outline-none transition-colors focus:border-[#c8f09a]/40"
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
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#7a7a8e]">Feedback</span>
            <textarea
              rows={5}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Example: make the hook sharper and cut the body by about 20%"
              className="min-h-[120px] rounded-lg border border-white/10 bg-[#07080d] px-3 py-3 text-sm leading-6 text-[#edeae3] outline-none transition-colors placeholder:text-[#5a5a72] focus:border-[#c8f09a]/40"
            />
          </label>

          <div className="grid gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#7a7a8e]">Category</span>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#07080d] px-3 py-2 text-sm text-[#edeae3] outline-none transition-colors focus:border-[#c8f09a]/40"
            >
              <option value="other">General</option>
              <option value="tone">Tone / voice</option>
              <option value="length">Too long / too short</option>
              <option value="hashtags">Hashtags</option>
              <option value="facts">Factual / stats</option>
              <option value="cta">Call to action</option>
            </select>
          </div>

          <div className="grid gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#7a7a8e]">Feedback</span>
            <textarea
              rows={5}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Example: make the hook sharper and cut the body by about 20%"
              className="min-h-[120px] rounded-lg border border-white/10 bg-[#07080d] px-3 py-3 text-sm leading-6 text-[#edeae3] outline-none transition-colors placeholder:text-[#5a5a72] focus:border-[#c8f09a]/40"
            />
          </div>

          <div className="grid gap-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#7a7a8e]">Rating</span>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`h-9 w-9 rounded-md border text-sm transition-colors ${n <= rating ? "border-[#c8f09a]/50 bg-[#c8f09a]/10 text-[#c8f09a]" : "border-white/10 bg-transparent text-[#edeae3] hover:border-[#c8f09a]/30"}`}
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
