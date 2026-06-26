import React, { Suspense, useState, useRef, useEffect, useMemo, useCallback, lazy } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getE2EAuthFlag, E2E_USER_ID, E2E_CALENDAR } from "@/lib/e2eFixtures";
import e2eStore from "@/lib/e2eStore";
import { toast } from "sonner";
import storageService from "@/lib/storageService";
import mediaManager from "@/lib/mediaManager";
import { SAMPLE_POSTS, SAMPLE_FORM, SAMPLE_POST_TIMES } from "@/lib/sampleCalendar";
import type { BatchEditPayload } from "@/components/BatchEditModal";
import { createScopedLogger } from "@/lib/logger";
import { getUserFriendlyMessage } from "@/lib/errors";
import telemetry from "@/lib/telemetry";
import { downloadIcs, nextMonday, toDateInputValue, parseLocalDate, dateForDow, shortDateLabel } from "@/lib/calendarSchedule";
import { formatForPlatform, writeToClipboard, PLATFORM_LIMITS, resolvePlatform, niceLabelFor, buildRawMarkdown, stripMarkdown } from "@/lib/platformCopy";
import { suggestedTimeForDay } from "@/lib/postingTimes";
import { getVoiceStylePreview } from "@/lib/voiceStylePreview";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useCreateCalendarMutation, useRegeneratePostMutation, useProfileQuery, useProfileUpdateMutation } from "@/hooks/useAppQueries";
import { swapItems, handleDragStart, handleDragOver, handleDrop } from "@/lib/dragDrop";
import { calculatePerformanceScore, getWeakestPerformanceMetric, type PerformanceFocusMetric, getRegenerationGuidance, getWeakestMetrics } from "@/lib/postPerformanceScore";
import { createSeedFromPost, storeSeed, readAndClearSeed } from "@/lib/seedFromPost";
import { isEnabled } from "@/lib/featureFlags";
import { buildBrandMemoryPrompt, generateWithFallback } from "@/lib/brandMemory";
import { WorkspacePage } from "@/components/layout/WorkspacePage";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import type { Database, Json } from "@/integrations/supabase/types";
import { FontStyle, applyStyle } from "@/lib/unicodeFonts";
import { useWizardStore } from "@/stores/useWizardStore";
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { OnboardingTour } from "@/components/OnboardingTour";

// Lazy load components to optimize bundle size
const DraftRecoveryDialog = lazy(() => import("@/components/DraftRecoveryDialog").then(m => ({ default: m.DraftRecoveryDialog })));
const BatchEditModal = lazy(() => import("@/components/BatchEditModal").then(m => ({ default: m.BatchEditModal })));
const PerformanceScoreCard = lazy(() => import("@/components/PerformanceScoreCard").then(m => ({ default: m.PerformanceScoreCard })));
const PostInsights = lazy(() => import("@/components/PostInsights"));
const DiffView = lazy(() => import("@/components/DiffView").then(m => ({ default: m.DiffView })));
const ToneConsistencyChecker = lazy(() => import("@/components/ToneConsistencyChecker").then(m => ({ default: m.ToneConsistencyChecker })));
const InspirationBank = lazy(() => import("@/components/InspirationBank").then(m => ({ default: m.InspirationBank })));
const CoverImageGenerator = lazy(() => import("@/components/wizard/CoverImageGenerator").then(m => ({ default: m.CoverImageGenerator })));
const IndexResults = lazy(() => import("./IndexResults"));

import "./Index.css";
import {
  Post,
  WizardForm,
  BrandMemory,
  WizardDraftSnapshot,
  INDUSTRIES,
  INDUSTRY_TOPICS,
  PLATFORM_OPTIONS,
  AUDIENCE_PRESETS,
  VOICE_OPTIONS,
  STYLE_OPTIONS,
  POST_TYPE_OPTIONS,
  FORMAT_OPTIONS,
  CTA_OPTIONS,
  COPY_STYLE_OPTIONS,
  COPY_STYLE_MAP,
  GOAL_OPTIONS,
  LENGTH_OPTIONS,
  STRUCTURE_OPTIONS,
  EMPTY_POST,
  INITIAL_FORM,
  DRAFT_VERSION,
  DRAFT_MAX_AGE_MS,
  WIZARD_DRAFT_PREFIX,
  WIZARD_SERVER_DRAFT_TABLE,
  BRAND_MEMORY_PREFIX,
} from "@/components/wizard/constants";
import { SelectField } from "@/components/wizard/SelectField";
import { MultiSelect } from "@/components/wizard/MultiSelect";
import { ReformatBar } from "@/components/wizard/ReformatBar";

function Check() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ms-chk-svg">
      <path d="M1.5 4.5L3.5 6.5L7.5 2.5" />
    </svg>
  );
}

function baseFormatLabel(format: string) {
  return (format || "Unspecified").split("—")[0].split("-")[0].trim() || "Unspecified";
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(v => String(v).trim()).filter(Boolean)));
}

function unwrapPost(value: unknown): Post | null {
  if (!value || typeof value !== "object") return null;
  const candidate = "post" in value ? (value as { post?: unknown }).post : value;
  if (!candidate || typeof candidate !== "object") return null;

  const nestedCandidate = "post" in candidate
    ? (candidate as { post?: unknown }).post
    : "posts" in candidate && Array.isArray((candidate as { posts?: unknown[] }).posts)
      ? (candidate as { posts?: unknown[] }).posts?.[0]
      : candidate;

  if (!nestedCandidate || typeof nestedCandidate !== "object") return null;
  const post = nestedCandidate as Partial<Post>;
  return typeof post.day === "number" && typeof post.dow === "string"
    ? { ...EMPTY_POST, ...post }
    : null;
}

function unwrapPosts(value: unknown): Post[] {
  if (!value || typeof value !== "object") return [];
  const candidate = value as Record<string, unknown>;

  if (Array.isArray(candidate.posts)) {
    return candidate.posts.map(unwrapPost).filter((p): p is Post => !!p);
  }

  const post = unwrapPost(value);
  return post ? [post] : [];
}

let wizardDraftServerAvailable = true;

function brandMemoryKey(userId?: string | null) {
  return `${BRAND_MEMORY_PREFIX}${userId || "guest"}`;
}

function readBrandMemory(userId?: string | null): BrandMemory | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(brandMemoryKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BrandMemory> | null;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      voice: String(parsed.voice || ""),
      style: String(parsed.style || ""),
      copyStyle: String(parsed.copyStyle || "Keep plain text (recommended)"),
      cta: String(parsed.cta || ""),
      audiences: Array.isArray(parsed.audiences) ? parsed.audiences.map(v => String(v).trim()).filter(Boolean) : [],
      goals: Array.isArray(parsed.goals) ? parsed.goals.map(v => String(v).trim()).filter(Boolean) : [],
      bannedWords: Array.isArray(parsed.bannedWords) ? parsed.bannedWords.map(v => String(v).trim()).filter(Boolean) : [],
      requiredWords: Array.isArray(parsed.requiredWords) ? parsed.requiredWords.map(v => String(v).trim()).filter(Boolean) : [],
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

function writeBrandMemory(userId: string | null | undefined, memory: BrandMemory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(brandMemoryKey(userId), JSON.stringify(memory));
  } catch {
    /* best effort */
  }
}

function clearBrandMemory(userId: string | null | undefined) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(brandMemoryKey(userId));
  } catch {
    /* best effort */
  }
}

function brandMemoryToPrompt(memory: BrandMemory | null): string {
  if (!memory) return "";
  const parts = [
    memory.voice ? `Voice: ${memory.voice}` : "",
    memory.style ? `Style: ${memory.style}` : "",
    memory.copyStyle && memory.copyStyle !== "Keep plain text (recommended)" ? `Copy style: ${memory.copyStyle}` : "",
    memory.cta ? `CTA style: ${memory.cta}` : "",
    memory.audiences.length ? `Audience preferences: ${memory.audiences.join(", ")}` : "",
    memory.goals.length ? `Goal preferences: ${memory.goals.join(", ")}` : "",
    memory.bannedWords.length ? `Avoid these phrases: ${memory.bannedWords.join(", ")}` : "",
    memory.requiredWords.length ? `Prefer these phrases: ${memory.requiredWords.join(", ")}` : "",
  ].filter(Boolean);
  return parts.join(" | ");
}

function buildBrandMemorySnapshot(form: WizardForm): BrandMemory {
  return {
    voice: form.voice,
    style: form.style,
    copyStyle: form.copyStyle,
    cta: form.cta,
    audiences: [...form.audiences],
    goals: [...form.goals],
    bannedWords: [...form.bannedWords],
    requiredWords: [...form.requiredWords],
    updatedAt: Date.now(),
  };
}

function isMissingWizardDraftTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; message?: unknown; details?: unknown };
  const status = candidate.status;
  const message = String(candidate.message || candidate.details || "").toLowerCase();
  return status === 404 || message.includes(WIZARD_SERVER_DRAFT_TABLE) || message.includes("does not exist") || message.includes("not found");
}

function markWizardDraftServerUnavailable(error: unknown) {
  if (isMissingWizardDraftTableError(error)) {
    wizardDraftServerAvailable = false;
  }
}

type DraftEnvelope<T> = {
  version: number;
  savedAt: number;
  data: T;
};

function makeDraftEnvelope<T>(data: T): DraftEnvelope<T> {
  return { version: DRAFT_VERSION, savedAt: Date.now(), data };
}

function parseDraftEnvelope<T>(value: unknown): DraftEnvelope<T> | null {
  if (!value || typeof value !== "object") return null;
  const envelope = value as Partial<DraftEnvelope<T>>;
  if (
    typeof envelope.version !== "number" ||
    typeof envelope.savedAt !== "number" ||
    !("data" in envelope)
  ) {
    return null;
  }
  if (envelope.version !== DRAFT_VERSION || Date.now() - envelope.savedAt > DRAFT_MAX_AGE_MS) {
    return null;
  }
  return envelope as DraftEnvelope<T>;
}

function readDraftEnvelope<T>(key: string): DraftEnvelope<T> | null {
  try {
    const env = storageService.loadDraft<DraftEnvelope<T>>(key);
    return env ?? null;
  } catch (e) {
    // Ensure corrupt items are removed
    storageService.removeDraft(key);
    return null;
  }
}

function readDraft<T>(key: string): T | null {
  return readDraftEnvelope<T>(key)?.data ?? null;
}

function writeDraft<T>(key: string, data: T) {
  // Save the draft envelope with a TTL matching the page's max age
  try {
    storageService.saveDraft<DraftEnvelope<T>>(key, makeDraftEnvelope(data), DRAFT_MAX_AGE_MS);
  } catch (e) {
    console.warn("writeDraft failed", e);
  }
}

function extractMediaUrlsFromPosts(items: Post[]): string[] {
  const urls = new Set<string>();
  const urlRe = /(https?:\/\/[\w\-./?=&%]+\.(?:png|jpg|jpeg|webp))(?:\)|\s|$)/gi;

  for (const post of items) {
    const haystack = `${post.title || ""} ${post.hook || ""} ${post.body || ""} ${post.cta || ""}`;
    let match: RegExpExecArray | null;
    while ((match = urlRe.exec(haystack))) {
      urls.add(match[1]);
    }
  }

  return [...urls];
}

async function upsertMediaReferences(params: {
  userId: string;
  referenceKey: string;
  bucket: string;
  posts: Post[];
}) {
  const { userId, referenceKey, bucket, posts } = params;
  const urls = extractMediaUrlsFromPosts(posts);
  if (!urls.length) return;

  await Promise.all(urls.map((publicUrl) =>
    (supabase.from as any)("media_references").upsert({
      user_id: userId,
      bucket,
      storage_path: publicUrl,
      public_url: publicUrl,
      reference_kind: bucket === "avatars" ? "avatar" : "calendar",
      reference_key: referenceKey,
      reference_count: 1,
      last_referenced_at: new Date().toISOString(),
      orphaned_at: null,
      deleted_at: null,
    }, { onConflict: "bucket,storage_path" })
  ));
}

async function readServerDraft(userId: string): Promise<DraftEnvelope<WizardDraftSnapshot> | null> {
  if (!wizardDraftServerAvailable) return null;
  const { data, error } = await (supabase.from as any)(WIZARD_SERVER_DRAFT_TABLE)
    .select("snapshot")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    markWizardDraftServerUnavailable(error);
    return null;
  }
  wizardDraftServerAvailable = true;
  if (!data?.snapshot) return null;
  return parseDraftEnvelope<WizardDraftSnapshot>((data as any).snapshot);
}

async function writeServerDraft(userId: string, snapshot: WizardDraftSnapshot) {
  if (!wizardDraftServerAvailable) return;
  const { error } = await (supabase.from as any)(WIZARD_SERVER_DRAFT_TABLE).upsert(
    {
      user_id: userId,
      snapshot: makeDraftEnvelope(snapshot) as unknown as Json,
    },
    { onConflict: "user_id" }
  );
  if (error) {
    markWizardDraftServerUnavailable(error);
  } else {
    wizardDraftServerAvailable = true;
  }
}

