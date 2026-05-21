import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !submitting) resetAndClose(); }}>
      <DialogContent className="max-w-xl border border-white/10 bg-[#0d0f18] text-[#edeae3] shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <DialogHeader className="space-y-3 text-left">
          <div className="inline-flex w-fit items-center rounded-full border border-[#c8f09a]/20 bg-[#c8f09a]/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#c8f09a]">
            Regenerate feedback
          </div>
          <DialogTitle className="font-['Playfair_Display'] text-2xl font-normal tracking-tight">
            What should change in this post?
          </DialogTitle>
          <DialogDescription className="max-w-prose text-sm leading-6 text-[#7a7a8e]">
            Add a short note so the rewrite can focus on tone, length, structure, or the CTA. This is optional, but specific feedback works better than a generic retry.
          </DialogDescription>
        </DialogHeader>

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

        <DialogFooter className="pt-2 sm:justify-end">
          <button
            className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm text-[#9a9aae] transition-colors hover:border-[#c8f09a]/30 hover:text-[#c8f09a]"
            onClick={resetAndClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="rounded-lg border border-[#c8f09a]/30 bg-[#c8f09a] px-4 py-2 text-sm font-medium text-[#07080d] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={async () => {
              await onSubmit({ feedback: text.trim(), category, rating });
              resetAndClose();
            }}
            disabled={submitting}
          >
            {submitting ? "Sending…" : "Send feedback & regenerate"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
