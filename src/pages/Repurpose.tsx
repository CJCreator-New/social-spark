import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { Loader2, Sparkles, Clipboard, RotateCcw, BookmarkPlus, Link2 } from "lucide-react";
import { WorkspacePage } from "@/components/layout/WorkspacePage";
import { APP_NAME } from "@/constants/branding";
import { useAuth } from "@/contexts/AuthContext";
import {
  useExtractIdeasMutation,
  useGenerateFromIdeaMutation,
} from "@/hooks/queries/useRepurposeQueries";
import {
  useIdeaBacklogQuery,
  useAddIdeasToBacklogMutation,
  useMarkIdeaUsedMutation,
  useRemoveIdeaFromBacklogMutation,
} from "@/hooks/useAppQueries";
import { useFetchUrlContent } from "@/hooks/useFetchUrlContent";
import { IdeaBacklogPanel } from "@/components/IdeaBacklogPanel";
import type {
  ExtractedIdea,
  GeneratedPostPayload,
  IdeaBacklogRow,
} from "@/hooks/queries/shared";
import { formatForPlatform, writeToClipboard } from "@/lib/platformCopy";
import "@/styles/pages.css";

const URL_FETCH_MIN_WORDS = 40;

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
  const [savedIdeaKeys, setSavedIdeaKeys] = useState<Set<string>>(new Set());

  const [sourceMode, setSourceMode] = useState<"paste" | "url">("paste");
  const [urlInput, setUrlInput] = useState("");
  const [urlMeta, setUrlMeta] = useState<{ title: string; wordCount: number } | null>(null);
  const [removingBacklogId, setRemovingBacklogId] = useState<string | null>(null);

  const extractMutation = useExtractIdeasMutation();
  const generateMutation = useGenerateFromIdeaMutation();

  const { user } = useAuth();
  const backlogQuery = useIdeaBacklogQuery(user?.id);
  const addToBacklogMutation = useAddIdeasToBacklogMutation(user?.id);
  const markIdeaUsedMutation = useMarkIdeaUsedMutation(user?.id);
  const removeIdeaMutation = useRemoveIdeaFromBacklogMutation(user?.id);
  const { fetchUrl, loading: urlFetchLoading, error: urlFetchError } = useFetchUrlContent();

  const unusedBacklogIdeas = useMemo(
    () => (backlogQuery.data || []).filter((item) => !item.used_at),
    [backlogQuery.data]
  );

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
    setSavedIdeaKeys(new Set());
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

  const handleSaveIdeaToBacklog = async (idea: ExtractedIdea, index: number) => {
    if (!user?.id) {
      toast.error("Sign in to save ideas to your backlog.");
      return;
    }
    try {
      await addToBacklogMutation.mutateAsync({ ideas: [idea], sourceText: source, platform });
      setSavedIdeaKeys((prev) => new Set(prev).add(`${idea.title}-${index}`));
      toast.success("Saved to your idea backlog.");
    } catch (e) {
      toast.error(
        e instanceof Error && e.message ? e.message : "Could not save this idea. Please try again."
      );
    }
  };

  const handleSaveAllIdeasToBacklog = async () => {
    if (!user?.id) {
      toast.error("Sign in to save ideas to your backlog.");
      return;
    }
    if (!ideas || ideas.length === 0) return;
    try {
      await addToBacklogMutation.mutateAsync({ ideas, sourceText: source, platform });
      setSavedIdeaKeys(new Set(ideas.map((idea, index) => `${idea.title}-${index}`)));
      toast.success(`Saved ${ideas.length} idea${ideas.length === 1 ? "" : "s"} to your backlog.`);
    } catch (e) {
      toast.error(
        e instanceof Error && e.message ? e.message : "Could not save these ideas. Please try again."
      );
    }
  };

  const handleDraftFromBacklog = async (item: IdeaBacklogRow) => {
    try {
      await markIdeaUsedMutation.mutateAsync(item.id);
    } catch {
      // Non-fatal — still let the user draft the post even if the "used" flag
      // didn't persist; they can retry marking it used later.
    }
    const idea: ExtractedIdea = {
      title: item.angle,
      format: item.format || "",
      rationale: item.rationale || "",
      key_points: item.key_points || "",
    };
    const newIndex = ideas?.length ?? 0;
    setIdeas((prev) => [...(prev || []), idea]);
    await handleGenerate(idea, newIndex);
  };

  const handleRemoveBacklogIdea = async (id: string) => {
    setRemovingBacklogId(id);
    try {
      await removeIdeaMutation.mutateAsync(id);
    } catch (e) {
      toast.error(
        e instanceof Error && e.message ? e.message : "Could not remove this idea. Please try again."
      );
    } finally {
      setRemovingBacklogId(null);
    }
  };

  const handleFetchUrl = async () => {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) return;
    const result = await fetchUrl(trimmedUrl);
    if (result) {
      setSource(result.text);
      setUrlMeta({ title: result.title, wordCount: result.wordCount });
      if (result.wordCount < URL_FETCH_MIN_WORDS) {
        toast.info(
          "This page may require JavaScript to render — try pasting the text manually."
        );
      }
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

        <IdeaBacklogPanel
          items={unusedBacklogIdeas}
          loading={backlogQuery.isLoading}
          onDraftIdea={handleDraftFromBacklog}
          onRemoveIdea={handleRemoveBacklogIdea}
          removingId={removingBacklogId}
        />

        <section className="rp-card" aria-label="Source material">
          <div className="rp-mode-tabs" role="tablist" aria-label="Source input mode">
            <button
              type="button"
              role="tab"
              aria-selected={sourceMode === "paste"}
              className={`rp-mode-tab ${sourceMode === "paste" ? "on" : ""}`}
              onClick={() => setSourceMode("paste")}
            >
              Paste text
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sourceMode === "url"}
              className={`rp-mode-tab ${sourceMode === "url" ? "on" : ""}`}
              onClick={() => setSourceMode("url")}
            >
              <Link2 size={12} aria-hidden style={{ marginRight: 4 }} />
              From URL
            </button>
          </div>

          {sourceMode === "url" && (
            <>
              <div className="rp-url-row">
                <input
                  type="url"
                  className="rp-url-input"
                  aria-label="Source URL"
                  placeholder="https://example.com/article"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <button
                  type="button"
                  className="rp-primary-btn"
                  onClick={handleFetchUrl}
                  disabled={!urlInput.trim() || urlFetchLoading}
                >
                  {urlFetchLoading ? (
                    <>
                      <Loader2 size={14} className="rp-spin" aria-hidden />
                      Fetching…
                    </>
                  ) : (
                    "Fetch"
                  )}
                </button>
              </div>
              {urlFetchError && (
                <div className="rp-error" role="alert">
                  <span>{urlFetchError}</span>
                  <button type="button" className="rp-retry-btn" onClick={handleFetchUrl}>
                    <RotateCcw size={12} aria-hidden /> Retry
                  </button>
                </div>
              )}
              {urlMeta && (
                <p className="rp-url-meta">
                  Fetched "{urlMeta.title || "Untitled page"}" — {urlMeta.wordCount.toLocaleString()}{" "}
                  words.
                </p>
              )}
              {urlMeta && urlMeta.wordCount < URL_FETCH_MIN_WORDS && (
                <p className="rp-url-warning" role="alert">
                  This page may require JavaScript to render — try pasting the text manually.
                </p>
              )}
            </>
          )}

          <label className="rp-label" htmlFor="rp-source">
            {sourceMode === "url" ? "Review and edit the fetched text" : "Paste your source material"}
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
            <div className="rp-idea-actions" style={{ marginBottom: 12 }}>
              <h2 className="rp-section-title" style={{ margin: 0 }}>
                {ideas.length} idea{ideas.length === 1 ? "" : "s"} for {platform}
              </h2>
              <button
                type="button"
                className="rp-secondary-btn"
                onClick={handleSaveAllIdeasToBacklog}
                disabled={addToBacklogMutation.isPending}
              >
                <BookmarkPlus size={12} aria-hidden /> Save all to backlog
              </button>
            </div>
            {ideas.map((idea, index) => {
              const card = cards[index] || { status: "idle" };
              const ideaKey = `${idea.title}-${index}`;
              const isSaved = savedIdeaKeys.has(ideaKey);
              return (
                <article key={ideaKey} className="rp-idea-card">
                  <div className="rp-idea-head">
                    <div>
                      <span className="rp-format-badge">{idea.format}</span>
                      <h3 className="rp-idea-title">{idea.title}</h3>
                      <p className="rp-idea-rationale">{idea.rationale}</p>
                    </div>
                    <div className="rp-idea-actions">
                      <button
                        type="button"
                        className="rp-secondary-btn"
                        onClick={() => handleSaveIdeaToBacklog(idea, index)}
                        disabled={isSaved || addToBacklogMutation.isPending}
                      >
                        <BookmarkPlus size={12} aria-hidden />
                        {isSaved ? "Saved" : "Save to backlog"}
                      </button>
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
