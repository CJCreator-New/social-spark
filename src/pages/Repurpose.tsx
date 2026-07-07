import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { Loader2, Sparkles, Clipboard, RotateCcw } from "lucide-react";
import { WorkspacePage } from "@/components/layout/WorkspacePage";
import { APP_NAME } from "@/constants/branding";
import {
  useExtractIdeasMutation,
  useGenerateFromIdeaMutation,
} from "@/hooks/queries/useRepurposeQueries";
import type { ExtractedIdea, GeneratedPostPayload } from "@/hooks/queries/shared";
import { formatForPlatform, writeToClipboard } from "@/lib/platformCopy";
import "@/styles/pages.css";

const SOURCE_MIN_CHARS = 200;
const SOURCE_MAX_CHARS = 20000;
const IDEAS_MIN = 3;
const IDEAS_MAX = 10;
const SOURCE_STORAGE_KEY = "repurpose-source-draft";

const PLATFORM_OPTIONS = ["LinkedIn", "X", "Instagram", "Facebook", "Newsletter"];

type CardState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; post: GeneratedPostPayload };

function readStoredSource(): string {
  try {
    return window.sessionStorage.getItem(SOURCE_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export default function Repurpose() {
  const [source, setSource] = useState<string>(() => readStoredSource());
  const [count, setCount] = useState(5);
  const [platform, setPlatform] = useState("LinkedIn");
  const [ideas, setIdeas] = useState<ExtractedIdea[] | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [cards, setCards] = useState<Record<number, CardState>>({});

  const extractMutation = useExtractIdeasMutation();
  const generateMutation = useGenerateFromIdeaMutation();

  // Draft recovery: keep the pasted source for the session so navigating
  // away and back does not lose it.
  useEffect(() => {
    try {
      if (source) window.sessionStorage.setItem(SOURCE_STORAGE_KEY, source);
      else window.sessionStorage.removeItem(SOURCE_STORAGE_KEY);
    } catch {
      // Storage unavailable (private mode) — feature still works without recovery.
    }
  }, [source]);

  const trimmedLength = source.trim().length;
  const tooShort = trimmedLength > 0 && trimmedLength < SOURCE_MIN_CHARS;
  const tooLong = trimmedLength > SOURCE_MAX_CHARS;
  const canExtract = trimmedLength >= SOURCE_MIN_CHARS && !tooLong && !extractMutation.isPending;

  const handleExtract = async () => {
    if (!canExtract) return;
    setExtractError(null);
    setIdeas(null);
    setCards({});
    try {
      const result = await extractMutation.mutateAsync({
        source: source.trim(),
        count,
        platform,
      });
      if (!result.length) {
        setExtractError(
          "No usable ideas came back for this material. Try a longer or more substantive source."
        );
        return;
      }
      setIdeas(result);
      if (result.length < count) {
        toast.info(
          `The source supported ${result.length} distinct ideas (you asked for ${count}).`
        );
      }
    } catch (e) {
      const message =
        e instanceof Error && e.message
          ? e.message
          : "Idea extraction failed. Please try again.";
      setExtractError(message);
    }
  };

  const handleGenerate = async (idea: ExtractedIdea, index: number) => {
    setCards((prev) => ({ ...prev, [index]: { status: "loading" } }));
    try {
      const post = await generateMutation.mutateAsync({ idea, platform });
      setCards((prev) => ({ ...prev, [index]: { status: "done", post } }));
    } catch (e) {
      const message =
        e instanceof Error && e.message
          ? e.message
          : "Generation failed. Please try again.";
      setCards((prev) => ({ ...prev, [index]: { status: "error", message } }));
    }
  };

  const handleCopy = async (post: GeneratedPostPayload) => {
    const formatted = formatForPlatform(
      {
        title: post.title,
        hook: post.hook,
        body: post.body,
        cta: post.cta,
        hashtags: post.hashtags,
      },
      platform
    );
    const ok = await writeToClipboard(formatted.text);
    if (ok) toast.success(`${formatted.platformLabel}-ready copy on your clipboard.`);
    else toast.error("Could not access the clipboard.");
  };

  return (
    <>
      <Helmet>
        <title>Repurpose Studio — {APP_NAME}</title>
      </Helmet>
      <WorkspacePage size="wide">
        <div className="sc-head">
          <h1 className="sc-title">
            Repurpose <em>studio</em>
          </h1>
        </div>
        <p className="rp-lede">
          Paste long-form material — a blog post, newsletter, or transcript — and turn it into
          distinct, platform-ready posts.
        </p>

        <section className="rp-card" aria-label="Source material">
          <label className="rp-label" htmlFor="rp-source">
            Paste your source material
          </label>
          <textarea
            id="rp-source"
            className="rp-textarea"
            placeholder="Paste the article, newsletter, or transcript you want to repurpose…"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            rows={10}
          />
          <div className="rp-input-meta">
            <span
              className={`rp-counter${tooLong ? " rp-counter-over" : ""}`}
              aria-live="polite"
            >
              {trimmedLength.toLocaleString()} / {SOURCE_MAX_CHARS.toLocaleString()} characters
            </span>
            <span className="rp-hint">Complete, self-contained text works best.</span>
          </div>
          {tooShort && (
            <p className="rp-validation" role="alert">
              Add at least {SOURCE_MIN_CHARS} characters so there is enough material to extract
              ideas from.
            </p>
          )}
          {tooLong && (
            <p className="rp-validation" role="alert">
              Source material must be under {SOURCE_MAX_CHARS.toLocaleString()} characters —
              trim it down to the section you want to repurpose.
            </p>
          )}

          <div className="rp-controls">
            <label className="rp-control">
              <span className="rp-control-label">Number of ideas</span>
              <select
                className="sc-sel"
                aria-label="Number of ideas"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              >
                {Array.from({ length: IDEAS_MAX - IDEAS_MIN + 1 }).map((_, i) => (
                  <option key={IDEAS_MIN + i} value={IDEAS_MIN + i}>
                    {IDEAS_MIN + i}
                  </option>
                ))}
              </select>
            </label>
            <label className="rp-control">
              <span className="rp-control-label">Target platform</span>
              <select
                className="sc-sel"
                aria-label="Target platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rp-primary-btn"
              onClick={handleExtract}
              disabled={!canExtract}
            >
              {extractMutation.isPending ? (
                <>
                  <Loader2 size={14} className="rp-spin" aria-hidden />
                  Extracting ideas…
                </>
              ) : (
                <>
                  <Sparkles size={14} aria-hidden />
                  Extract ideas
                </>
              )}
            </button>
          </div>

          {extractError && (
            <div className="rp-error" role="alert">
              <span>{extractError}</span>
              <button type="button" className="rp-retry-btn" onClick={handleExtract}>
                <RotateCcw size={12} aria-hidden /> Retry
              </button>
            </div>
          )}
        </section>

        {ideas && (
          <section className="rp-ideas" aria-label="Extracted ideas">
            <h2 className="rp-section-title">
              {ideas.length} idea{ideas.length === 1 ? "" : "s"} for {platform}
            </h2>
            {ideas.map((idea, index) => {
              const card = cards[index] || { status: "idle" };
              return (
                <article key={`${idea.title}-${index}`} className="rp-idea-card">
                  <div className="rp-idea-head">
                    <div>
                      <span className="rp-format-badge">{idea.format}</span>
                      <h3 className="rp-idea-title">{idea.title}</h3>
                      <p className="rp-idea-rationale">{idea.rationale}</p>
                    </div>
                    <button
                      type="button"
                      className="rp-primary-btn"
                      onClick={() => handleGenerate(idea, index)}
                      disabled={card.status === "loading"}
                    >
                      {card.status === "loading" ? (
                        <>
                          <Loader2 size={14} className="rp-spin" aria-hidden />
                          Generating…
                        </>
                      ) : card.status === "done" ? (
                        <>
                          <RotateCcw size={14} aria-hidden />
                          Regenerate
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} aria-hidden />
                          Generate post
                        </>
                      )}
                    </button>
                  </div>

                  {card.status === "error" && (
                    <div className="rp-error" role="alert">
                      <span>{card.message}</span>
                      <button
                        type="button"
                        className="rp-retry-btn"
                        onClick={() => handleGenerate(idea, index)}
                      >
                        <RotateCcw size={12} aria-hidden /> Retry
                      </button>
                    </div>
                  )}

                  {card.status === "done" && (
                    <div className="rp-post">
                      {card.post.title && <h4 className="rp-post-title">{card.post.title}</h4>}
                      {card.post.hook && <p className="rp-post-hook">{card.post.hook}</p>}
                      {card.post.body && <p className="rp-post-body">{card.post.body}</p>}
                      {card.post.cta && <p className="rp-post-cta">{card.post.cta}</p>}
                      {card.post.hashtags && (
                        <p className="rp-post-hashtags">{String(card.post.hashtags)}</p>
                      )}
                      <div className="rp-post-actions">
                        <button
                          type="button"
                          className="rp-secondary-btn"
                          onClick={() => handleCopy(card.post)}
                        >
                          <Clipboard size={12} aria-hidden /> Copy for {platform}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </WorkspacePage>
    </>
  );
}