async function clearServerDraft(userId: string) {
  if (!wizardDraftServerAvailable) return;
  const { error } = await (supabase.from as any)(WIZARD_SERVER_DRAFT_TABLE).delete().eq("user_id", userId);
  if (error) {
    markWizardDraftServerUnavailable(error);
  } else {
    wizardDraftServerAvailable = true;
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simple in-memory dedupe map for generation requests to prevent duplicate in-flight calls
const _pendingGenRequests = new Map<string, Promise<Response>>();

async function fetchWithGenerationRetry(input: RequestInfo | URL, init: RequestInit, maxRetries = 2): Promise<Response> {
  // Build a cheap dedupe key from URL + method + body
  try {
    const url = typeof input === "string" ? input : String(input);
    const method = (init && init.method) || "GET";
    const bodyKey = init.body ? String(init.body) : "";
    const dedupeKey = `${method.toUpperCase()}|${url}|${bodyKey}`;

    if (_pendingGenRequests.has(dedupeKey)) {
      return _pendingGenRequests.get(dedupeKey)!;
    }

    const p = (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(input, init);
          if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
            await sleep(400 * Math.pow(2, attempt));
            continue;
          }
          return res;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") throw error;
          if (attempt >= maxRetries) throw error;
          await sleep(400 * Math.pow(2, attempt));
        }
      }
    })();

    _pendingGenRequests.set(dedupeKey, p);
    try {
      const res = await p;
      return res;
    } finally {
      // Ensure we remove the pending promise once settled
      _pendingGenRequests.delete(dedupeKey);
    }
  } catch (e) {
    // Fallback to normal fetch loop if any error building the key
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(input, init);
        if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
          await sleep(400 * Math.pow(2, attempt));
          continue;
        }
        return res;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        if (attempt >= maxRetries) throw error;
        await sleep(400 * Math.pow(2, attempt));
      }
    }
  }
}

function calculateScore(scores: Record<string, number>): number {
  const keys = Object.keys(scores);
  if (keys.length === 0) return 0;
  const sum = keys.reduce((acc, k) => acc + scores[k], 0);
  return Number((sum / keys.length).toFixed(1));
}

const screenVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 18,
      staggerChildren: 0.05
    }
  },
  exit: { opacity: 0, y: -10, transition: { duration: 0.18, ease: "easeIn" } },
} as const;

const Index = () => {
  const {
    step, setStep,
    form, setForm,
    customTopic, setCustomTopic,
    extraTopics, setExtraTopics,
    posts, setPosts,
    postTimes, setPostTimes,
    activeDay, setActiveDay,
    lockedDays, toggleLockedDay, setLockedDays,
    sampleMode, setSampleMode,
    savedId, setSavedId,
    autosaveStatus, setAutosaveStatus,
    loadSnapshot, reset,
    keySource, setKeySource, setKeyMode
  } = useWizardStore();

  const [errorForBoundary, setErrorForBoundary] = useState<Error | null>(null);
  if (errorForBoundary) {
    throw errorForBoundary;
  }

  const [recentCalendars, setRecentCalendars] = useState<{ id: string; title: string; platform: string | null; industry_label: string | null; created_at: string }[]>([]);
  const [genMsg, setGenMsg] = useState("");
  const [genStep, setGenStep] = useState(0);
  const [error, setError] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [lastGenerationError, setLastGenerationError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [tweakOpenIdx, setTweakOpenIdx] = useState<number | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [e2eNetworkError, setE2eNetworkError] = useState(false);
  const [isE2EModeActive, setIsE2EModeActive] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [showAdvancedBrand, setShowAdvancedBrand] = useState(false);
  const [showAdvancedFormat, setShowAdvancedFormat] = useState(false);
  const [reformatTarget, setReformatTarget] = useState<string>("");
  const [reformatting, setReformatting] = useState(false);
  const [recoveryDraft, setRecoveryDraft] = useState<WizardDraftSnapshot | null>(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const autosaveClearTimer = useRef<number | null>(null);
  const [showRationale, setShowRationale] = useState(false);
  const [showSubtopicConfirm, setShowSubtopicConfirm] = useState(false);
  const [subtopicPreview, setSubtopicPreview] = useState<string[]>([]);
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [diffViewData, setDiffViewData] = useState<{ before: string; after: string; dayIndex: number; newPost: Post } | null>(null);
  const [confirm, setConfirm] = useState<{ title?: string; message: string; onConfirm: () => void | Promise<void> } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showPerformance, setShowPerformance] = useState(false);
  const [brandMemory, setBrandMemory] = useState<BrandMemory | null>(null);
  const [generationMeta, setGenerationMeta] = useState<{ inferredTopics?: boolean } | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showFloatingButton, setShowFloatingButton] = useState(false);
  const blockAutosaveRef = useRef(true);
  const msgRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generatingRef = useRef(false);
  const hydrated = useRef(false);
  const draftReady = useRef(false);
  const draftSaveTimer = useRef<number | null>(null);
  const industryRef = useRef<HTMLDivElement>(null);
  const coreIdeaRef = useRef<HTMLDivElement>(null);
  const topicsRef = useRef<HTMLDivElement>(null);
  const tweakRef = useRef<HTMLDivElement>(null);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const createCalendarMutation = useCreateCalendarMutation();
  const regenerateMutation = useRegeneratePostMutation(savedId || undefined);

  // Undo/redo hook for post history
  const { state: postsHistory, setState: setPostsWithHistory, undo: undoChange, redo: redoChange, canUndo, canRedo } = useUndoRedo<Post[]>(posts);

  // Sync posts state with undo/redo history
  useEffect(() => {
    if (postsHistory !== posts) {
      setPosts(postsHistory);
    }
  }, [postsHistory, posts]);

  useEffect(() => {
    setBrandMemory(readBrandMemory(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const seed = readAndClearSeed(user?.id);
    if (seed) {
      setForm(prev => ({
        ...prev,
        coreIdea: seed.coreIdea,
        topics: seed.topic ? [seed.topic] : [],
        format: seed.format || prev.format,
        platform: seed.platform || prev.platform,
      }));
      toast.success("Loaded seeded post configuration ✓");
    }
  }, [user?.id]);  const handleFocusedRegenerate = useCallback(async (metric: PerformanceFocusMetric, guidance: string) => {
    if (isEnabled("performanceDrivenRegeneration")) {
      await regenerateDay(activeDay, "enhance", metric, guidance);
    } else {
      await regenerateDay(activeDay, "enhance");
    }
  }, [activeDay, regenerateDay]);

  const handleApplyCta = useCallback((idx: number, newCta: string) => {
    if (!isEnabled("suggestedCta")) return;
    const updated = [...posts];
    if (updated[idx]) {
      updated[idx] = { ...updated[idx], cta: newCta };
      setPostsWithHistory(updated);
      toast.success("Suggested CTA applied ✓");
    }
  }, [posts, setPostsWithHistory]);

  const handleApplyImage = useCallback((idx: number, imageUrl: string) => {
    const updated = [...posts];
    if (updated[idx]) {
      updated[idx] = { ...updated[idx], cover_image: imageUrl };
      setPostsWithHistory(updated);
      toast.success(imageUrl ? "Cover image applied ✓" : "Cover image removed");
    }
  }, [posts, setPostsWithHistory]);

  // Feature: Hashtag editor — update a single post's hashtags
  const handleHashtagsChange = useCallback((idx: number, newHashtags: string) => {
    const updated = [...posts];
    if (updated[idx]) {
      updated[idx] = { ...updated[idx], hashtags: newHashtags };
      setPostsWithHistory(updated);
    }
  }, [posts, setPostsWithHistory]);

  // Feature: Tone slider — regenerate with tone-shift tweak
  const handleToneShift = useCallback((idx: number, level: number) => {
    const toneLabel = level === 1 ? "very-formal" : level === 2 ? "formal" : level === 4 ? "casual" : "very-casual";
    void regenerateDay(idx, `tone-${toneLabel}`);
  }, []);

  const handleUseAsSeed = useCallback((post: Post) => {
    if (!isEnabled("seedFromPost")) return;
    const seed = createSeedFromPost(post, form.platform);
    storeSeed(seed, user?.id);
    setForm(prev => ({
      ...prev,
      coreIdea: seed.coreIdea,
      topics: seed.topic ? [seed.topic] : [],
      format: seed.format || prev.format,
      platform: seed.platform || prev.platform,
    }));
    setPostsWithHistory([]);
    setActiveDay(0);
    setSavedId(null);
    setLockedDays([]);
    setSampleMode(false);
    setStep(1);
    toast.success("Post marked as seed. Loading new wizard form...");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [form.platform, user?.id, setPostsWithHistory]);

  // Keyboard shortcuts for undo/redo and batch edit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z for undo (or Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey && canUndo && step === 4) {
        e.preventDefault();
        undoChange();
        toast.success("Undo ✓");
      }
      // Ctrl+Y (or Cmd+Shift+Z on Mac) for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z")) && canRedo && step === 4) {
        e.preventDefault();
        redoChange();
        toast.success("Redo ✓");
      }
      // Ctrl+Shift+E for batch edit
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "e" && step === 4) {
        e.preventDefault();
        setBatchEditOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, canUndo, canRedo, undoChange, redoChange]);

  useEffect(() => {
    const completed = localStorage.getItem("social_spark_onboarding_completed") === "true";
    if (!completed) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    if (step !== 2) {
      setShowFloatingButton(false);
      return;
    }
    const handleScroll = () => {
      setShowFloatingButton(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [step]);

  const scrollToField = (field: "industry" | "coreIdea" | "topics") => {
    const refMap = { industry: industryRef, coreIdea: coreIdeaRef, topics: topicsRef };
    refMap[field].current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const getClipboardStyle = useCallback((): FontStyle => {
    return COPY_STYLE_MAP[form.copyStyle] || FontStyle.None;
  }, [form.copyStyle]);

  const weekSummary = useMemo(() => {
    const totalPosts = posts.length;
    const totalChars = posts.reduce((sum, post) => sum + formatForPlatform(post, form.platform, { style: getClipboardStyle() }).charCount, 0);
    const totalWithinLimit = posts.filter(post => formatForPlatform(post, form.platform, { style: getClipboardStyle() }).charCount <= formatForPlatform(post, form.platform, { style: getClipboardStyle() }).limit).length;
    const formatCounts = posts.reduce<Record<string, number>>((counts, post) => {
      const label = baseFormatLabel(post.format);
      counts[label] = (counts[label] || 0) + 1;
      return counts;
    }, {});
    const hashtagCounts = posts.map(post => post.hashtags.split(/\s+/).filter(Boolean).length);
    const postingTimes = posts.map(post => ({
      day: post.day,
      dow: post.dow,
      time: postTimes[String(post.day)] || suggestedTimeForDay(post.day, form.platform),
    }));

    return {
      totalPosts,
      avgChars: totalPosts ? Math.round(totalChars / totalPosts) : 0,
      withinLimitPct: totalPosts ? Math.round((totalWithinLimit / totalPosts) * 100) : 0,
      formatCounts,
      hashtagCounts,
      postingTimes,
    };
  }, [posts, form.platform, postTimes, getClipboardStyle]);

  const buildSubtopicPreview = () => {
    const selectedTopics = form.topics.filter(Boolean);
    if (selectedTopics.length === 0) return [];
    if (selectedTopics.length >= 7) {
      const grouped = Array.from({ length: 7 }, () => [] as string[]);
      selectedTopics.forEach((topic, index) => {
        grouped[index % 7].push(topic);
      });
      return grouped.map(bucket => bucket.join(" + "));
    }

    const preview = [...selectedTopics];
    const seed = selectedTopics[0] || form.coreIdea || form.industry || "the topic";
    const fillAngles = [
      `Why ${seed} matters now`,
      `A practical example of ${seed}`,
      `Common mistakes around ${seed}`,
      `How to apply ${seed} this week`,
      `A sharper take on ${seed}`,
      `What most people miss about ${seed}`,
      `A closing lesson on ${seed}`,
    ];

    for (const angle of fillAngles) {
      if (preview.length >= 7) break;
      preview.push(angle);
    }

    return preview.slice(0, 7);
  };

  // Close tweak menu on outside click
  useEffect(() => {
    if (tweakOpenIdx === null) return;
    const h = (e: MouseEvent) => {
      if (tweakRef.current && !tweakRef.current.contains(e.target as Node)) setTweakOpenIdx(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [tweakOpenIdx]);

  // Close copy-split menu on outside click
  useEffect(() => {
    if (!copyMenuOpen) return;
    const h = (e: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) setCopyMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [copyMenuOpen]);

  // Keyboard shortcuts: arrow keys navigate between days (only on step 4 when week-strip visible)
  useEffect(() => {
    if (step !== 4 || posts.length <= 1) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveDay(d => (d + 1) % posts.length);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveDay(d => (d - 1 + posts.length) % posts.length);
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [step, posts.length]);

  // Load user profile (brand memory) with React Query — shared cache with other pages
  const { data: profileData } = useProfileQuery(user?.id);
  const profileUpdateMutation = useProfileUpdateMutation(user?.id);

  // Fetch recent calendars with React Query
  const { data: recentCalendarsData } = useQuery({
    queryKey: ["recent-calendars", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("saved_calendars")
        .select("id, title, platform, industry_label, created_at")
        .order("created_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Update recent calendars state when data changes
  useEffect(() => {
    if (recentCalendarsData) {
      setRecentCalendars(recentCalendarsData);
    }
  }, [recentCalendarsData]);

  const wizardDraftKey = `${WIZARD_DRAFT_PREFIX}${user ? user.id : "guest"}`;

  // Hydrate the wizard draft once on mount and prompt the user before restoring it.
  useEffect(() => {
    let cancelled = false;
    draftReady.current = false;
    setRecoveryDraft(null);
    setShowRecoveryDialog(false);

    // Remove any expired local drafts early to avoid showing stale recovery
    try {
      storageService.cleanupExpiredDrafts();
    } catch (e) {
      /* ignore */
    }

    const hydrateDraft = async () => {
      try {
        const localDraft = readDraftEnvelope<WizardDraftSnapshot>(wizardDraftKey);
        const serverDraft = user ? await readServerDraft(user.id) : null;
        const newestDraft = [localDraft, serverDraft]
          .filter((item): item is DraftEnvelope<WizardDraftSnapshot> => !!item)
          .sort((a, b) => b.savedAt - a.savedAt)[0] || null;

        if (cancelled) return;

        if (newestDraft) {
          const shouldSkipRecovery = newestDraft.data.step === 4 && newestDraft.data.posts.length === 0;
          if (shouldSkipRecovery) {
            if (user) {
              void clearServerDraft(user.id).catch((error) => {
                console.warn("Failed to clear empty server draft", error);
              });
            }
            if (localDraft) {
              storageService.removeDraft(wizardDraftKey);
            }
            return;
          }
          const prompted = sessionStorage.getItem("ss_recovery_prompted") === "true";
          if (!prompted) {
            setRecoveryDraft(newestDraft.data);
            setShowRecoveryDialog(true);
            sessionStorage.setItem("ss_recovery_prompted", "true");
          }
          if (user && localDraft && localDraft.savedAt >= (serverDraft?.savedAt || 0)) {
            void writeServerDraft(user.id, localDraft.data).catch((error) => {
              console.warn("Failed to sync local draft to server", error);
            });
          }
        }
      } catch (e) {
        console.warn("Failed to load wizard draft", e);
      } finally {
        if (!cancelled) draftReady.current = true;
      }
    };

    void hydrateDraft();

    return () => {
      cancelled = true;
    };
  }, [wizardDraftKey, user]);

  // Pre-fill form with profile defaults when profile data loads and no recovered draft is pending.
  useEffect(() => {
    if (!profileData || hydrated.current || recoveryDraft) return;
    const isDefaultForm = !form.voice && !form.style && form.audiences.length === 0 && form.goals.length === 0;
    if (isDefaultForm) {
      setForm(f => ({
        ...f,
        voice: f.voice || profileData.default_voice || "",
        style: f.style || profileData.default_style || "",
        audiences: f.audiences.length ? f.audiences : (profileData.default_audiences || []),
        goals: profileData.default_goals && profileData.default_goals.length ? profileData.default_goals : f.goals,
      }));
    }
    hydrated.current = true;
  }, [profileData, form.voice, form.style, form.audiences.length, form.goals.length, recoveryDraft]);

  // Persist the active wizard snapshot, with a short debounce, so reloads can recover progress.
  useEffect(() => {
    if (!draftReady.current || !wizardDraftKey || recoveryDraft || blockAutosaveRef.current) return;
    if (draftSaveTimer.current) {
      window.clearTimeout(draftSaveTimer.current);
    }
    draftSaveTimer.current = window.setTimeout(() => {
      const hasMeaningfulDraft =
        step > 1 ||
        posts.length > 0 ||
        form.industry !== "" ||
        form.coreIdea.trim() !== "" ||
        form.audiences.length > 0 ||
        form.voice !== "" ||
        form.style !== "" ||
        form.topics.length > 0 ||
        form.extra.trim() !== "" ||
        form.bannedWords.length > 0 ||
        form.requiredWords.length > 0 ||
        form.format !== "Balanced mix" ||
        form.cta !== "Share & repost bait" ||
        form.length !== "medium" ||
        form.structure !== "mixed" ||
        form.mode !== "week" ||
        form.targetDate !== toDateInputValue(nextMonday());

      try {
        if (!hasMeaningfulDraft) {
          localStorage.removeItem(wizardDraftKey);
          if (user) {
            void clearServerDraft(user.id).catch((error) => {
              console.warn("Failed to clear server draft", error);
            });
          }
          return;
        }
        const snapshot = {
          savedAt: Date.now(),
          form,
          step,
          extraTopics,
          posts,
          activeDay,
          postTimes,
        };
        try {
          setAutosaveStatus("saving");
          writeDraft(wizardDraftKey, snapshot);
          // Persist media references found in posts for orphan cleanup later
          try {
            // simple extractor for image urls in post bodies
            const urlRe = /(https?:\/\/[\w\-./?=&%]+\.(?:png|jpg|jpeg|webp))(?:\)|\s|$)/gi;
            for (const p of posts) {
              const hay = `${(p.title || "")} ${(p.hook || "")} ${(p.body || "")} ${(p.cta || "")}`;
              let m: RegExpExecArray | null;
              while ((m = urlRe.exec(hay))) {
                const url = m[1];
                void import("@/lib/mediaManager")
                  .then(mod => mod.default.addMediaRef(wizardDraftKey, url))
                  .catch(() => {
                    /* media reference tracking is best effort */
                  });
              }
            }
          } catch {
            /* autosave media extraction is best effort */
          }
          setAutosaveStatus("saved");
          if (autosaveClearTimer.current) window.clearTimeout(autosaveClearTimer.current);
          autosaveClearTimer.current = window.setTimeout(() => {
            setAutosaveStatus("idle");
            autosaveClearTimer.current = null;
          }, 2000);
        } catch (e) {
          setAutosaveStatus("error");
          if (autosaveClearTimer.current) window.clearTimeout(autosaveClearTimer.current);
          autosaveClearTimer.current = window.setTimeout(() => {
            setAutosaveStatus("idle");
            autosaveClearTimer.current = null;
          }, 3000);
        }
        if (user) {
          void writeServerDraft(user.id, snapshot).catch((error) => {
            console.warn("Failed to autosave wizard draft", error);
          });
        }
      } catch (e) {
        console.warn("Failed to persist wizard draft", e);
      }
    }, 1000);

    return () => {
      if (draftSaveTimer.current) {
        window.clearTimeout(draftSaveTimer.current);
      }
    };
  }, [wizardDraftKey, user, form, step, extraTopics, posts, activeDay, postTimes, recoveryDraft]);

  const clearDraft = () => {
    try {
      if (wizardDraftKey) storageService.removeDraft(wizardDraftKey);
      if (user) {
        void clearServerDraft(user.id).catch((error) => {
          console.warn("Failed to clear server draft", error);
        });
      }
    } catch (e) {
      console.warn("Failed to clear wizard draft", e);
    }
  };

  const restoreDraft = () => {
    if (!recoveryDraft) return;
    loadSnapshot(recoveryDraft);
    setPostsWithHistory([...recoveryDraft.posts]);
    setSavedId(null);
    setSampleMode(false);
    setError("");
    setGenMsg("");
    setGenStep(0);
    setRecoveryDraft(null);
    setShowRecoveryDialog(false);
    hydrated.current = true;
    blockAutosaveRef.current = false;
  };

  const discardDraft = () => {
    clearDraft();
    setRecoveryDraft(null);
    setShowRecoveryDialog(false);
    toast.success("Draft discarded. Start fresh below.");
  };

  const upd = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    blockAutosaveRef.current = false;
    setForm(f => ({ ...f, [k]: v }));
    setError("");
  }, []);
  const toggleChip = (k: "goals", v: string) => {
    blockAutosaveRef.current = false;
    setForm(f => ({ ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v] }));
  };

  const setIndustry = (id: string) => {
    blockAutosaveRef.current = false;
    setForm(f => ({ ...f, industry: id, topics: [], audiences: [] }));
    setExtraTopics([]);
    setError("");
  };

  const selectedIndustry = INDUSTRIES.find(i => i.id === form.industry);
  const topicPool = form.industry ? uniqueStrings([...(INDUSTRY_TOPICS[form.industry] || []), ...extraTopics]) : uniqueStrings([...extraTopics]);
  const audiencePool = form.industry ? (AUDIENCE_PRESETS[form.industry] || AUDIENCE_PRESETS.other) : AUDIENCE_PRESETS.other;

  function addCustomTopic() {
    const v = customTopic.trim();
    if (!v || topicPool.includes(v)) return;
    blockAutosaveRef.current = false;
    setExtraTopics(p => [...p, v]);
    setForm(f => ({ ...f, topics: [...f.topics, v] }));
    setError("");
    setCustomTopic("");
  }

  function validate(s: number) {
    if (s === 1) {
      if (!form.industry) {
        setShowValidation(true);
        setError("Please select your industry / niche.");
        scrollToField("industry");
        return false;
      }
      if (!form.coreIdea.trim()) {
        setShowValidation(true);
        setError("Please describe your core idea.");
        scrollToField("coreIdea");
        return false;
      }
      if (form.mode === "day" && !form.targetDate) {
        setError("Please pick a date for your post.");
        return false;
      }
    }
    setError(""); return true;
  }

  const GEN_MSGS = ["Analysing your niche…", "Mapping topics to days…", "Writing hooks…", "Drafting post bodies…", "Adding CTAs & hashtags…"];
  const GEN_LABELS = ["Niche analysis", "Topic mapping", "Hook writing", "Body drafting", "CTA & hashtags"];

  const log = createScopedLogger('Index-Generate');

  async function generate(isRetry: boolean = false, bypassSubtopicPreview: boolean = false) {
    if (generatingRef.current) return;
    if (!validate(2)) return;

    const isE2E = typeof window !== "undefined" && window.localStorage.getItem(getE2EAuthFlag()) === "true";

    if (!isRetry && form.mode !== "day" && !bypassSubtopicPreview && form.topics.length > 0 && form.topics.length < 7 && !isE2E) {
      setSubtopicPreview(buildSubtopicPreview());
      setShowSubtopicConfirm(true);
      return;
    }
    
    generatingRef.current = true;
    setIsGenerating(true);
    setLastGenerationError(null);
    if (typeof telemetry?.sendEvent === "function") telemetry.sendEvent("generate_start", { user: user?.id, mode: form.mode });
    setStep(3); setGenStep(0); setGenMsg(GEN_MSGS[0]); setSavedId(null);

    // Cycle the friendly status messages on a steady cadence; the bar itself is indeterminate.
    let mi = 0;
    msgRef.current = setInterval(() => {
      mi = Math.min(mi + 1, GEN_MSGS.length - 1);
      setGenMsg(GEN_MSGS[mi]);
      setGenStep(mi);
    }, 2200);

    // Abort plumbing: user-cancel + 90s hard timeout.
    const ac = new AbortController();
    abortRef.current = ac;
    const timeoutId = setTimeout(() => ac.abort("timeout"), 90_000);

    const cleanup = () => {
      if (msgRef.current) clearInterval(msgRef.current);
      clearTimeout(timeoutId);
      abortRef.current = null;
      generatingRef.current = false;
      setIsGenerating(false);
    };

    const localFallback = async (message: string) => {
      const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const targetDateObj = form.mode === "day" ? (parseLocalDate(form.targetDate) || new Date()) : null;
      const localTargetDow = targetDateObj ? DOW_NAMES[targetDateObj.getDay()] : "Mon";
      const { generateLocalPosts } = await import("@/lib/localPostGenerator");
      const fallbackPosts = generateLocalPosts({
        industry: form.industry,
        industryLabel: selectedIndustry?.label || form.industry,
        platform: form.platform,
        language: form.language,
        coreIdea: form.coreIdea,
        audiences: form.audiences,
        voice: form.voice,
        style: form.style,
        goals: form.goals,
        topics: form.mode === "day" ? [form.topics[0] || form.coreIdea] : form.topics,
        format: form.format,
        cta: form.cta,
        length: form.length,
        structure: form.structure,
        extra: form.extra,
        bannedWords: form.bannedWords,
        requiredWords: form.requiredWords,
        targetTopic: form.topics[0] || form.coreIdea,
        targetDow: localTargetDow,
      });
      const result: Post[] = (form.mode === "day" ? fallbackPosts.slice(0, 1) : fallbackPosts) as unknown as Post[];
      setGenStep(GEN_LABELS.length);
      setPostsWithHistory(result);
      setGenerationMeta(null);
      setActiveDay(0);
      const seedTimes: Record<string, string> = {};
      for (const r of result) seedTimes[String(r.day)] = suggestedTimeForDay(Number(r.day) || 1, form.platform);
      setPostTimes(seedTimes);
      setTimeout(() => setStep(4), 350);
      log.warn(`Using local fallback generator`, new Error(message), { mode: form.mode, postCount: result.length });
      if (typeof telemetry?.sendEvent === "function") telemetry.sendEvent("generate_fallback", { user: user?.id, mode: form.mode, reason: message });
      toast.warning("Live AI generation is unavailable right now, so a local fallback version was generated.");
    };

    try {
      if (isE2E) {
        const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const isDay = form.mode === "day";
        const targetDateObj = isDay ? (parseLocalDate(form.targetDate) || new Date()) : null;
        const targetDow = targetDateObj ? DOW_NAMES[targetDateObj.getDay()] : "Mon";
        const result: Post[] = isDay
          ? [{
              ...SAMPLE_POSTS[0],
              day: 1,
              dow: targetDow,
              topic: form.topics[0] || form.coreIdea || SAMPLE_POSTS[0].topic,
              title: `${form.topics[0] || form.coreIdea || SAMPLE_POSTS[0].topic} — ${form.platform}`,
            }]
          : Array.from({ length: 7 }).map((_, index) => {
              const sample = SAMPLE_POSTS[index % SAMPLE_POSTS.length] || SAMPLE_POSTS[0];
              return {
                ...sample,
                day: index + 1,
                dow: DOW_NAMES[(index + 1) % DOW_NAMES.length] || sample.dow,
                topic: form.topics[index] || sample.topic,
              };
            });

        setGenStep(GEN_LABELS.length);
        setPostsWithHistory(result);
        setActiveDay(0);
        const seedTimes: Record<string, string> = {};
        for (const r of result) seedTimes[String(r.day)] = suggestedTimeForDay(Number(r.day) || 1, form.platform);
        setPostTimes(seedTimes);

        const saved = await createCalendarMutation.mutateAsync({
          user_id: user?.id || E2E_USER_ID,
          title: form.coreIdea.slice(0, 80) || `${selectedIndustry?.label || "Calendar"} — ${form.platform}`,
          industry: form.industry,
          industry_label: selectedIndustry?.label || form.industry,
          platform: form.platform,
          core_idea: form.coreIdea,
          form_payload: { ...form } as unknown as Json,
          posts: result as unknown as Json,
          week_start_date: form.weekStart || null,
          post_times: seedTimes,
        });

        cleanup();
        setGenerationMeta(null);
        // Persist last generated post count in-memory for E2E runs
        try {
          e2eStore.setLastGeneratedPosts(result.length);
        } catch {
          /* E2E helper is best effort */
        }
        setSavedId(saved.id);
        toast.success(`${isRetry ? 'Regenerated' : 'Generated'} ${isDay ? 'post' : 'week'} successfully`);
        navigate(`/calendar/${saved.id}`);
        return;
      }

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      const isDay = form.mode === "day";
      const endpoint = isDay ? "generate-single-post" : "generate-calendar";
      const mode = isDay ? "single-day" : "full-week";

      // Derive dow ("Mon".."Sun") from chosen date for single-day mode.
      const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const targetDateObj = isDay ? (parseLocalDate(form.targetDate) || new Date()) : null;
      const targetDow = targetDateObj ? DOW_NAMES[targetDateObj.getDay()] : "Mon";

      const baseBody = {
        industry: form.industry,
        industryLabel: selectedIndustry?.label || form.industry,
        platform: form.platform,
        language: form.language,
        coreIdea: form.coreIdea,
        audiences: form.audiences,
        voice: form.voice,
        style: form.style,
        goals: form.goals,
        postType: form.postType,
        format: form.format,
        cta: form.cta,
        length: form.length,
        structure: form.structure,
        extra: form.extra,
        bannedWords: form.bannedWords,
        requiredWords: form.requiredWords,
        brand_examples: profileData?.brand_examples || [],
        framework: profileData?.default_framework || "Auto",
        quality: form.quality || "polished",
        brandMemory: [
          brandMemoryToPrompt(brandMemory),
          isEnabled("brandMemory") && profileData ? buildBrandMemoryPrompt(profileData as any) : ""
        ].filter(Boolean).join("\n\n"),
      };

      let body: Record<string, unknown> = isDay
        ? { ...baseBody, topic: form.topics[0] || form.coreIdea, dow: targetDow, date: form.targetDate }
        : { ...baseBody, topics: form.topics };

      // If no explicit topics were provided, log telemetry and mark payload so server can note inference
      const topicsEmpty = isDay ? !form.topics[0] : form.topics.length === 0;
      if (topicsEmpty) {
        if (typeof telemetry?.sendEvent === "function") telemetry.sendEvent("generate_infer_topics", { user: user?.id, mode: form.mode, industry: form.industry, platform: form.platform });
        body = { ...body, inferredTopics: true };
      }

      log.info(`Starting generation (${mode}, ${isRetry ? 'retry' : 'first attempt'})`, { mode, platform: form.platform, industry: form.industry });

      // E2E fast-path: return a deterministic calendar/post when E2E auth flag is set
      const e2eEnabled = typeof window !== "undefined" && window.localStorage.getItem(getE2EAuthFlag()) === "true";
      if (e2eEnabled) {
        const fakePosts: Post[] = (() => {
          if (isDay) {
            return [
              {
                id: `e2e-post-1`,
                day: 1,
                dow: targetDow,
                topic: form.topics[0] || E2E_CALENDAR.core_idea || "E2E topic",
                title: `E2E Post: ${E2E_CALENDAR.title}`,
                hook: `E2E hook`,
                body: `Deterministic E2E post body for testing.`,
                cta: `No CTA`,
                format: "Balanced mix",
                hashtags: "",
                rationale: "",
                hook_options: [],
                cta_options: [],
              },
            ];
          }
          const days = (E2E_CALENDAR.posts && E2E_CALENDAR.posts.length) || 7;
          return Array.from({ length: days }).map((_, i) => ({
            id: `e2e-post-${i + 1}`,
            day: i + 1,
            dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][(i + 1) % 7],
            topic: form.topics[i] || `E2E topic ${i + 1}`,
            title: `E2E Day ${i + 1}`,
            hook: `E2E hook ${i + 1}`,
            body: `Deterministic E2E body for day ${i + 1}`,
            cta: `No CTA`,
            format: "Balanced mix",
            hashtags: "",
            rationale: "",
            hook_options: [],
            cta_options: [],
          }));
        })();

        setGenStep(GEN_LABELS.length);
        setPostsWithHistory(fakePosts);
        setActiveDay(0);
        const seedTimes: Record<string, string> = {};
        for (const r of fakePosts) seedTimes[String(r.day)] = suggestedTimeForDay(Number(r.day) || 1, form.platform);
        setPostTimes(seedTimes);
        setTimeout(() => setStep(4), 350);
        log.info(`E2E generation completed`, { mode, postCount: fakePosts.length });
        toast.success(`${isRetry ? 'Regenerated' : 'Generated'} ${isDay ? 'post' : 'week'} successfully`);
        return;
      }

      const { data, usedFallback, keyMode } = await generateWithFallback(endpoint, body, ac.signal);
      cleanup();
      setKeySource(usedFallback ? "user" : "platform");
      setKeyMode(keyMode);

      // Normalize: single-post endpoint returns { post }, week endpoint returns { posts }
      const inferredTopics = Boolean((data as { meta?: { inferredTopics?: boolean } })?.meta?.inferredTopics);
      const result: Post[] = unwrapPosts(data);
      if (result.length === 0) {
        const emptyError = "Empty response. Please try again.";
        log.warn(`Empty generation response`, new Error(emptyError), { mode });
        localFallback(emptyError);
        return;
      }

      setGenStep(GEN_LABELS.length);
      setPostsWithHistory(result); setActiveDay(0);
      setGenerationMeta({ inferredTopics });
      // Seed day-optimized default times per post (keyed by post.day)
      const seedTimes: Record<string, string> = {};
      for (const r of result) seedTimes[String(r.day)] = suggestedTimeForDay(Number(r.day) || 1, form.platform);
      setPostTimes(seedTimes);
      setTimeout(() => setStep(4), 350);
      log.info(`Generation completed successfully`, { mode, postCount: result.length });
      if (typeof telemetry?.sendEvent === "function") telemetry.sendEvent("generate_success", { user: user?.id, mode: form.mode, postCount: result.length });
      toast.success(
        `${isRetry ? 'Regenerated' : 'Generated'} ${isDay ? 'post' : 'week'} successfully${inferredTopics ? " — topics were inferred from your core idea" : ""}`,
      );
    } catch (err) {
      if (err instanceof Error && err.message === "AI_UNAVAILABLE") {
        setErrorForBoundary(err);
        return;
      }
      if (typeof telemetry?.sendEvent === "function") telemetry.sendEvent("generate_error", { user: user?.id, mode: form.mode, error: String(err) });
      cleanup();
      const aborted = err instanceof DOMException && err.name === "AbortError";
      const reason = (ac.signal as AbortSignal & { reason?: unknown }).reason;
      if (!aborted) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("generations") && (msg.includes("Upgrade") || msg.includes("Add your own API key"))) {
          toast.warning(msg, {
            duration: 8000,
            action: { label: "See plans", onClick: () => navigate("/profile?tab=plan") },
          });
        }
        localFallback(msg);
        return;
      }

      const userMessage = getUserFriendlyMessage(err);
      setError(userMessage);
      setLastGenerationError(err);
      log.error(`Generation error`, err, { mode: form.mode, aborted, reason });

      if (aborted && reason === "timeout") {
        setError("Generation timed out. Please try again.");
      } else if (aborted) {
        setError("Generation was cancelled.");
      } else {
        setError(userMessage);
      }
    }
  }

  function cancelGeneration() {
    if (abortRef.current) abortRef.current.abort("user");
  }

  async function regenerateDay(
    idx: number,
    tweak?: "shorter" | "punchier" | "add-stat" | "remove-emoji" | "more-personal" | "clean-formatting" | "enhance" | string,
    focusMetric?: PerformanceFocusMetric,
    guidance?: string
  ) {
    if (regenIdx !== null) return;
    const target = posts[idx];
    if (!target) return;
    const targetFocusMetric = tweak === "enhance"
      ? focusMetric || getWeakestPerformanceMetric(calculatePerformanceScore(target, form.coreIdea))
      : undefined;
    if (tweak === "enhance" && typeof telemetry?.sendEvent === "function") {
      telemetry.sendEvent("enhance_clicked", {
        user: user?.id,
        mode: form.mode,
        day: target.day,
        platform: form.platform,
        industry: form.industry,
        focusMetric: targetFocusMetric,
      });
    }
    setRegenIdx(idx);
    const doRegenerate = async (targetsParam: { p: Post; i: number }[]) => {
      setReformatting(true);
      try {
        const next = [...posts];
        let okCount = 0;
        for (const { p: target, i } of targetsParam) {
          setRegenIdx(i);
          const payload = {
            industry: form.industry,
            industryLabel: selectedIndustry?.label || form.industry,
            platform: form.platform,
            language: form.language,
            coreIdea: form.coreIdea,
            audiences: form.audiences,
            voice: form.voice,
            style: form.style,
            goals: form.goals,
            postType: form.postType,
            format: form.format,
            cta: form.cta,
            length: form.length,
            structure: form.structure,
            extra: form.extra,
            bannedWords: form.bannedWords,
            requiredWords: form.requiredWords,
            brandMemory: [
              brandMemoryToPrompt(brandMemory),
              isEnabled("brandMemory") && profileData ? buildBrandMemoryPrompt(profileData as any) : ""
            ].filter(Boolean).join("\n\n"),
            post: target,
            siblings: next,
            ...(tweak === "enhance" ? { focusMetric: targetFocusMetric } : {}),
            ...(focusMetric ? { focusMetric } : {}),
            ...(guidance ? { guidance } : {}),
          };
          try {
            const newPost = await regenerateMutation.mutateAsync(payload);
            if (newPost) {
              next[i] = newPost as Post;
              setPostsWithHistory([...next]);
              okCount++;
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("generations") && (msg.includes("Upgrade") || msg.includes("Add your own API key"))) {
              toast.warning(msg, {
                duration: 8000,
                action: { label: "See plans", onClick: () => navigate("/profile?tab=plan") },
              });
              break;
            }
            // ignore other per-item failures
          }
        }
        setSavedId(null);
        toast.success(`Regenerated ${okCount} of ${targetsParam.length} unlocked post${targetsParam.length === 1 ? "" : "s"}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Regenerate failed");
      } finally {
        setRegenIdx(null);
        setReformatting(false);
      }
    };

    const targets = [{ p: target, i: idx }];

    if (targets.length === posts.length) {
      setConfirm({ title: "Regenerate all posts?", message: `Regenerate all ${posts.length} posts? Tip: pin posts you love first.`, onConfirm: async () => { setConfirm(null); await doRegenerate(targets); } });
      return;
    }

    await doRegenerate(targets);
  }

  async function enhanceCurrentPost() {
    await regenerateDay(activeDay, "enhance");
  }

  function saveBrandMemoryFromForm() {
    const snapshot = buildBrandMemorySnapshot(form);
    writeBrandMemory(user?.id, snapshot);
    setBrandMemory(snapshot);
    toast.success("Brand memory saved");
  }

  function applyBrandMemoryToForm() {
    if (!brandMemory) {
      toast.error("No saved brand memory yet");
      return;
    }
    setForm(prev => ({
      ...prev,
      voice: brandMemory.voice || prev.voice,
      style: brandMemory.style || prev.style,
      copyStyle: brandMemory.copyStyle || prev.copyStyle,
      cta: brandMemory.cta || prev.cta,
      audiences: brandMemory.audiences.length ? brandMemory.audiences : prev.audiences,
      goals: brandMemory.goals.length ? brandMemory.goals : prev.goals,
      bannedWords: brandMemory.bannedWords.length ? brandMemory.bannedWords : prev.bannedWords,
      requiredWords: brandMemory.requiredWords.length ? brandMemory.requiredWords : prev.requiredWords,
    }));
    toast.success("Brand memory applied to the wizard");
  }

  function clearBrandMemorySaved() {
    clearBrandMemory(user?.id);
    setBrandMemory(null);
    toast.success("Brand memory cleared");
  }

  const lockedDaysSet = useMemo(() => new Set(lockedDays), [lockedDays]);

  const toggleLock = useCallback((day: number) => {
    setLockedDays(prev => {
      if (prev.includes(day)) return prev.filter(d => d !== day);
      return [...prev, day];
    });
  }, [setLockedDays]);

  async function regenerateUnlocked() {
    if (regenIdx !== null || reformatting) return;
    const targets = posts
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => !lockedDaysSet.has(p.day));
    if (targets.length === 0) {
      toast.error("All posts are locked. Unpin at least one to regenerate.");
      return;
    }

    const doRegenerate = async (targetsParam: { p: Post; i: number }[]) => {
      setReformatting(true);
      try {
        const next = [...posts];
        let okCount = 0;
        for (const { p: target, i } of targetsParam) {
          setRegenIdx(i);
          const payload = {
            industry: form.industry,
            industryLabel: selectedIndustry?.label || form.industry,
            platform: form.platform,
            language: form.language,
            coreIdea: form.coreIdea,
            audiences: form.audiences,
            voice: form.voice,
            style: form.style,
            goals: form.goals,
            format: form.format,
            cta: form.cta,
            length: form.length,
            structure: form.structure,
            extra: form.extra,
            bannedWords: form.bannedWords,
            requiredWords: form.requiredWords,
            brandMemory: brandMemoryToPrompt(brandMemory),
            post: target,
            siblings: next,
          };
          try {
            const newPost = await regenerateMutation.mutateAsync(payload);
            if (newPost) {
              next[i] = newPost as Post;
              setPostsWithHistory([...next]);
              okCount++;
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("generations") && (msg.includes("Upgrade") || msg.includes("Add your own API key"))) {
              toast.warning(msg, {
                duration: 8000,
                action: { label: "See plans", onClick: () => navigate("/profile?tab=plan") },
              });
              break;
            }
            // ignore other per-item failures
          }
        }
        setSavedId(null);
        toast.success(`Regenerated ${okCount} of ${targetsParam.length} unlocked post${targetsParam.length === 1 ? "" : "s"}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Regenerate failed");
      } finally {
        setRegenIdx(null);
        setReformatting(false);
      }
    };

    if (targets.length === posts.length) {
      setConfirm({ title: "Regenerate all posts?", message: `Regenerate all ${posts.length} posts? Tip: pin posts you love first.`, onConfirm: async () => { setConfirm(null); await doRegenerate(targets); } });
      return;
    }

    await doRegenerate(targets);
  }

  async function reformatAllForPlatform(targetPlatform: string) {
    if (!targetPlatform || targetPlatform === form.platform || reformatting || regenIdx !== null) return;
    if (!user) {
      toast.error("Sign in to reformat — the result is saved as a new calendar.");
      return;
    }
    setConfirm({ title: "Reformat calendar?", message: `Reformat this 7-day calendar for ${niceLabelFor(targetPlatform)}? It will be saved as a NEW calendar — your current one stays untouched.`, onConfirm: async () => {
      setConfirm(null);
      setReformatting(true);
      try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const next: Post[] = [...posts];
      for (let i = 0; i < posts.length; i++) {
        setRegenIdx(i);
        const payload = {
          industry: form.industry,
          industryLabel: selectedIndustry?.label || form.industry,
          platform: targetPlatform,
          language: form.language,
          coreIdea: form.coreIdea,
          audiences: form.audiences,
          voice: form.voice,
          style: form.style,
          goals: form.goals,
          format: form.format,
          cta: form.cta,
          length: form.length,
          structure: form.structure,
          extra: form.extra,
          bannedWords: form.bannedWords,
          requiredWords: form.requiredWords,
            brandMemory: brandMemoryToPrompt(brandMemory),
          post: posts[i],
          siblings: next,
        };
        try {
          const newPost = await regenerateMutation.mutateAsync(payload);
          if (newPost) next[i] = newPost as Post;
        } catch (e) {
          // ignore per-item failures
        }
      }
      // Save as new calendar
      const title = `${form.coreIdea.slice(0, 60) || selectedIndustry?.label || "Calendar"} — ${targetPlatform}`;
      const newForm = { ...form, platform: targetPlatform };
      const ins = await createCalendarMutation.mutateAsync({
        user_id: user.id,
        title,
        industry: form.industry,
        industry_label: selectedIndustry?.label || form.industry,
        platform: targetPlatform,
        core_idea: form.coreIdea,
        form_payload: newForm as unknown as Json,
        posts: next as unknown as Json,
        week_start_date: form.weekStart || null,
        post_times: postTimes,
      });
      if (!ins?.id) throw new Error("Reformat save failed");
      for (const url of extractMediaUrlsFromPosts(next)) {
        mediaManager.addMediaRef(String(ins.id), url);
      }
      await upsertMediaReferences({ userId: user.id, referenceKey: String(ins.id), bucket: "calendars", posts: next });
      toast.success(`Reformatted for ${niceLabelFor(targetPlatform)} ✓ — opening new calendar`);
      navigate(`/calendar/${ins.id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Reformat failed");
      } finally {
        setRegenIdx(null);
        setReformatting(false);
        setReformatTarget("");
      }
    } });
  }

  function loadSample() {
    setForm(f => ({ ...f, ...SAMPLE_FORM }));
    setPostsWithHistory(SAMPLE_POSTS as unknown as Post[]);
    setPostTimes(SAMPLE_POST_TIMES);
    setActiveDay(0);
    setSampleMode(true);
    setGenerationMeta(null);
    setSavedId(null);
    setLockedDays([]);
    setStep(4);
    toast.success("Sample calendar loaded — explore the layout, then start your own.");
  }

  function exitSample() {
    setSampleMode(false);
    setPostsWithHistory([]);
    setActiveDay(0);
    setGenerationMeta(null);
    setStep(1);
  }

  function applyBatchEdit(payload: BatchEditPayload) {
    const updated = posts.map(post => {
      const updatedPost = { ...post };

      // Apply brand mention if provided
      if (payload.brandMention) {
        updatedPost.cta = `${updatedPost.cta} ${payload.brandMention}`;
      }

      // Add hashtag if provided
      if (payload.hashtag) {
        updatedPost.hashtags = `${updatedPost.hashtags} ${payload.hashtag}`.trim();
      }

      // Replace CTA style if provided
      if (payload.ctaStyle) {
        updatedPost.cta = payload.ctaStyle;
      }

      return updatedPost;
    });

    setPostsWithHistory(updated);
    setSavedId(null);
    toast.success(`Applied batch edits to all ${posts.length} posts`);

    // Reset posting times if requested
    if (payload.updateTimes) {
      const newTimes: Record<string, string> = {};
      posts.forEach(post => {
        newTimes[String(post.day)] = suggestedTimeForDay(post.day, form.platform);
      });
      setPostTimes(newTimes);
      toast.success("Posting times reset to platform defaults");
    }
  }

  function handleDayDrop(draggedIdx: number | null, targetIdx: number) {
    if (draggedIdx === null || draggedIdx === targetIdx) return;

    const reorderedPosts = swapItems(posts, draggedIdx, targetIdx);
    setPostsWithHistory(reorderedPosts);
    setSavedId(null);
    setDraggedIndex(null);
    toast.success(`Reordered: Day ${posts[draggedIdx].day} ↔ Day ${posts[targetIdx].day}`);
  }

  function copyText(text: string, cb: () => void) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(cb).catch(() => fbCopy(text, cb));
    } else fbCopy(text, cb);
  }
  function fbCopy(text: string, cb: () => void) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand("copy"); cb(); } catch (e) { console.error(e); }
    document.body.removeChild(ta);
  }

  function postText(p: Post) {
    const text = `${p.title}\n\n${p.hook}\n\n${p.body}\n\n${p.cta}\n\n${p.hashtags}`;
    const style = getClipboardStyle();
    return style === FontStyle.None ? text : applyStyle(text, style);
  }

  function getPostContentForDiff(p: Post): string {
    // Full content for diff comparison
    return [
      `Title: ${p.title}`,
      `Hook: ${p.hook}`,
      `Body:\n${p.body}`,
      `CTA: ${p.cta}`,
      `Hashtags: ${p.hashtags}`,
    ].join("\n\n");
  }

  const copyPost = useCallback(async (i: number) => {
    const p = posts[i];
    if (!p) return;
    const formatted = formatForPlatform(p, form.platform, { style: getClipboardStyle() });
    const ok = await writeToClipboard(formatted.text);
    if (!ok) { toast.error("Could not copy to clipboard"); return; }
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 2000);
    if (formatted.truncated && formatted.platform === "twitter") {
      toast.error("Trimmed to fit X's 280-char limit");
    } else {
      toast.success(`Copied for ${formatted.platformLabel} ✓`);
    }
  }, [posts, form.platform, getClipboardStyle]);
  const copyAll = useCallback(async () => {
    const all = posts.map(p => {
      const f = formatForPlatform(p, form.platform, { style: getClipboardStyle() });
      return `=== Day ${p.day} — ${p.dow} | ${p.topic} ===\n${f.text}`;
    }).join("\n\n\n");
    const ok = await writeToClipboard(all);
    if (!ok) { toast.error("Could not copy to clipboard"); return; }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
    toast.success(`All ${posts.length} copied for ${niceLabelFor(form.platform)} ✓`);
  }, [posts, form.platform, getClipboardStyle]);
  const downloadTxt = useCallback(() => {
    const style = getClipboardStyle();
    const textFor = (p: Post) => {
      const raw = `${p.title}\n\n${p.hook}\n\n${p.body}\n\n${p.cta}\n\n${p.hashtags}`;
      return style === FontStyle.None ? raw : applyStyle(raw, style);
    };
    const header = `CONTENTFORGE — 7-DAY ${form.platform.toUpperCase()} CONTENT CALENDAR\nIndustry: ${selectedIndustry?.label || "—"}  |  Niche: ${form.coreIdea}\nPlatform: ${form.platform}  |  Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}\n${"═".repeat(52)}\n\n`;
    const body = posts.map(p =>
      `${"─".repeat(52)}\nDAY ${p.day} — ${p.dow.toUpperCase()}  |  ${p.topic.toUpperCase()}\nFormat: ${p.format}\n${"─".repeat(52)}\n\n${textFor(p)}\n\n📌 ${p.rationale}\n`).join("\n\n");
    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contentforge-${form.industry}-${Date.now()}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    try { toast.success("Download started"); } catch (e) { /* noop */ }
  }, [posts, form.platform, form.industry, form.coreIdea, selectedIndustry, getClipboardStyle]);

  async function saveCalendar() {
    if (!user || posts.length === 0) return;
    setSaving(true);
    try {
      const isDay = form.mode === "day" && posts.length === 1;
      const baseTitle = form.coreIdea.slice(0, 80) || `${selectedIndustry?.label || "Calendar"} — ${form.platform}`;
      const title = isDay
        ? `${(form.topics[0] || baseTitle).slice(0, 60)} · ${form.platform} · ${form.targetDate}`
        : baseTitle;
      const payload = {
        user_id: user.id,
        title,
        industry: form.industry,
        industry_label: selectedIndustry?.label || form.industry,
        platform: form.platform,
        core_idea: form.coreIdea,
        form_payload: form as unknown as Json,
        posts: posts as unknown as Json,
        week_start_date: (isDay ? form.targetDate : form.weekStart) || null,
        post_times: postTimes,
      };

      const data = await createCalendarMutation.mutateAsync(payload);
      if (!data?.id) throw new Error("Calendar save failed");
      for (const url of extractMediaUrlsFromPosts(posts)) {
        mediaManager.addMediaRef(String(data.id), url);
      }
      await upsertMediaReferences({ userId: user.id, referenceKey: String(data.id), bucket: "calendars", posts });
      setSavedId(data.id);
      clearDraft();
      toast.success("Calendar saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Calendar save failed");
    } finally {
      setSaving(false);
    }
  }

  const exportIcs = useCallback(() => {
    const weekStart = parseLocalDate(form.weekStart) || nextMonday();
    const title = form.coreIdea.slice(0, 80) || `${selectedIndustry?.label || "Calendar"} — ${form.platform}`;
    downloadIcs({
      calendarTitle: title,
      weekStart,
      postTimes,
      platform: form.platform,
    }, posts);
  }, [form.weekStart, form.coreIdea, form.platform, selectedIndustry, postTimes, posts]);

  const weekStartDate = useMemo(() => parseLocalDate(form.weekStart) || nextMonday(), [form.weekStart]);

  const STEP_LABELS = ["Industry", "Topics", "Generate", "Calendar"];
  const p = posts[activeDay];
  const wizardProgress = Math.round(((step - 1) / (STEP_LABELS.length - 1)) * 100);
  const wizardStepLabel = STEP_LABELS[step - 1] || STEP_LABELS[0];
  const wizardGuidance =
    step === 1 ? "Choose your niche, platform, and tone before anything else." :
    step === 2 ? "Gather the angles that will become your week or single post." :
    step === 3 ? "Generation is running. Keep this tab open until the preview lands." :
    "Review the output, pin the winners, and schedule when ready.";
  const autosaveLabel =
    autosaveStatus === "saving" ? "Saving draft" :
    autosaveStatus === "saved" ? "Draft saved" :
    autosaveStatus === "error" ? "Draft save failed" :
    "Draft idle";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isE2E = window.localStorage.getItem(getE2EAuthFlag()) === "true";
    setIsE2EModeActive(isE2E);
    const hasNetworkErrorFlag = new URLSearchParams(window.location.search).has("e2e-network-error");
    setE2eNetworkError(isE2E && hasNetworkErrorFlag);
  }, []);

  useEffect(() => {
    if (e2eNetworkError) {
      setError("Connection error. Please check your internet and try again.");
    }
  }, [e2eNetworkError]);

  const disableSandboxMode = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(getE2EAuthFlag());
      window.location.reload();
    }
  };

  const stepTitles: Record<number, string> = {
    1: "Niche & Idea",
    2: "Topics & Date",
    3: "Generating Posts",
    4: "Review & Customize",
  };
  const pageTitle = `Create Calendar (${stepTitles[step] || "Step " + step}) — ContentForge`;

  return (
    <WorkspacePage size="xwide" className="cf-app">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content="Use the AI-guided setup wizard to generate high-engagement social media content calendars tailored to your specific brand, niche, and target audience." />
      </Helmet>
      {showOnboarding && (
        <OnboardingTour
          onSeeExample={loadSample}
          onClose={() => setShowOnboarding(false)}
        />
      )}
      {isE2EModeActive && (
        <div style={{
          background: "rgba(240, 212, 154, 0.1)",
          borderBottom: "1px solid rgba(240, 212, 154, 0.2)",
          padding: "10px 16px",
          textAlign: "center",
          fontSize: "12px",
          color: "#f0d49a",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px",
          zIndex: 1000,
          position: "relative"
        }}>
          <span>⚠️ Sandbox Mode Active (using mock test data)</span>
          <button 
            onClick={disableSandboxMode}
            style={{
              background: "rgba(240, 212, 154, 0.2)",
              border: "1px solid rgba(240, 212, 154, 0.4)",
              color: "#f0d49a",
              padding: "2px 8px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 500,
              transition: "all 0.15s"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(240, 212, 154, 0.35)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(240, 212, 154, 0.2)";
            }}
          >
            Switch to Live Database & AI
          </button>
        </div>
      )}
      <DraftRecoveryDialog
        open={showRecoveryDialog && !!recoveryDraft}
        draft={recoveryDraft ? {
          savedAt: recoveryDraft.savedAt,
          step: recoveryDraft.step,
          industry: recoveryDraft.form.industry,
          postCount: recoveryDraft.posts.length,
        } : null}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={() => confirm.onConfirm()}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="cf-app">
        <div className="bg-grid" />
        <div className="bg-glow" />

        <div className="inner">
          {/* BRAND HERO */}
          <div className="brand">
            <div className="brand-eyebrow">AI content studio</div>
            <h1 className="brand-title">Content<em>Forge</em></h1>
            <div className="brand-sub">Generate a full week of platform-native posts for any niche — tailored to your voice, audience, and goals.</div>
          </div>

          {/* FIRST-RUN WELCOME (new free users, step 1 only) */}
          {step === 1 && <WelcomeBanner />}

          {/* CONDENSED WIZARD STATUS SUMMARY */}
          {step < 4 && (
            <div className="compact-status-bar">
              <div className="compact-status-left">
                <span className="compact-status-badge"><strong>Step {step}</strong>: {wizardStepLabel}</span>
                <span className="compact-status-text">{wizardGuidance}</span>
              </div>
              <div className="compact-status-right">
                {form.industry && (
                  <div className="compact-setup-pill">
                    <span className="compact-pill-label">Niche:</span>
                    <strong className="compact-pill-val">{selectedIndustry?.label}</strong>
                  </div>
                )}
                <div className="compact-setup-pill">
                  <span className="compact-pill-label">Platform:</span>
                  <strong className="compact-pill-val">{form.platform}</strong>
                </div>
                {form.topics.length > 0 && (
                  <div className="compact-setup-pill">
                    <span className="compact-pill-label">Topics:</span>
                    <strong className="compact-pill-val">{form.topics.length}</strong>
                  </div>
                )}
                <div className="compact-setup-pill">
                  <span className="compact-pill-label">Mode:</span>
                  <strong className="compact-pill-val">{form.mode === "day" ? "Single Day" : "7-Day Week"}</strong>
                </div>
              </div>
            </div>
          )}

          {/* STEPPER */}
          <div className="stepper" role="list" aria-label="Wizard steps">
            {STEP_LABELS.map((s, i) => {
              const targetStep = i + 1;
              const isStepClickable = (tStep: number) => {
                if (tStep === step) return false;
                if (tStep < step) return true;
                if (posts.length > 0) return true;
                if (tStep === 2 && form.industry && form.coreIdea.trim()) return true;
                return false;
              };
              const isClickable = isStepClickable(targetStep);
              const stepTooltips = {
                1: "Industry: Select your niche and describe your core idea",
                2: "Topics: Pick up to 7 topics for this week",
                3: "Generate: Review the generator settings and write your content",
                4: "Calendar: Review, edit, and export your weekly posts",
              };
              const tooltip = stepTooltips[targetStep as keyof typeof stepTooltips];
              return (
                <React.Fragment key={s}>
                  <div
                    className={`snode ${targetStep === step ? "on" : ""} ${isClickable ? "clickable" : ""}`}
                    role="listitem"
                    tabIndex={isClickable ? 0 : -1}
                    aria-current={targetStep === step ? "step" : undefined}
                    aria-label={`Step ${targetStep}: ${s}${targetStep < step ? " (completed)" : targetStep === step ? " (current)" : " (upcoming)"}`}
                    onClick={() => { if (isClickable) setStep(targetStep); }}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && isClickable) setStep(targetStep); }}
                    style={{ cursor: isClickable ? "pointer" : "default" }}
                    title={tooltip}
                  >
                    <div className={`sdot ${targetStep === step ? "active" : ""} ${targetStep < step ? "done" : ""}`}>
                      {targetStep < step ? <Check /> : targetStep}
                    </div>
                    <div className={`slabel ${targetStep === step ? "active" : ""} ${targetStep < step ? "done" : ""}`}>{s}</div>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div key={`line-${i}`} className={`sline ${targetStep < step ? "done" : ""}`} aria-hidden="true" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <AnimatePresence mode="wait">

          {/* ── STEP 1 ── */}
          {step === 1 && <motion.div
            key="step-1"
            className="screen active"
            variants={screenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {recentCalendars.length > 0 && (
              <div className="recent-strip">
                <div className="recent-head">
                  <div className="recent-eyebrow">Pick up where you left off</div>
                  <Link to="/my-calendars" className="recent-link">View all →</Link>
                </div>
                <div className="recent-list">
                  {recentCalendars.map(rc => (
                    <div key={rc.id} className="recent-item">
                      <div className="recent-meta">
                        <div className="recent-title">{rc.title}</div>
                        <div className="recent-sub">
                          {rc.platform && <span className="recent-tag">{rc.platform}</span>}
                          {rc.industry_label && <span className="recent-tag">{rc.industry_label}</span>}
                          <span>{new Date(rc.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="recent-actions">
                        <button
                          type="button"
                          className="recent-btn primary"
                          onClick={() => navigate(`/calendar/${rc.id}`)}
                        >
                          Open →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="try-sample">
              <button type="button" className="try-sample-btn" onClick={loadSample}>
                ✨ See an example calendar (no sign-up, no API call)
              </button>
            </div>
            <div className="card" ref={industryRef}>
              <div className="sh">What's your <span>industry / niche? <span style={{ color: "var(--err)" }}>*</span></span></div>
              <div className="ind-grid" role="radiogroup" aria-label="Industry or niche">
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind.id}
                    type="button"
                    role="radio"
                    aria-checked={form.industry === ind.id}
                    className={`ind-card ${form.industry === ind.id ? "on" : ""}`}
                    onClick={() => setIndustry(ind.id)}
                  >
                    <div className="ind-icon" aria-hidden="true">{ind.icon}</div>
                    <div className="ind-label">{ind.label}</div>
                  </button>
                ))}
              </div>
              {showValidation && !form.industry && (
                <div style={{ color: "var(--err)", fontSize: "12px", marginTop: "10px", fontWeight: 400 }}>
                  Please select your industry / niche.
                </div>
              )}
            </div>

            <div className="card">
              <div className="sh">Your <span>platform & core idea</span></div>

              <div className="csect">
                <div className="flabel" id="cf-platform-label">Platform</div>
                <div className="plat-grid" role="radiogroup" aria-labelledby="cf-platform-label">
                  {PLATFORM_OPTIONS.map(pl => (
                    <button
                      key={pl.id}
                      type="button"
                      role="radio"
                      aria-checked={form.platform === pl.id}
                      className={`plat-card ${form.platform === pl.id ? "on" : ""}`}
                      onClick={() => upd("platform", pl.id)}
                    >
                      <div className="plat-name">{pl.label}</div>
                      <div className="plat-hint">{pl.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="csect" ref={coreIdeaRef}>
                <label className="flabel" htmlFor="cf-core-idea" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <span>Core idea / angle <span style={{ color: "var(--err)" }}>*</span></span>
                  <span style={{ fontSize: 10, color: form.coreIdea.length > 220 ? "#f0d49a" : form.coreIdea.length > 280 ? "#f09a9a" : "var(--text3)", fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>
                    {form.coreIdea.length}/300
                  </span>
                </label>
                <textarea
                  id="cf-core-idea"
                  rows={3}
                  maxLength={300}
                  className={showValidation && !form.coreIdea.trim() ? "invalid" : ""}
                  placeholder="What's the big idea or angle behind your content? e.g. 'helping early-stage SaaS founders ship better products faster'…"
                  value={form.coreIdea}
                  onChange={e => upd("coreIdea", e.target.value)}
                  aria-describedby="coreIdea-hint"
                />
                {showValidation && !form.coreIdea.trim() && (
                  <div style={{ color: "var(--err)", fontSize: "12px", marginTop: "5px", fontWeight: 400 }}>
                    Please describe your core idea.
                  </div>
                )}
                <div id="coreIdea-hint" className="time-hint" style={{ marginTop: 5 }}>
                  This is the north star for all generated content — be specific for better results.
                </div>
              </div>
            </div>

            <div className="card">
              <div className="sh">Your <span>frequency & schedule</span></div>

              <div className="csect">
                <div className="flabel" id="cf-mode-label">Generation mode</div>
                <div className="plat-grid" role="radiogroup" aria-labelledby="cf-mode-label" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.mode === "week"}
                    className={`plat-card ${form.mode === "week" ? "on" : ""} focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus:outline-none`}
                    onClick={() => setForm(f => ({ ...f, mode: "week", topics: f.topics.slice(0, 7) }))}
                  >
                    <div className="plat-name">Full week</div>
                    <div className="plat-hint">7 posts, Mon → Sun</div>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.mode === "day"}
                    className={`plat-card ${form.mode === "day" ? "on" : ""} focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus:outline-none`}
                    onClick={() => setForm(f => ({ ...f, mode: "day", topics: f.topics.slice(0, 1) }))}
                  >
                    <div className="plat-name">Single day</div>
                    <div className="plat-hint">Just 1 post for a chosen date</div>
                  </button>
                </div>
              </div>

              {form.mode === "day" ? (
                <div className="csect">
                  <label className="flabel" htmlFor="cf-target-date">Date for this post</label>
                  <input
                    type="date"
                    id="cf-target-date"
                    className="date-input focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus:outline-none"
                    value={form.targetDate}
                    onChange={e => upd("targetDate", e.target.value)}
                  />
                  <div className="time-hint" style={{ marginTop: 6 }}>
                    Your post will be written for <strong style={{ color: "rgba(200,240,154,.85)" }}>{shortDateLabel(parseLocalDate(form.targetDate) || nextMonday())}</strong>.
                  </div>
                </div>
              ) : (
                <div className="csect">
                  <label className="flabel" htmlFor="cf-week-start">Week starting <span className="fhint">(used for dates + .ics export)</span></label>
                  <input
                    type="date"
                    id="cf-week-start"
                    className="date-input focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus:outline-none"
                    value={form.weekStart}
                    onChange={e => upd("weekStart", e.target.value)}
                  />
                  <div className="time-hint" style={{ marginTop: 6 }}>
                    Day 1 will be <strong style={{ color: "rgba(200,240,154,.85)" }}>{shortDateLabel(weekStartDate)}</strong>. Each post gets a day-specific default time — you can adjust per post on the next screen.
                  </div>
                </div>
              )}
            </div>

            {/* COLLAPSIBLE TAILOR BRAND AND VOICE PANEL */}
            <div className="accordion-panel">
              <button
                type="button"
                id="advanced-brand-button"
                className="accordion-trigger"
                onClick={() => setShowAdvancedBrand(!showAdvancedBrand)}
                aria-expanded={showAdvancedBrand}
                aria-controls="advanced-brand-content"
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span className="accordion-trigger-title" style={{ padding: 0 }}>
                    ✨ Tailor Voice & Brand Settings
                    {(!showAdvancedBrand && (form.voice || form.style || form.audiences.length > 0)) ? <span className="accordion-active-tag">Active</span> : <span className="accordion-opt-tag">Optional</span>}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 300 }}>
                    {showAdvancedBrand ? "Configure language, target audience, voice, style, and rules" : "Expand to configure language, target audience, voice, style, and rules…"}
                  </span>
                </div>
                <span className="accordion-icon" style={{ fontSize: 16, fontWeight: 300 }}>
                  {showAdvancedBrand ? "−" : "+"}
                </span>
              </button>
              
              <div id="advanced-brand-content" className={`accordion-content ${showAdvancedBrand ? 'open' : ''}`} role="region" aria-labelledby="advanced-brand-button">
                <div className="accordion-content-inner">
                  <div className="csect">
                    <SelectField
                      label="Content language"
                      options={["English", "Tamil"]}
                      value={form.language}
                      onChange={v => upd("language", v)}
                      hint="(choose the script the generated content should use)"
                    />
                  </div>

                  <div className="csect">
                    <div className={`form-group-gated ${!form.industry ? 'gated' : ''}`}>
                      <MultiSelect 
                        label="Target audience" 
                        hint={form.industry ? "(pick up to 4)" : "(select industry first to unlock)"} 
                        options={audiencePool} 
                        value={form.audiences} 
                        onChange={v => upd("audiences", v)} 
                        placeholder={form.industry ? "Who are you writing for?" : "🔒 Select industry in Step 1 first"} 
                        max={4}
                        disabled={!form.industry}
                      />
                      {!form.industry && (
                        <div className="gated-lock-msg">
                          <span>
                            🔒 Target audience settings are locked.{" "}
                            <button
                              type="button"
                              onClick={() => scrollToField("industry")}
                              style={{ textDecoration: "underline", background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer", font: "inherit" }}
                            >
                              Select industry ↑
                            </button>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="g2">
                    <SelectField label="Voice / tone" options={VOICE_OPTIONS} value={form.voice} onChange={v => upd("voice", v)} placeholder="Select a voice…" />
                    <SelectField label="Writing style" options={STYLE_OPTIONS} value={form.style} onChange={v => upd("style", v)} placeholder="Select a style…" />
                    <SelectField label="Copy style" options={COPY_STYLE_OPTIONS} value={form.copyStyle} onChange={v => upd("copyStyle", v)} placeholder={null} hint="Applied when copying or scheduling" />
                    <SelectField label="Output quality" options={[{ value: "draft", label: "Draft (fast)" }, { value: "polished", label: "Polished (critique & rewrite)" }]} value={form.quality ?? "draft"} onChange={v => upd("quality", v as "draft" | "polished")} placeholder={null} hint="Polished performs a critique+rewrite pass (slower, uses pro model)" />
                  </div>

                  {(() => {
                    const preview = getVoiceStylePreview(form.industry, form.voice, form.style);
                    if (!preview) {
                      return (
                        <div className="vsp empty">
                          <div className="vsp-eyebrow">Live voice preview</div>
                          <div className="vsp-placeholder-lines">
                            <div className="vsp-line short" />
                            <div className="vsp-line long" />
                          </div>
                          <div className="vsp-empty">Pick a voice and style above to see a 2-line sample of how your posts will sound — before you generate.</div>
                        </div>
                      );
                    }
                    return (
                      <div className="vsp">
                        <div className="vsp-eyebrow">
                          Live voice preview · {form.voice || "default voice"} × {form.style || "default style"}
                        </div>
                        <div className="vsp-hook">{preview.hook}</div>
                        <div className="vsp-tail">{preview.tail}</div>
                        {preview.stylePreset && (
                          <div className="vsp-tail" style={{ marginTop: 8, fontSize: 12, color: '#9a9aae', fontStyle: 'italic' }}>{preview.stylePreset}</div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="csect" style={{ marginTop: 18 }}>
                    <div className="flabel">Brand memory <span className="fhint">(saves voice, style, CTA, and phrase preferences)</span></div>
                    <div className="time-hint" style={{ marginBottom: 10 }}>
                      Save your brand setup once and reuse it on future generations. Brand memory is private and saved locally to this workspace.
                    </div>
                    <div className="bactions" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                      <button type="button" className="cpbtn" onClick={saveBrandMemoryFromForm}>Local Brand Memory (this browser only)</button>
                      <button type="button" className="cpbtn" onClick={applyBrandMemoryToForm} disabled={!brandMemory}>Apply saved memory</button>
                      <button type="button" className="cpbtn" onClick={clearBrandMemorySaved} disabled={!brandMemory}>Clear saved memory</button>
                      {/* Feature: Cloud Persona Sync */}
                      {user && (
                        <button
                          type="button"
                          className="cpbtn done"
                          title="Sync your voice, style, audience & goals to your profile — available on any device"
                          onClick={async () => {
                            try {
                              await profileUpdateMutation.mutateAsync({
                                default_voice: form.voice || null,
                                default_style: form.style || null,
                                default_audiences: form.audiences as any,
                                default_goals: form.goals as any,
                              });
                              toast.success("Persona saved & synced to cloud ✓");
                            } catch (e) {
                              toast.error((e instanceof Error && e.message) || "Failed to sync persona");
                            }
                          }}
                          disabled={profileUpdateMutation.isPending}
                        >
                          {profileUpdateMutation.isPending ? "Syncing…" : "☁️ Profile Sync (saved to account)"}
                        </button>
                      )}
                    </div>
                    {brandMemory && (
                      <div className="time-hint" style={{ marginTop: 8 }}>
                        Saved: {brandMemory.voice || "Voice unset"} · {brandMemory.style || "Style unset"}{brandMemory.cta ? ` · ${brandMemory.cta}` : ""}
                      </div>
                    )}
                  </div>

                  <div className="divider" />

                  <div className="csect">
                    <div className={`form-group-gated ${!form.industry ? 'gated' : ''}`}>
                      <div className="flabel">Goal <span className="fhint">(pick all that apply)</span></div>
                      <div className="chips">
                        {GOAL_OPTIONS.map(v => (
                          <div key={v} className={`chip ${form.goals.includes(v) ? "on" : ""}`} onClick={() => form.industry && toggleChip("goals", v)}>{v}</div>
                        ))}
                      </div>
                      {!form.industry && (
                        <div className="gated-lock-msg">
                          <span>
                            🔒 Goal configuration is locked.{" "}
                            <button
                              type="button"
                              onClick={() => scrollToField("industry")}
                              style={{ textDecoration: "underline", background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer", font: "inherit" }}
                            >
                              Select industry ↑
                            </button>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && <div className="err-box" role="alert">{error}</div>}
            <div className="brow" style={{ alignItems: "center", gap: 12 }}>
              {(!form.industry || !form.coreIdea.trim()) && (
                <span style={{ fontSize: 11, color: "var(--text3)", fontStyle: "italic" }}>
                  {!form.industry ? "Select an industry first" : "Add a core idea to continue"}
                </span>
              )}
              <button
                className="btn btn-p"
                onClick={() => { if (validate(1)) { setError(""); setShowValidation(false); setStep(2); } }}
              >
                Next step →
              </button>
            </div>
          </motion.div>}

          {/* ── STEP 2 ── */}
          {step === 2 && <motion.div
            key="step-2"
            className="screen active"
            variants={screenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="card">
              <div className="sh">Pick your <span>{form.mode === "day" ? "single-day topic" : "weekly topics"}</span></div>

              <div className="csect" ref={topicsRef}>
                <div className={`form-group-gated ${!form.industry ? 'gated' : ''}`}>
                  <MultiSelect
                    label={form.mode === "day" ? "Topic for this post" : "Topics to cover"}
                    hint={form.mode === "day" ? "(optional — will infer topic from core idea if left empty)" : "(optional — pick up to 7; fewer than 7 will be expanded into related angles or inferred from your core idea)"}
                    options={topicPool.length > 0 ? topicPool : ["Add custom topics below ↓"]}
                    disabledOptions={topicPool.length > 0 ? [] : ["Add custom topics below ↓"]}
                    value={form.topics}
                    onChange={v => upd("topics", form.mode === "day" ? v.slice(-1) : v)}
                    placeholder={form.industry ? "Select topics…" : "🔒 Select industry in Step 1 first"}
                    max={form.mode === "day" ? 1 : 7}
                    disabled={!form.industry}
                  />
                  {!form.industry && (
                    <div className="gated-lock-msg">
                      <span>
                        🔒 Topic selection is locked.{" "}
                        <button
                          type="button"
                          onClick={() => scrollToField("industry")}
                          style={{ textDecoration: "underline", background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer", font: "inherit" }}
                        >
                          Select industry ↑
                        </button>
                      </span>
                    </div>
                  )}
                </div>
                {form.industry && (
                  <div className="add-row">
                    <input type="text" className="ti" placeholder="+ add a custom topic, press Enter or click Add"
                      aria-label="Add custom topic"
                      value={customTopic}
                      onChange={e => setCustomTopic(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addCustomTopic()} />
                    <button className="add-btn" onClick={addCustomTopic}>Add</button>
                  </div>
                )}
              </div>

              {/* Inspiration Bank - Show trending topics for quick selection */}
              {form.industry ? (
                <div className="csect">
                  <InspirationBank
                    industry={form.industry}
                    platform={form.platform}
                    onTopicClick={(topic) => {
                      const updated = form.mode === "day" ? [topic] : [...form.topics, topic];
                      if (updated.length <= (form.mode === "day" ? 1 : 7)) {
                        upd("topics", updated);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="csect">
                  <div className="inspiration-bank-gated">
                    <div className="flabel">Inspiration Bank</div>
                    <div className="gated-lock-msg">
                      <span>
                        🔒 Inspiration Bank is locked.{" "}
                        <button
                          type="button"
                          onClick={() => scrollToField("industry")}
                          style={{ textDecoration: "underline", background: "none", border: "none", padding: 0, color: "var(--accent)", cursor: "pointer", font: "inherit" }}
                        >
                          Select industry ↑
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* NEW: Post Type grid */}
              <div className="csect">
                <div className="flabel" id="cf-posttype-label">Post type</div>
                <div className="plat-grid" role="radiogroup" aria-labelledby="cf-posttype-label" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
                  {POST_TYPE_OPTIONS.map(pt => (
                    <button
                      key={pt.id}
                      type="button"
                      role="radio"
                      aria-checked={form.postType === pt.id}
                      className={`plat-card ${form.postType === pt.id ? "on" : ""}`}
                      onClick={() => upd("postType", pt.id)}
                    >
                      <div className="plat-name">{pt.label}</div>
                      <div className="plat-hint">{pt.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* COLLAPSIBLE ADVANCED FORMATTING & KEYWORDS PANEL */}
              <div className="accordion-panel">
                <button
                  type="button"
                  id="advanced-format-button"
                  className="accordion-trigger"
                  onClick={() => setShowAdvancedFormat(!showAdvancedFormat)}
                  aria-expanded={showAdvancedFormat}
                  aria-controls="advanced-format-content"
                >
                  <span className="accordion-trigger-title">
                    ⚙️ Advanced Formatting & Keywords
                    {(!showAdvancedFormat && (form.format !== "Balanced mix" || form.cta !== "Share & repost bait" || form.length !== "medium" || form.structure !== "mixed" || form.bannedWords.length > 0 || form.requiredWords.length > 0)) ? <span className="accordion-active-tag">Active</span> : <span className="accordion-opt-tag">Optional</span>}
                  </span>
                  <span className={`accordion-icon ${showAdvancedFormat ? 'open' : ''}`}>▼</span>
                </button>

                <div id="advanced-format-content" className={`accordion-content ${showAdvancedFormat ? 'open' : ''}`} role="region" aria-labelledby="advanced-format-button">
                  <div className="accordion-content-inner">
                    <div className="g2" style={{ marginBottom: 16 }}>
                      <SelectField label="Format mix" options={FORMAT_OPTIONS} value={form.format} onChange={v => upd("format", v)} />
                      <SelectField label="CTA style" options={CTA_OPTIONS} value={form.cta} onChange={v => upd("cta", v)} />
                    </div>

                    <div className="csect">
                      <div className="flabel" id="cf-length-label">Post length</div>
                      <div className="plat-grid" role="radiogroup" aria-labelledby="cf-length-label">
                        {LENGTH_OPTIONS.filter(o => !(form.mode === "day" && o.id === "mixed")).map(o => (
                          <button
                            key={o.id}
                            type="button"
                            role="radio"
                            aria-checked={form.length === o.id}
                            className={`plat-card ${form.length === o.id ? "on" : ""}`}
                            onClick={() => upd("length", o.id)}
                          >
                            <div className="plat-name">{o.label}</div>
                            <div className="plat-hint">{o.hint}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="csect">
                      <div className="flabel" id="cf-structure-label">Structure <span className="fhint">(paragraphs vs bullets)</span></div>
                      <div className="plat-grid" role="radiogroup" aria-labelledby="cf-structure-label">
                        {STRUCTURE_OPTIONS.map(o => (
                          <button
                            key={o.id}
                            type="button"
                            role="radio"
                            aria-checked={form.structure === o.id}
                            className={`plat-card ${form.structure === o.id ? "on" : ""}`}
                            onClick={() => upd("structure", o.id)}
                          >
                            <div className="plat-name">{o.label}</div>
                            <div className="plat-hint">{o.hint}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="g2">
                      <div>
                        <label className="flabel" htmlFor="cf-banned-words">Never say <span className="fhint">(comma-separated, hard ban)</span></label>
                        <input
                          id="cf-banned-words"
                          type="text"
                          className="ti"
                          placeholder="e.g. game-changer, synergy, leverage"
                          value={form.bannedWords.join(", ")}
                          onChange={e => upd("bannedWords", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                        />
                      </div>
                      <div>
                        <label className="flabel" htmlFor="cf-required-words">Must mention <span className="fhint">(comma-separated, weave in)</span></label>
                        <input
                          id="cf-required-words"
                          type="text"
                          className="ti"
                          placeholder="e.g. our product name, RAG, India"
                          value={form.requiredWords.join(", ")}
                          onChange={e => upd("requiredWords", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>


              
              <div className="csect">
                <label className="flabel" htmlFor="cf-extra-context" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <span>Extra context <span className="fhint">(optional)</span></span>
                  {form.extra.length > 0 && (
                    <span style={{ fontSize: 10, color: form.extra.length > 450 ? "#f0d49a" : "var(--text3)", fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>
                      {form.extra.length}/500
                    </span>
                  )}
                </label>
                <textarea id="cf-extra-context" rows={2} maxLength={500} placeholder="e.g. reference specific tools, frameworks, local market context, personal story hooks…" value={form.extra} onChange={e => upd("extra", e.target.value)} />
              </div>
            </div>

            {error && (
              <div className="err-box">
                {error}
                {Boolean(lastGenerationError) && (
                  <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.8 }}>
                    <button
                      onClick={() => generate(true)}
                      disabled={isGenerating}
                      style={{
                        background: 'rgba(200,240,154,.2)',
                        border: '1px solid rgba(200,240,154,.3)',
                        color: '#c8f09a',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: isGenerating ? 'not-allowed' : 'pointer',
                        opacity: isGenerating ? 0.6 : 1,
                        fontSize: '12px',
                        fontFamily: 'var(--font-body)',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isGenerating) {
                          (e.target as HTMLButtonElement).style.background = 'rgba(200,240,154,.3)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.background = 'rgba(200,240,154,.2)';
                      }}
                    >
                      {isGenerating ? '⏳ Retrying...' : '🔄 Try again'}
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="brow">
              <button className="btn btn-g" onClick={() => { setError(""); setStep(1); }}>← Back</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-p" onClick={() => generate(false)} disabled={isGenerating} style={{ opacity: isGenerating ? 0.6 : 1, cursor: isGenerating ? 'not-allowed' : 'pointer' }}>{isGenerating ? `⏳ ${genMsg || 'Generating...'}` : (form.mode === "day" ? "Generate this post →" : "Generate my week →")}</button>
                <button className="btn btn-g" onClick={async () => {
                  if (!user) { toast.error('Sign in to save templates'); return; }
                  const name = window.prompt('Template name (short)');
                  if (!name || !name.trim()) return;
                  try {
                    const payload = { user_id: user.id, name: name.trim(), description: '', config: form as unknown as Json };
                    const { error } = await supabase.from('templates').insert(payload).select();
                    if (error) throw error;
                    toast.success(`Template "${name}" saved to your account! Template loading will be available in the next release.`);
                  } catch (e) {
                    toast.error((e instanceof Error && e.message) || 'Failed to save template');
                  }
                }}>Save as template</button>
              </div>
            </div>
          </motion.div>}

          {showSubtopicConfirm && (
            <Modal onClose={() => setShowSubtopicConfirm(false)} className="modal-content">
              <div className="sh">Your topic will be expanded into 7 posts</div>
              <div className="time-hint" style={{ marginTop: 8 }}>
                You selected fewer than 7 topics, so the remaining days will be filled with related angles.
              </div>
              <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                {subtopicPreview.map((topic, index) => (
                  <div key={index} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", color: "var(--text)" }}>
                    <strong style={{ color: "var(--accent)", marginRight: 8 }}>Day {index + 1}</strong>
                    {topic}
                  </div>
                ))}
              </div>
              <div className="brow" style={{ marginTop: 20 }}>
                <button className="btn btn-g" onClick={() => setShowSubtopicConfirm(false)}>Edit topics</button>
                <button className="btn btn-p" onClick={() => { setShowSubtopicConfirm(false); void generate(false, true); }}>Looks good, generate →</button>
              </div>
            </Modal>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && <motion.div
            key="step-3"
            className="screen active"
            variants={screenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="gen-wrap">
              {/* Pulsing structural skeleton loader */}
              <div 
                className="animate-pulse-glow"
                style={{
                  width: "100%",
                  maxWidth: "480px",
                  background: "rgba(18, 20, 32, 0.65)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "20px",
                  padding: "24px",
                  margin: "0 auto 28px",
                  textAlign: "left",
                  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.45)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <div style={{ height: "16px", width: "40px", background: "rgba(200, 240, 154, 0.15)", borderRadius: "99px" }} />
                    <div style={{ height: "16px", width: "70px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "99px" }} />
                  </div>
                  <div style={{ height: "24px", width: "24px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "50%" }} />
                </div>
                <div style={{ height: "20px", width: "75%", background: "rgba(255, 255, 255, 0.08)", borderRadius: "6px", marginBottom: "16px" }} />
                <div style={{ display: "grid", gap: "8px", marginBottom: "20px" }}>
                  <div style={{ height: "12px", width: "100%", background: "rgba(255, 255, 255, 0.04)", borderRadius: "4px" }} />
                  <div style={{ height: "12px", width: "95%", background: "rgba(255, 255, 255, 0.04)", borderRadius: "4px" }} />
                  <div style={{ height: "12px", width: "80%", background: "rgba(255, 255, 255, 0.04)", borderRadius: "4px" }} />
                </div>
                <div style={{ height: "36px", width: "100%", background: "rgba(200, 240, 154, 0.06)", border: "1px solid rgba(200, 240, 154, 0.12)", borderRadius: "10px" }} />
              </div>

              <div className="gen-title">{form.mode === "day" ? "Writing your post" : "Writing your week"}</div>
              <div className="gen-msg" aria-live="polite">{genMsg}</div>
              <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4, fontStyle: "italic" }}>
                {form.mode === "day" ? "Usually takes 10–20 seconds" : "Usually takes 30–60 seconds"} — keep this tab open
              </div>
              <div className="prog-track" style={{ marginBottom: 20 }} role="progressbar" aria-valuenow={Math.round(((genStep + 1) / GEN_LABELS.length) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Content generation progress">
                <div className="prog-indet" />
              </div>
              <div className="gen-checklist" style={{ margin: "0 auto" }}>
                {GEN_LABELS.map((l, i) => (
                  <div key={i} className={`gci ${i < genStep ? "done" : ""}`}>
                    <span className="gci-dot" />
                    {l}
                  </div>
                ))}
              </div>
              <button
                onClick={cancelGeneration}
                style={{ marginTop: 24, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#7a7a8e", padding: "7px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "var(--font-body)" }}
              >
                Cancel and try again
              </button>
            </div>
          </motion.div>}

          {/* ── STEP 4 ── */}
          {step === 4 && <motion.div
            key="step-4"
            className="screen active"
            variants={screenVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {posts.length === 0 && step === 4 && (
              <div className="gen-wrap" style={{ minHeight: 320 }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, rgba(200,240,154,0.18), rgba(200,240,154,0.04) 65%, transparent 80%)", border: "1px solid rgba(200,240,154,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, marginBottom: 20 }}>
                  📅
                </div>
                <div className="gen-title" style={{ fontSize: 20, marginBottom: 8 }}>No posts yet</div>
                <div className="gen-msg" style={{ maxWidth: 340 }}>Go back to step 2 and hit "Generate" to build your content calendar.</div>
                <button className="btn btn-p" style={{ marginTop: 20 }} onClick={() => setStep(2)}>← Back to topics</button>
              </div>
            )}
            {posts.length > 0 && (
              <Suspense fallback={<div className="gen-wrap" style={{ minHeight: 300 }}><div className="gen-orb" /><div className="gen-title" style={{ marginTop: 16 }}>Loading results…</div></div>}>
                <IndexResults
                  posts={posts}
                  activeDay={activeDay}
                  setActiveDay={setActiveDay}
                  lockedDays={lockedDaysSet}
                  toggleLock={toggleLock}
                  form={form}
                  savedId={savedId}
                  setSavedId={setSavedId}
                  sampleMode={sampleMode}
                  exitSample={exitSample}
                  reformatTarget={reformatTarget}
                  setReformatTarget={setReformatTarget}
                  reformatting={reformatting}
                  regenIdx={regenIdx}
                  regenerateUnlocked={regenerateUnlocked}
                  reformatAllForPlatform={reformatAllForPlatform}
                  draggedIndex={draggedIndex}
                  setDraggedIndex={setDraggedIndex}
                  handleDayDrop={(idx) => handleDayDrop(draggedIndex, idx)}
                  postTimes={postTimes}
                  setPostTimes={setPostTimes}
                  getClipboardStyle={getClipboardStyle}
                  copyPost={copyPost}
                  copiedIdx={copiedIdx}
                  copyMenuOpen={copyMenuOpen}
                  setCopyMenuOpen={setCopyMenuOpen}
                  showRationale={showRationale}
                  setShowRationale={setShowRationale}
                  enhanceCurrentPost={enhanceCurrentPost}
                  tweakRef={tweakRef}
                  copyMenuRef={copyMenuRef}
                  handleFocusedRegenerate={handleFocusedRegenerate}
                  handleApplyCta={handleApplyCta}
                  handleUseAsSeed={handleUseAsSeed}
                  handleApplyImage={handleApplyImage}
                  saveCalendar={saveCalendar}
                  saving={saving}
                  downloadTxt={downloadTxt}
                  exportIcs={exportIcs}
                  setBatchEditOpen={setBatchEditOpen}
                  copyAll={copyAll}
                  copiedAll={copiedAll}
                  showPerformance={showPerformance}
                  setShowPerformance={setShowPerformance}
                  weekSummary={weekSummary}
                  selectedIndustry={selectedIndustry}
                  setStep={setStep}
                  clearDraft={clearDraft}
                  setPostsWithHistory={setPostsWithHistory}
                  setLockedDays={(s: Set<number>) => setLockedDays(Array.from(s))}
                  setError={setError}
                  generationMeta={generationMeta}
                  weekStartDate={weekStartDate}
                  toggleLockedDay={toggleLockedDay}
                  handleDragStart={handleDragStart}
                  handleDragOver={handleDragOver}
                  handleDrop={handleDrop}
                  onHashtagsChange={handleHashtagsChange}
                  onToneShift={handleToneShift}
                  regenerateDay={regenerateDay}
                />
              </Suspense>
            )}
          </motion.div>}

          </AnimatePresence>
        </div>

        {/* Batch Edit Modal */}
        <BatchEditModal
          isOpen={batchEditOpen}
          onClose={() => setBatchEditOpen(false)}
          onApply={applyBatchEdit}
          totalPosts={posts.length}
          currentPlatform={form.platform}
        />

        {/* Diff View Modal */}
        {diffViewData && (
          <DiffView
            before={diffViewData.before}
            after={diffViewData.after}
            onAccept={() => {
              // Accept the change: apply the new post
              setPostsWithHistory(prev => prev.map((p, i) => (i === diffViewData.dayIndex ? diffViewData.newPost : p)));
              setPostsWithHistory(prev => prev.map((p, i) => (i === diffViewData.dayIndex ? diffViewData.newPost : p)));
              setSavedId(null);
              setDiffViewData(null);
              toast.success(`Day ${posts[diffViewData.dayIndex].day} updated`);
            }}
            onReject={() => {
              // Reject: do not apply the change
              setDiffViewData(null);
              toast.info(`Changes discarded for Day ${posts[diffViewData.dayIndex].day}`);
            }}
            title={`Review changes for Day ${posts[diffViewData.dayIndex].day}`}
          />
        )}

        {/* Keyboard Shortcuts Help — dismissible tooltip, doesn't overlap content */}
        {step === 4 && (
          <div style={{ position: "fixed", bottom: 16, left: 16, zIndex: 999 }} className="group">
            <button
              aria-label="Show keyboard shortcuts"
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "rgba(120,113,108,0.12)", border: "1px solid rgba(120,113,108,0.2)",
                color: "#78716c", fontSize: 12, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              ?
            </button>
            <div
              role="tooltip"
              style={{
                display: "none", position: "absolute", bottom: 36, left: 0,
                background: "#1c1917", color: "#faf8f4", borderRadius: 8, padding: "10px 14px",
                fontSize: 11, lineHeight: 1.6, whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              }}
              className="group-hover:!block group-focus-within:!block"
            >
              <strong style={{ display: "block", marginBottom: 4 }}>Quick shortcuts</strong>
              Ctrl+Z — Undo &nbsp;|&nbsp; Ctrl+Y — Redo<br/>
              Ctrl+Shift+E — Batch edit<br/>
              Drag days to reorder
            </div>
          </div>
        )}

        {step === 2 && showFloatingButton && (
          <button
            className="btn btn-p"
            style={{ position: "fixed", right: 24, bottom: 28, zIndex: 950, padding: "12px 18px", borderRadius: 12 }}
            onClick={() => generate(false)}
            disabled={isGenerating}
            aria-hidden="true"
            tabIndex={-1}
          >
            {isGenerating ? `⏳ ${genMsg || "Generating..."}` : (form.mode === "day" ? "Generate this post →" : "Generate my week →")}
          </button>
        )}
      </div>
    </WorkspacePage>
  );
};

export default Index;
