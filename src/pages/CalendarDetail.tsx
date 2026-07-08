import {
  formatForPlatform,
  writeToClipboard,
  niceLabelFor,
  buildRawMarkdown,
  PLATFORM_LABELS,
  stripMarkdown,
} from "@/lib/platformCopy";
import { useEffect, useMemo, useRef, useState, useCallback, lazy, Suspense } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveFunctionsBaseUrl } from "@/lib/functionsBaseUrl";
import {
  useCalendarQuery,
  useProfileQuery,
  useProfileUpdateMutation,
  useScheduledPostsQuery,
  useCreateCalendarMutation,
  useRegeneratePostMutation,
  useUpdateSavedCalendarMutation,
  useRepurposePostMutation,
  useGeneratePostImageMutation,
  useInlineRewriteMutation,
  useGenerateSinglePostMutation,
  useIdeaBacklogQuery,
  useMarkIdeaUsedMutation,
  useRemoveIdeaFromBacklogMutation,
  useBrandSlotsQuery,
} from "@/hooks/useAppQueries";
import { toast } from "sonner";
import { createScopedLogger } from "@/lib/logger";
import { BufferScheduler } from "@/components/BufferScheduler";
import { HashtagChipEditor } from "@/components/HashtagChipEditor";
import { PersonaCompare } from "@/components/PersonaCompare";
import { WeekBalanceScore } from "@/components/WeekBalanceScore";
import { DraftVersionHistory } from "@/components/DraftVersionHistory";
import { saveSnapshot } from "@/lib/draftSnapshots";
import "./CalendarDetail.css";

import {
  downloadIcs,
  parseLocalDate,
  nextMonday,
  toDateInputValue,
  dateForDow,
  shortDateLabel,
} from "@/lib/calendarSchedule";
import { suggestedTimeForDay } from "@/lib/postingTimes";
import {
  applyPolicy,
  parsePolicyList,
  parseHashtagsString,
  normalizeTag,
  displayTag,
  HashtagPolicy,
} from "@/lib/hashtagPolicy";
import { insightFor } from "@/lib/postInsights";
import PostInsights from "@/components/PostInsights";
import { PerformanceScoreCard } from "@/components/PerformanceScoreCard";
import { TopicGapBadge } from "@/components/TopicGapBadge";
import { IdeaBacklogPanel } from "@/components/IdeaBacklogPanel";
import {
  PerformanceFocusMetric,
  calculatePerformanceScore,
  getWeakestPerformanceMetric,
  getRegenerationGuidance,
  getEngagementPrediction,
  ENGAGEMENT_BADGE,
} from "@/lib/postPerformanceScore";
import { buildBrandMemoryPrompt } from "@/lib/brandMemory";
import { resolveActiveBrandSlot } from "@/lib/brandSlots";
import { createSeedFromPost, storeSeed } from "@/lib/seedFromPost";
import { isEnabled } from "@/lib/featureFlags";
import { unwrapPost, aspectRatioForPlatform, repurposeOnePost } from "@/lib/repurposePost";
import { useBulkRepurpose, mergeRepurposedResults } from "@/hooks/useBulkRepurpose";
import { BulkRepurposeModal } from "@/components/BulkRepurposeModal";
import { BulkRepurposePanel } from "@/components/BulkRepurposePanel";
import { sendEvent } from "@/lib/telemetry";
import {
  browserTimezone,
  fmtDateInTz,
  fmtTimeInTz,
  listTimezones,
  tzLabel,
  zonedToUtcIso,
} from "@/lib/timezones";
import { buildTrackingUrl } from "@/lib/utm";
import { useAuth } from "@/contexts/AuthContext";
import { getE2EAuthFlag } from "@/lib/e2eFixtures";
import e2eStore from "@/lib/e2eStore";

const FeedbackModal = lazy(() => import("@/components/FeedbackModal"));
import { WorkspacePage } from "@/components/layout/WorkspacePage";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/SkeletonList";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { Database, Json } from "@/integrations/supabase/types";
import type { Post } from "@/components/wizard/constants";
import { AnimatePresence, motion } from "framer-motion";
import { Helmet } from "react-helmet-async";

type SavedCalendarInsert = Database["public"]["Tables"]["saved_calendars"]["Insert"];

const EMPTY_POST: Post = {
  day: 1,
  dow: "Mon",
  topic: "",
  format: "Balanced mix",
  title: "",
  hook: "",
  body: "",
  cta: "",
  hashtags: "",
  rationale: "",
};

interface FormPayload {
  industry?: string;
  platform?: string;
  language?: string;
  coreIdea?: string;
  audiences?: string[];
  voice?: string;
  style?: string;
  goals?: string[];
  format?: string;
  cta?: string;
  length?: string;
  structure?: string;
  extra?: string;
  bannedWords?: string[];
  requiredWords?: string[];
  weekStart?: string;
  topics?: string[];
}

function wordCount(s: string): number {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function hasEmoji(text: string): boolean {
  return /\p{Emoji}/u.test(text);
}
type TweakKind =
  | "shorter"
  | "punchier"
  | "add-stat"
  | "remove-emoji"
  | "more-personal"
  | "clean-formatting"
  | "enhance"
  | string;

function calculateScore(scores: Record<string, number>): number {
  const keys = Object.keys(scores);
  if (keys.length === 0) return 0;
  const sum = keys.reduce((acc, k) => acc + scores[k], 0);
  return Number((sum / keys.length).toFixed(1));
}

function cssAspectRatioForPlatform(platform?: string): string {
  const ratio = aspectRatioForPlatform(platform);
  if (ratio === "4:5") return "4 / 5";
  if (ratio === "16:9") return "16 / 9";
  return "1.91 / 1";
}

function readingStats(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const averageSentenceWords = sentences.length ? words.length / sentences.length : words.length;
  const longSentences = sentences.filter((sentence) => wordCount(sentence) > 28).length;
  const score = Math.max(
    1,
    Math.min(100, Math.round(100 - averageSentenceWords * 2.1 - longSentences * 4))
  );
  const label = score >= 72 ? "Easy" : score >= 52 ? "Moderate" : "Dense";
  return { score, label, averageSentenceWords: Math.round(averageSentenceWords), longSentences };
}

function normalizeForRepeatCheck(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

function repeatedPhraseWarning(text: string, corpus: string[]): string | null {
  const words = normalizeForRepeatCheck(text);
  if (words.length < 16 || corpus.length === 0) return null;

  const phrases = new Set<string>();
  for (let i = 0; i <= words.length - 7; i += 1) {
    phrases.add(words.slice(i, i + 7).join(" "));
  }

  for (const prior of corpus) {
    const priorWords = normalizeForRepeatCheck(prior);
    if (priorWords.length < 16) continue;
    for (let i = 0; i <= priorWords.length - 7; i += 1) {
      const phrase = priorWords.slice(i, i + 7).join(" ");
      if (phrases.has(phrase)) return `Possible repeat: "${phrase}"`;
    }
  }
  return null;
}

export default function CalendarDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isE2EModeActive, setIsE2EModeActive] = useState(false);
  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState("");
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Post | null>(null);
  const [saving, setSaving] = useState(false);

  // Feature 5: Post Field History / Versioning
  const [fieldHistory, setFieldHistory] = useState<Record<number, Record<string, string[]>>>({});

  // Feature 2: Inline Image URL Paste
  const [pasteImageOpenDay, setPasteImageOpenDay] = useState<number | null>(null);
  const [pasteImageUrl, setPasteImageUrl] = useState("");

  // Feature 6: Tone Slider
  const [toneLevel, setToneLevel] = useState<Record<number, number>>({});
  const toneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [regenerating, setRegenerating] = useState(false);
  const [formPayload, setFormPayload] = useState<FormPayload>({});
  const [platform, setPlatform] = useState<string>("");
  const [industryLabel, setIndustryLabel] = useState<string>("");
  const [weekStart, setWeekStart] = useState<string>(toDateInputValue(nextMonday()));
  const [postTimes, setPostTimes] = useState<Record<string, string>>({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [tweakOpen, setTweakOpen] = useState(false);
  const tweakRef = useRef<HTMLDivElement>(null);
  const [lockedDays, setLockedDays] = useState<Set<number>>(new Set());
  const [reformatTarget, setReformatTarget] = useState<string>("");
  const [pendingReformatTarget, setPendingReformatTarget] = useState<string | null>(null);
  const [reformatting, setReformatting] = useState(false);
  const [pendingBanTag, setPendingBanTag] = useState<{ day: number; tag: string } | null>(null);
  const [pendingBulkRegenerate, setPendingBulkRegenerate] = useState<{ count: number } | null>(
    null
  );
  const [pendingRemoveVisual, setPendingRemoveVisual] = useState<number | null>(null);
  const [personaCompareOpen, setPersonaCompareOpen] = useState(false);
  const createCalendar = useCreateCalendarMutation();

  const handleApplyCompare = async (rewritten: Post) => {
    const updated = [...posts];
    updated[active] = rewritten;
    setPosts(updated);
    if (id) {
      try {
        await updateCalendarMutation.mutateAsync({ posts: updated as any });
        toast.success("Calendar updated in cloud ✓");
      } catch (e) {
        toast.error("Failed to sync updated post to cloud");
      }
    }
  };

  const regenerateMutation = useRegeneratePostMutation(id);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const [exportingFormat, setExportingFormat] = useState<"md" | "pdf" | "ics" | null>(null);
  const [bulkRegenerating, setBulkRegenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [pendingScheduleConflict, setPendingScheduleConflict] = useState<{
    rows: Record<string, unknown>[];
    count: number;
  } | null>(null);
  const [timezone, setTimezone] = useState<string>(browserTimezone());
  const [profileTimezone, setProfileTimezone] = useState<string>("");
  const [trackingUrl, setTrackingUrl] = useState<string>("");
  const [variantSaving, setVariantSaving] = useState<{ day: number; field: "hook" | "cta" } | null>(
    null
  );
  const [lockedHashtags, setLockedHashtags] = useState<Record<string, string[]>>({});
  const [profilePolicy, setProfilePolicy] = useState<HashtagPolicy>({ banned: [], required: [] });
  const [statusByDay, setStatusByDay] = useState<
    Record<number, "drafted" | "approved" | "published" | "failed">
  >({});
  const [tagPopover, setTagPopover] = useState<{ day: number; tag: string } | null>(null);
  const [tagReplacement, setTagReplacement] = useState("");
  const [repurposeOpen, setRepurposeOpen] = useState(false);
  const repurposeRef = useRef<HTMLDivElement>(null);
  const [repurposedPost, setRepurposedPost] = useState<Post | null>(null);
  const [repurposedTarget, setRepurposedTarget] = useState("");
  const [repurposing, setRepurposing] = useState(false);
  const [repurposeStage, setRepurposeStage] = useState<
    "" | "rewriting" | "scoring" | "illustrating"
  >("");
  const repurposeMutation = useRepurposePostMutation();
  // 3.2 telemetry: per-slot (day) tracking of "last generated-but-unsaved AI variant"
  // for the single-post regenerate/repurpose flows only. Deliberately simple — not
  // meant to be perfectly rigorous, just directionally correct for the insights view.
  // Scoped OUTSIDE the bulk repurpose flow (which has its own bulk-specific events).
  const slotVariantRef = useRef<
    Record<number, { source: "regenerate" | "repurpose"; saved: boolean } | undefined>
  >({});
  const generateImageMutation = useGeneratePostImageMutation();
  const inlineRewriteMutation = useInlineRewriteMutation();
  const [imageGeneratingDay, setImageGeneratingDay] = useState<number | null>(null);
  const [inlineSelection, setInlineSelection] = useState<{
    field: "hook" | "body" | "cta";
    start: number;
    end: number;
    text: string;
  } | null>(null);
  const [inlineRewriting, setInlineRewriting] = useState(false);
  const [pastPostText, setPastPostText] = useState<string[]>([]);
  const tzList = listTimezones();

  // 3.1 Bulk calendar repurposing
  const [bulkRepurposeModalOpen, setBulkRepurposeModalOpen] = useState(false);
  const [bulkRepurposeSaving, setBulkRepurposeSaving] = useState(false);
  const bulkRepurposeTargetRef = useRef("");
  const bulkRepurpose = useBulkRepurpose({
    calendarId: id,
    platform: platform || formPayload.platform || "LinkedIn",
    formPayload,
    repurposeMutateAsync: (payload) => repurposeMutation.mutateAsync(payload),
    generateImageMutateAsync: (payload) => generateImageMutation.mutateAsync(payload),
    onPostSuccess: ({ day }) => {
      void sendEvent("repurpose_bulk_post_success", {
        calendarId: id,
        day,
        targetPlatform: bulkRepurposeTargetRef.current,
      });
    },
    onPostFailure: ({ day, error, blocked }) => {
      void sendEvent("repurpose_bulk_post_failed", {
        calendarId: id,
        day,
        error,
        blocked,
        targetPlatform: bulkRepurposeTargetRef.current,
      });
    },
  });

  const {
    data: calendarData,
    isLoading: calendarLoading,
    error: calendarError,
    refetch: refetchCalendar,
  } = useCalendarQuery(id);
  const { data: profileData } = useProfileQuery(user?.id);
  const { data: scheduledPostsData } = useScheduledPostsQuery(id);
  const updateCalendarMutation = useUpdateSavedCalendarMutation(id);
  const updateProfileMutation = useProfileUpdateMutation(user?.id);

  // 3.3 Brand slots — resolve which brand identity (forbidden phrases, proof
  // points, CTA preferences, preferred structures) applies to this calendar.
  // Falls back through: calendar's own brand_slot_id -> account default slot
  // -> first slot -> null (no brand memory at all) via resolveActiveBrandSlot.
  const brandSlotsQuery = useBrandSlotsQuery(user?.id);
  const calendarBrandSlotId = (calendarData as { brand_slot_id?: string | null } | undefined)
    ?.brand_slot_id;
  const activeBrandSlot = useMemo(
    () => resolveActiveBrandSlot(brandSlotsQuery.data, calendarBrandSlotId),
    [brandSlotsQuery.data, calendarBrandSlotId]
  );

  const [trends, setTrends] = useState<any[]>([]);
  const [generatingTopic, setGeneratingTopic] = useState<string | null>(null);
  const generateSinglePostMutation = useGenerateSinglePostMutation();

  // 2.1 Persistent idea backlog — saved ideas surfaced as fill candidates here.
  const backlogQuery = useIdeaBacklogQuery(user?.id);
  const markIdeaUsedMutation = useMarkIdeaUsedMutation(user?.id);
  const removeIdeaFromBacklogMutation = useRemoveIdeaFromBacklogMutation(user?.id);
  const [removingBacklogId, setRemovingBacklogId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("trends" as any)
          .select("keyword, category, volume")
          .order("volume", { ascending: false });
        if (!cancelled && !error && data) {
          setTrends(data);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const missingTopics = useMemo(() => {
    if (!formPayload?.topics || !posts.length) return [];
    
    const gaps = formPayload.topics.filter(
      (t: string) =>
        t &&
        !posts.some(
          (p) => p.topic && p.topic.trim().toLowerCase() === t.trim().toLowerCase()
        )
    );

    const mapped = gaps.map((topic) => {
      const match = trends.find(
        (tr) =>
          tr.keyword?.toLowerCase().includes(topic.toLowerCase()) ||
          topic.toLowerCase().includes(tr.keyword?.toLowerCase()) ||
          tr.category?.toLowerCase().includes(topic.toLowerCase())
      );
      return {
        topic,
        isTrending: !!match,
        volume: match?.volume || 0,
      };
    });

    return mapped.sort((a, b) => {
      if (a.isTrending && !b.isTrending) return -1;
      if (!a.isTrending && b.isTrending) return 1;
      return b.volume - a.volume;
    });
  }, [formPayload?.topics, posts, trends]);

  const handleGenerateForMissingTheme = useCallback(
    async (topic: string, coreIdeaOverride?: string) => {
      if (!id || generatingTopic) return;
      setGeneratingTopic(topic);
      const toastId = toast.loading(`Generating draft for: ${topic}...`);
      try {
        const existingDays = new Set(posts.map((p) => p.day));
        let nextDay = 1;
        while (existingDays.has(nextDay)) {
          nextDay++;
        }

        const dows = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const nextDow = dows[(nextDay - 1) % 7];

        const payload = {
          platform: platform || "LinkedIn",
          topic,
          format: "Balanced mix",
          coreIdea: coreIdeaOverride || calendarData?.core_idea || "",
          dow: nextDow,
          day: nextDay,
          quality: (calendarData?.form_payload as any)?.quality || "polished",
          extra: "",
        };

        const newPost = await generateSinglePostMutation.mutateAsync(payload);
        if (newPost) {
          const updated = [...posts, newPost];
          await updateCalendarMutation.mutateAsync({ posts: updated as any });
          setPosts(updated);
          toast.success(`Successfully generated post for theme: ${topic} ✓`, { id: toastId });
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to generate post for theme.", { id: toastId });
      } finally {
        setGeneratingTopic(null);
      }
    },
    [id, posts, platform, calendarData, generateSinglePostMutation, updateCalendarMutation, generatingTopic]
  );

  const handleDraftBacklogIdea = useCallback(
    (item: { id: string; angle: string; key_points: string | null }) => {
      // Mark used immediately (optimistic, fire-and-forget) so a double-click
      // can't double-draft the same idea — mirrors this file's convention of
      // updating state immediately before awaiting async work (see toggleFavorite).
      markIdeaUsedMutation.mutate(item.id);
      void handleGenerateForMissingTheme(item.angle, item.key_points || item.angle);
    },
    [markIdeaUsedMutation, handleGenerateForMissingTheme]
  );

  const handleRemoveBacklogIdea = useCallback(
    (ideaId: string) => {
      setRemovingBacklogId(ideaId);
      removeIdeaFromBacklogMutation.mutate(ideaId, {
        onSettled: () => {
          setRemovingBacklogId((prev) => (prev === ideaId ? null : prev));
        },
      });
    },
    [removeIdeaFromBacklogMutation]
  );

  const handleTweakClickOutside = useCallback((e: MouseEvent) => {
    if (tweakRef.current && !tweakRef.current.contains(e.target as Node)) setTweakOpen(false);
  }, []);

  const handleCopyMenuClickOutside = useCallback((e: MouseEvent) => {
    if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node))
      setCopyMenuOpen(false);
  }, []);

  const handleRepurposeClickOutside = useCallback((e: MouseEvent) => {
    if (repurposeRef.current && !repurposeRef.current.contains(e.target as Node))
      setRepurposeOpen(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (posts.length <= 1) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActive((i) => (i + 1) % posts.length);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActive((i) => (i - 1 + posts.length) % posts.length);
      }
    },
    [posts.length]
  );

  useEffect(() => {
    if (!tweakOpen) return;
    document.addEventListener("mousedown", handleTweakClickOutside);
    return () => document.removeEventListener("mousedown", handleTweakClickOutside);
  }, [tweakOpen, handleTweakClickOutside]);

  useEffect(() => {
    if (!copyMenuOpen) return;
    document.addEventListener("mousedown", handleCopyMenuClickOutside);
    return () => document.removeEventListener("mousedown", handleCopyMenuClickOutside);
  }, [copyMenuOpen, handleCopyMenuClickOutside]);

  useEffect(() => {
    if (!repurposeOpen) return;
    document.addEventListener("mousedown", handleRepurposeClickOutside);
    return () => document.removeEventListener("mousedown", handleRepurposeClickOutside);
  }, [repurposeOpen, handleRepurposeClickOutside]);

  // Keyboard shortcuts: arrow keys navigate between days
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function toggleLock(day: number) {
    setLockedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  async function reformatAllForPlatform(targetPlatform: string) {
    if (!targetPlatform || targetPlatform === platform || reformatting || regenerating) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in required");
      return;
    }
    setReformatting(true);
    try {
      const SUPABASE_URL = resolveFunctionsBaseUrl(import.meta.env.VITE_SUPABASE_URL);
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const next: Post[] = [...posts];
      for (let i = 0; i < posts.length; i++) {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/regenerate-post`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${session?.access_token || SUPABASE_KEY}`,
          },
          body: JSON.stringify({
            industry: formPayload.industry || "",
            industryLabel,
            platform: targetPlatform,
            language: formPayload.language || "English",
            coreIdea: formPayload.coreIdea || title,
            audiences: formPayload.audiences || [],
            voice: formPayload.voice || "",
            style: formPayload.style || "",
            goals: formPayload.goals || [],
            format: formPayload.format || "Balanced mix",
            cta: formPayload.cta || "Share & repost bait",
            length: formPayload.length || "medium",
            structure: formPayload.structure || "mixed",
            extra: formPayload.extra || "",
            bannedWords: formPayload.bannedWords || [],
            requiredWords: formPayload.requiredWords || [],
            brandMemory: isEnabled("brandMemory") ? buildBrandMemoryPrompt(activeBrandSlot) : "",
            post: posts[i],
            siblings: next,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (
          res.status === 402 ||
          data?.error === "QUOTA_EXCEEDED" ||
          data?.error === "UPGRADE_REQUIRED"
        ) {
          toast.error(
            data?.message || "You've reached your generation limit. Upgrade to continue.",
            {
              duration: 8000,
              action: { label: "See plans", onClick: () => navigate("/profile?tab=plan") },
            }
          );
          return;
        }
        if (res.ok && data?.post) next[i] = data.post;
      }
      const newTitle = `${title} — ${targetPlatform}`;
      const newForm = { ...formPayload, platform: targetPlatform };
      try {
        const payload = {
          user_id: user.id,
          title: newTitle,
          industry: formPayload.industry || null,
          industry_label: industryLabel || null,
          platform: targetPlatform,
          core_idea: formPayload.coreIdea || null,
          form_payload: newForm as unknown as Json,
          posts: next as unknown as Json,
          week_start_date: weekStart || null,
          post_times: postTimes,
        };
        const resp = await createCalendar.mutateAsync(payload);
        toast.success(`Reformatted for ${niceLabelFor(targetPlatform)} ✓`);
        navigate(`/calendar/${resp.id}`);
      } catch (insErr) {
        toast.error(insErr instanceof Error ? insErr.message : String(insErr));
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reformat failed");
    } finally {
      setReformatting(false);
      setReformatTarget("");
    }
  }

  // Handle calendar data loading
  useEffect(() => {
    // calendarError implies calendarData is undefined, so this must be checked
    // before the `!calendarData` guard below — otherwise it's unreachable and the
    // page is left silently stuck (see inline ErrorState in the render below for
    // the actual user-facing recovery UI; this effect no longer navigates away).
    if (calendarError || !calendarData) return;

    let cancelled = false;
    const load = async () => {
      const loadedPosts = (calendarData.posts as unknown as Post[]) || [];
      const isE2E =
        typeof window !== "undefined" && window.localStorage.getItem(getE2EAuthFlag()) === "true";
      const hydratedPosts: Post[] =
        loadedPosts.length > 0
          ? loadedPosts
          : isE2E
            ? await (async () => {
                const { generateLocalPosts } = await import("@/lib/localPostGenerator");
                return generateLocalPosts({
                  industry: (calendarData as { industry?: string | null }).industry || "",
                  industryLabel: calendarData.industry_label || "",
                  platform: calendarData.platform || "LinkedIn",
                  language:
                    (calendarData.form_payload as { language?: string } | null)?.language ||
                    "English",
                  coreIdea: calendarData.core_idea || calendarData.title || "",
                  audiences:
                    (calendarData.form_payload as { audiences?: string[] } | null)?.audiences || [],
                  voice: (calendarData.form_payload as { voice?: string } | null)?.voice || "",
                  style: (calendarData.form_payload as { style?: string } | null)?.style || "",
                  goals: (calendarData.form_payload as { goals?: string[] } | null)?.goals || [],
                  topics: (calendarData.form_payload as { topics?: string[] } | null)?.topics || [],
                  format:
                    (calendarData.form_payload as { format?: string } | null)?.format ||
                    "Balanced mix",
                  cta:
                    (calendarData.form_payload as { cta?: string } | null)?.cta ||
                    "Share & repost bait",
                  length:
                    (calendarData.form_payload as { length?: string } | null)?.length || "medium",
                  structure:
                    (calendarData.form_payload as { structure?: string } | null)?.structure ||
                    "mixed",
                  extra: (calendarData.form_payload as { extra?: string } | null)?.extra || "",
                  bannedWords:
                    (calendarData.form_payload as { bannedWords?: string[] } | null)?.bannedWords ||
                    [],
                  requiredWords:
                    (calendarData.form_payload as { requiredWords?: string[] } | null)
                      ?.requiredWords || [],
                  targetTopic:
                    (calendarData.form_payload as { topics?: string[] } | null)?.topics?.[0] ||
                    calendarData.core_idea ||
                    calendarData.title ||
                    "",
                  targetDow: "Mon",
                }) as unknown as Post[];
              })()
            : [];

      if (cancelled) return;
      setPosts(hydratedPosts);
      setTitle(calendarData.title);
      setPlatform(calendarData.platform || "");
      setIndustryLabel(calendarData.industry_label || "");
      setFormPayload((calendarData.form_payload as unknown as FormPayload) || {});
      setMeta(
        `${calendarData.industry_label || ""} · ${calendarData.platform || ""} · ${new Date(calendarData.created_at).toLocaleDateString()}`
      );
      const dx = calendarData as {
        is_favorite?: boolean;
        timezone?: string | null;
        tracking_url?: string | null;
        locked_hashtags?: Record<string, string[]> | null;
      };
      setIsFavorite(!!dx.is_favorite);
      setTrackingUrl(dx.tracking_url || "");
      setLockedHashtags(dx.locked_hashtags || {});
      const fp = calendarData.form_payload as { weekStart?: string } | null;
      const ws =
        (calendarData as { week_start_date?: string | null }).week_start_date ||
        fp?.weekStart ||
        toDateInputValue(nextMonday());
      setWeekStart(ws);
      const storedTimes = (calendarData as { post_times?: Record<string, string> | null })
        .post_times;
      if (storedTimes && typeof storedTimes === "object") {
        setPostTimes(storedTimes);
      } else {
        const seed: Record<string, string> = {};
        for (const p of hydratedPosts)
          seed[String(p.day)] = suggestedTimeForDay(Number(p.day) || 1, platform);
        setPostTimes(seed);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [calendarData, calendarError, navigate]);

  // Handle profile data loading
  useEffect(() => {
    if (!profileData) return;
    const profTz = profileData.default_timezone || browserTimezone();
    setProfileTimezone(profTz);
    setProfilePolicy({
      banned: parsePolicyList(profileData.banned_hashtags),
      required: parsePolicyList(profileData.required_hashtags),
    });
  }, [profileData]);

  // Handle scheduled posts status loading
  useEffect(() => {
    if (!scheduledPostsData) return;
    const statusMap: Record<number, "drafted" | "approved" | "published" | "failed"> = {};
    for (const r of scheduledPostsData) {
      statusMap[r.post_day] = r.workflow_status;
    }
    setStatusByDay(statusMap);
  }, [scheduledPostsData]);

  // Set timezone when both calendar and profile data are loaded
  useEffect(() => {
    if (!calendarData || !profileData) return;
    const dx = calendarData as { timezone?: string | null };
    const profTz = profileData.default_timezone || browserTimezone();
    setTimezone(dx.timezone || profTz);
  }, [calendarData, profileData]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsE2EModeActive(window.localStorage.getItem(getE2EAuthFlag()) === "true");
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("saved_calendars")
        .select("id, posts")
        .order("created_at", { ascending: false })
        .limit(25);
      if (cancelled || error) return;
      const snippets: string[] = [];
      for (const calendar of data || []) {
        if (calendar.id === id) continue;
        const postList = Array.isArray(calendar.posts) ? calendar.posts : [];
        for (const item of postList) {
          if (!item || typeof item !== "object") continue;
          const post = item as Partial<Post>;
          snippets.push([post.title, post.hook, post.body, post.cta].filter(Boolean).join(" "));
        }
      }
      setPastPostText(snippets.filter(Boolean));
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user?.id]);

  // Set loading state based on queries
  useEffect(() => {
    setLoading(calendarLoading);
  }, [calendarLoading]);

  function startEdit() {
    setDraft({ ...posts[active] });
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  async function saveEdit() {
    if (!draft || !id) return;
    setSaving(true);

    // Feature 5: Track edit history per field before saving
    const currentPost = posts[active];
    const day = currentPost.day;
    const newHistory = { ...fieldHistory };
    if (!newHistory[day]) newHistory[day] = {};

    const fieldsToTrack = [
      "title",
      "hook",
      "body",
      "cta",
      "hashtags",
      "rationale",
      "image_prompt",
    ] as const;
    let changed = false;
    fieldsToTrack.forEach((f) => {
      const oldVal = currentPost[f] || "";
      const newVal = draft[f] || "";
      if (oldVal !== newVal) {
        if (!newHistory[day][f]) newHistory[day][f] = [];
        newHistory[day][f].push(String(oldVal));
        changed = true;
      }
    });
    if (changed) {
      setFieldHistory(newHistory);
    }

    const updated = posts.map((p, i) => (i === active ? draft : p));
    // Phase 2.3 — snapshot before persisting
    if (id) saveSnapshot(id, updated, "Auto-save");
    try {
      await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
    } catch (error) {
      setSaving(false);
      return toast.error(error instanceof Error ? error.message : "Save failed");
    }
    setSaving(false);
    setPosts(updated);
    setEditing(false);
    setDraft(null);
    toast.success("Post updated");
  }

  const undoField = useCallback(
    (field: string) => {
      if (!draft) return;
      const day = draft.day;
      const stack = fieldHistory[day]?.[field];
      if (!stack || stack.length === 0) return;
      const nextStack = [...stack];
      const poppedValue = nextStack.pop()!;

      setDraft((prev) => (prev ? { ...prev, [field]: poppedValue } : null));

      setFieldHistory((prev) => ({
        ...prev,
        [day]: {
          ...prev[day],
          [field]: nextStack,
        },
      }));
      toast.success(`Restored last version of ${field} ✓`);
    },
    [draft, fieldHistory]
  );

  async function applyImageToPost(day: number, imageUrl: string) {
    const updated = posts.map((p) => {
      if (p.day === day) {
        return {
          ...p,
          image_url: imageUrl || undefined,
        };
      }
      return p;
    });
    setPosts(updated);
    if (id) {
      try {
        await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
        toast.success(imageUrl ? "Image URL applied ✓" : "Image removed ✓");
      } catch (e) {
        toast.error("Failed to save updated visual to cloud");
      }
    }
  }

  async function selectHookVariant(day: number, variant: string) {
    const previous = posts;
    const updated = previous.map((p) => (p.day === day ? { ...p, hook: variant } : p));
    setPosts(updated);
    setVariantSaving({ day, field: "hook" });
    try {
      await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
      toast.success("Hook variant saved");
    } catch (error) {
      setPosts(previous);
      toast.error(error instanceof Error ? error.message : "Failed to save hook variant");
    } finally {
      setVariantSaving((prev) => (prev?.day === day && prev?.field === "hook" ? null : prev));
    }
  }

  async function selectCtaVariant(day: number, variant: string) {
    const previous = posts;
    const updated = previous.map((p) => (p.day === day ? { ...p, cta: variant } : p));
    setPosts(updated);
    setVariantSaving({ day, field: "cta" });
    try {
      await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
      toast.success("CTA variant saved");
    } catch (error) {
      setPosts(previous);
      toast.error(error instanceof Error ? error.message : "Failed to save CTA variant");
    } finally {
      setVariantSaving((prev) => (prev?.day === day && prev?.field === "cta" ? null : prev));
    }
  }

  async function regenerateDay(
    tweak?: TweakKind,
    feedback?: string,
    category?: string,
    rating?: number,
    focusMetric?: PerformanceFocusMetric,
    guidance?: string
  ) {
    const log = createScopedLogger("CalendarDetail-RegenerateDay");
    if (!id || regenerating || editing) return;
    const target = posts[active];
    if (!target) return;
    setRegenerating(true);
    setTweakOpen(false);
    try {
      if (tweak === "clean-formatting") {
        const cleaned: Post = {
          ...target,
          title: stripMarkdown(target.title),
          hook: stripMarkdown(target.hook),
          body: stripMarkdown(target.body),
          cta: stripMarkdown(target.cta),
        };
        const updated = posts.map((p, i) => (i === active ? cleaned : p));
        try {
          await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
        } catch (cleanErr) {
          log.error(`Failed to save cleaned post`, cleanErr, { calendarId: id, day: target.day });
          toast.error(cleanErr instanceof Error ? cleanErr.message : "Failed to save cleaned post");
          return;
        }
        setPosts(updated);
        toast.success(`Day ${target.day} formatting cleaned ✓`);
        return;
      }
      const payload = {
        industry: formPayload.industry || "",
        industryLabel,
        platform: platform || formPayload.platform || "LinkedIn",
        language: formPayload.language || "English",
        coreIdea: formPayload.coreIdea || title,
        audiences: formPayload.audiences || [],
        voice: formPayload.voice || "",
        style: formPayload.style || "",
        goals: formPayload.goals || [],
        format: formPayload.format || "Balanced mix",
        cta: formPayload.cta || "Share & repost bait",
        length: formPayload.length || "medium",
        structure: formPayload.structure || "mixed",
        extra: formPayload.extra || "",
        bannedWords: formPayload.bannedWords || [],
        requiredWords: formPayload.requiredWords || [],
        brandMemory: isEnabled("brandMemory") ? buildBrandMemoryPrompt(activeBrandSlot) : "",
        post: target,
        siblings: posts,
        tweak,
        feedback,
        feedbackCategory: category,
        feedbackRating: rating,
        calendarId: id,
        ...(tweak === "enhance"
          ? {
              focusMetric:
                focusMetric ||
                getWeakestPerformanceMetric(
                  calculatePerformanceScore(target, formPayload.coreIdea || title)
                ),
            }
          : {}),
        ...(focusMetric ? { focusMetric } : {}),
        ...(guidance ? { guidance } : {}),
      };
      let data: unknown = {};
      try {
        data = await regenerateMutation.mutateAsync(payload);
      } catch (e) {
        log.warn(`Regenerate failed for day ${target.day}`, e, { day: target.day, tweak });
        toast.error(e instanceof Error ? e.message : String(e));
        return;
      }
      if (!data) {
        toast.error("Regenerate failed: no data returned");
        return;
      }
      const regeneratedPost = unwrapPost(data);
      if (!regeneratedPost) {
        toast.error("Regenerate failed: no post returned");
        return;
      }

      // 3.2 telemetry: if a previous generated-but-unsaved variant existed for this
      // slot, the new generation supersedes it before it was ever saved.
      const priorSlot = slotVariantRef.current[target.day];
      if (priorSlot && !priorSlot.saved) {
        void sendEvent("post_regenerated_again", {
          platform: platform || formPayload.platform || "LinkedIn",
          source: priorSlot.source,
        });
      }
      slotVariantRef.current[target.day] = { source: "regenerate", saved: false };

      const updated = posts.map((p, i) => (i === active ? regeneratedPost : p));
      try {
        await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
      } catch (updErr) {
        log.error(`Failed to save updated post`, updErr, { calendarId: id, day: target.day });
        toast.error(updErr instanceof Error ? updErr.message : "Failed to save updated post");
        return;
      }
      slotVariantRef.current[target.day] = { source: "regenerate", saved: true };
      void sendEvent("post_kept", {
        platform: platform || formPayload.platform || "LinkedIn",
        source: "regenerate",
      });
      setPosts(updated);
      const tweakLabel = tweak ? ` (${tweak.replace("-", " ")})` : "";
      log.info(`Day ${target.day} regenerated successfully`, { day: target.day, tweak });
      toast.success(`Day ${target.day} regenerated${tweakLabel}`);
    } catch (e) {
      log.error(`Regenerate exception`, e, { day: target.day, tweak });
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegenerating(false);
    }
  }

  const handleToneShift = useCallback(
    (level: number) => {
      const toneLabel =
        level === 1
          ? "very-formal"
          : level === 2
            ? "formal"
            : level === 4
              ? "casual"
              : "very-casual";
      void regenerateDay(`tone-${toneLabel}` as any);
    },
    [regenerateDay]
  );

  async function repurposeTo(targetPlatform: string) {
    const log = createScopedLogger("CalendarDetail-Repurpose");
    if (repurposing) return;
    const sourcePost = posts[active];
    if (!sourcePost) return;

    setRepurposing(true);
    setRepurposeOpen(false);
    try {
      const result = await repurposeOnePost(sourcePost, targetPlatform, {
        calendarId: id,
        platform: platform || formPayload.platform || "LinkedIn",
        formPayload,
        repurposeMutateAsync: (payload) => repurposeMutation.mutateAsync(payload),
        generateImageMutateAsync: (payload) => generateImageMutation.mutateAsync(payload),
        onStageChange: setRepurposeStage,
        onImageError: (imgErr) => {
          // Image generation is an enhancement, not a blocker — surface a soft warning only.
          log.error("Repurpose image generation failed", imgErr);
          toast.message(
            "Repurposed text is ready. Visual generation failed — you can retry it after saving."
          );
        },
      });

      if (result.error) {
        log.error("Repurpose failed", new Error(result.error));
        toast.error(result.error);
        return;
      }
      if (result.post) {
        // 3.2 telemetry: repurposing this slot again before the previous repurposed
        // (or regenerated) variant was ever saved supersedes it.
        const priorSlot = slotVariantRef.current[sourcePost.day];
        if (priorSlot && !priorSlot.saved) {
          void sendEvent("post_regenerated_again", {
            platform: targetPlatform,
            source: priorSlot.source,
          });
        }
        slotVariantRef.current[sourcePost.day] = { source: "repurpose", saved: false };
        setRepurposedPost(result.post);
        setRepurposedTarget(targetPlatform);
      }
    } catch (e) {
      log.error("Repurpose failed", e);
      toast.error(e instanceof Error ? e.message : "Repurpose failed");
    } finally {
      setRepurposing(false);
      setRepurposeStage("");
    }
  }

  async function saveRepurposedPost() {
    if (!repurposedPost || !id) return;
    const previous = posts;
    const day = posts[active]?.day ?? repurposedPost.day;
    const updated = posts.map((post, index) => (index === active ? repurposedPost : post));
    setPosts(updated);
    try {
      await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
      slotVariantRef.current[day] = { source: "repurpose", saved: true };
      void sendEvent("post_kept", {
        platform: repurposedTarget || platform || formPayload.platform || "LinkedIn",
        source: "repurpose",
      });
      setRepurposedPost(null);
      setRepurposedTarget("");
      toast.success("Repurposed version saved");
    } catch (error) {
      setPosts(previous);
      toast.error(error instanceof Error ? error.message : "Failed to save repurposed version");
    }
  }

  function startBulkRepurpose(selectedDays: number[], targetPlatform: string) {
    const selected = posts
      .filter((p) => selectedDays.includes(p.day))
      .map((p) => ({ day: p.day, dow: p.dow, sourcePost: p }));
    if (selected.length === 0) return;
    bulkRepurposeTargetRef.current = targetPlatform;
    setBulkRepurposeModalOpen(false);
    void sendEvent("repurpose_bulk_start", {
      calendarId: id,
      targetPlatform,
      count: selected.length,
    });
    bulkRepurpose.start(selected, targetPlatform);
  }

  async function saveBulkRepurposeResults() {
    if (!id) return;
    const includedCount = bulkRepurpose.items.filter(
      (it) => it.status === "success" && it.included
    ).length;
    if (includedCount === 0) return;
    setBulkRepurposeSaving(true);
    try {
      const merged = mergeRepurposedResults(posts, bulkRepurpose.items);
      await updateCalendarMutation.mutateAsync({ posts: merged as unknown as never });
      setPosts(merged);
      void sendEvent("repurpose_bulk_review_saved", {
        calendarId: id,
        targetPlatform: bulkRepurposeTargetRef.current,
        count: includedCount,
      });
      toast.success(`Saved ${includedCount} repurposed post${includedCount === 1 ? "" : "s"} ✓`);
      bulkRepurpose.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save repurposed posts");
    } finally {
      setBulkRepurposeSaving(false);
    }
  }

  function closeBulkRepurposePanel() {
    if (bulkRepurpose.items.length > 0 && bulkRepurpose.settled) {
      void sendEvent("repurpose_bulk_review_discarded", {
        calendarId: id,
        targetPlatform: bulkRepurposeTargetRef.current,
        count: bulkRepurpose.items.length,
      });
    }
    bulkRepurpose.reset();
  }

  async function generateVisualForPost(post: Post) {
    if (!id || imageGeneratingDay) return;
    const prompt = (post.image_prompt || "").trim();
    if (!prompt) {
      toast.error("Add an image prompt before generating a visual");
      return;
    }

    const aspectRatio = aspectRatioForPlatform(platform);
    setImageGeneratingDay(post.day);
    try {
      const result = await generateImageMutation.mutateAsync({
        calendarId: id,
        postDay: post.day,
        post,
        prompt,
        platform: platform || formPayload.platform || "LinkedIn",
        aspectRatio,
      });
      const updatedPost: Post = {
        ...post,
        image_url: String(result.publicUrl || ""),
        image_storage_path: String(result.storagePath || ""),
        image_aspect_ratio: String(result.aspectRatio || aspectRatio),
        image_generated_at: String(result.generatedAt || new Date().toISOString()),
      };
      if (!updatedPost.image_url) throw new Error("Image generation returned no URL");
      const updated = posts.map((p) => (p.day === post.day ? updatedPost : p));
      setPosts(updated);
      await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
      toast.success("Visual generated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Image generation failed");
    } finally {
      setImageGeneratingDay(null);
    }
  }

  function rememberInlineSelection(field: "hook" | "body" | "cta", target: HTMLTextAreaElement) {
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const text = target.value.slice(start, end).trim();
    setInlineSelection(text ? { field, start, end, text } : null);
  }

  async function rewriteInlineSelection(
    instruction: "punchier" | "add-stat" | "question" | "simpler"
  ) {
    if (!draft || !inlineSelection) {
      toast.error("Select text in the hook, body, or CTA first");
      return;
    }
    if (inlineRewriting) return;

    setInlineRewriting(true);
    try {
      const rewritten = await inlineRewriteMutation.mutateAsync({
        text: inlineSelection.text,
        instruction,
        field: inlineSelection.field,
        platform: platform || formPayload.platform || "LinkedIn",
        post: draft,
        context: {
          industry: formPayload.industry || "",
          voice: formPayload.voice || "",
          goals: formPayload.goals || [],
        },
      });
      if (!rewritten.trim()) throw new Error("Rewrite returned empty text");
      const original = String(draft[inlineSelection.field] || "");
      const nextValue = `${original.slice(0, inlineSelection.start)}${rewritten}${original.slice(inlineSelection.end)}`;
      setDraft({ ...draft, [inlineSelection.field]: nextValue });
      setInlineSelection(null);
      toast.success("Selection rewritten");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rewrite failed");
    } finally {
      setInlineRewriting(false);
    }
  }

  async function updatePostTime(day: number, time: string) {
    const next = { ...postTimes, [String(day)]: time };
    setPostTimes(next);
    if (!id) return;
    try {
      await updateCalendarMutation.mutateAsync({ post_times: next as never });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update post time");
    }
  }

  async function updateWeekStart(value: string) {
    setWeekStart(value);
    if (!id) return;
    try {
      await updateCalendarMutation.mutateAsync({ week_start_date: value || null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update week start");
    }
  }

  async function toggleFavorite() {
    if (!id) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await updateCalendarMutation.mutateAsync({ is_favorite: next });
    } catch (error) {
      setIsFavorite(!next);
      toast.error(error instanceof Error ? error.message : "Failed to update favorite");
    }
  }

  async function updateTimezone(tz: string) {
    setTimezone(tz);
    if (!id) return;
    try {
      await updateCalendarMutation.mutateAsync({ timezone: tz || null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update timezone");
    }
  }

  async function updateBrandSlot(nextSlotId: string) {
    if (!id) return;
    try {
      await updateCalendarMutation.mutateAsync({ brand_slot_id: nextSlotId || null } as never);
      toast.success(nextSlotId ? "Brand voice updated ✓" : "Reverted to account default brand ✓");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update brand voice");
    }
  }

  async function updateTrackingUrl(url: string) {
    setTrackingUrl(url);
    if (!id) return;
    try {
      await updateCalendarMutation.mutateAsync({ tracking_url: url || null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update tracking URL");
    }
  }

  async function persistLockedHashtags(next: Record<string, string[]>) {
    setLockedHashtags(next);
    if (!id) return;
    try {
      await updateCalendarMutation.mutateAsync({ locked_hashtags: next as never });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update hashtag locks");
    }
  }

  async function persistPostHashtags(day: number, newHashtags: string) {
    if (!id) return;
    const updated = posts.map((po) => (po.day === day ? { ...po, hashtags: newHashtags } : po));
    setPosts(updated);
    try {
      await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update hashtags");
    }
  }

  // Re-render a post's hashtag string by applying workspace policy + this post's locks.
  function rebuildHashtagsForDay(
    day: number,
    currentTags: string[],
    lockedForDay: string[]
  ): string {
    return applyPolicy(currentTags.join(" "), platform, profilePolicy, lockedForDay);
  }

  async function lockTagOnPost(day: number, tag: string) {
    const norm = normalizeTag(tag);
    if (!norm) return;
    const cur = lockedHashtags[String(day)] || [];
    if (cur.includes(norm)) return;
    const nextLocks = { ...lockedHashtags, [String(day)]: [...cur, norm] };
    await persistLockedHashtags(nextLocks);
    toast.success(`#${norm} pinned for Day ${day}`);
  }

  async function unlockTagOnPost(day: number, tag: string) {
    const norm = normalizeTag(tag);
    const cur = lockedHashtags[String(day)] || [];
    if (!cur.includes(norm)) return;
    const nextLocks = { ...lockedHashtags, [String(day)]: cur.filter((t) => t !== norm) };
    if (nextLocks[String(day)].length === 0) delete nextLocks[String(day)];
    await persistLockedHashtags(nextLocks);
    toast.success(`#${norm} unpinned`);
  }

  function banTagWorkspaceWide(day: number, tag: string) {
    const norm = normalizeTag(tag);
    if (!norm) return;
    setPendingBanTag({ day, tag: norm });
  }

  async function commitBanTagWorkspaceWide(day: number, norm: string) {
    // 1) Add to workspace banned list
    const nextBanned = profilePolicy.banned.includes(norm)
      ? profilePolicy.banned
      : [...profilePolicy.banned, norm];
    setProfilePolicy({ ...profilePolicy, banned: nextBanned });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      try {
        await updateProfileMutation.mutateAsync({ banned_hashtags: nextBanned });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update hashtag policy");
      }
    }
    // 2) Strip the tag from this post immediately + unlock it if locked
    const cur = lockedHashtags[String(day)] || [];
    if (cur.includes(norm)) {
      const nextLocks = { ...lockedHashtags, [String(day)]: cur.filter((t) => t !== norm) };
      if (nextLocks[String(day)].length === 0) delete nextLocks[String(day)];
      await persistLockedHashtags(nextLocks);
    }
    const post = posts.find((po) => po.day === day);
    if (post) {
      const tagsNow = parseHashtagsString(post.hashtags).filter((t) => t !== norm);
      const newStr = rebuildHashtagsForDay(
        day,
        tagsNow,
        (lockedHashtags[String(day)] || []).filter((t) => t !== norm)
      );
      await persistPostHashtags(day, newStr);
    }
    toast.success(`#${norm} banned workspace-wide ✓`);
    setTagPopover(null);
  }

  async function replaceTagOnPost(day: number, oldTag: string, replacementRaw: string) {
    const oldNorm = normalizeTag(oldTag);
    const newNorm = normalizeTag(replacementRaw);
    if (!oldNorm || !newNorm) return toast.error("Enter a valid replacement tag");
    if (oldNorm === newNorm) return setTagPopover(null);
    const post = posts.find((po) => po.day === day);
    if (!post) return;
    const tagsNow = parseHashtagsString(post.hashtags);
    const idx = tagsNow.indexOf(oldNorm);
    if (idx === -1) return;
    tagsNow[idx] = newNorm;
    // Update locks too if old was locked
    const cur = lockedHashtags[String(day)] || [];
    let nextLocks = lockedHashtags;
    if (cur.includes(oldNorm)) {
      nextLocks = {
        ...lockedHashtags,
        [String(day)]: cur.map((t) => (t === oldNorm ? newNorm : t)),
      };
      await persistLockedHashtags(nextLocks);
    }
    const newStr = rebuildHashtagsForDay(day, tagsNow, nextLocks[String(day)] || []);
    await persistPostHashtags(day, newStr);
    toast.success(`#${oldNorm} → #${newNorm}`);
    setTagPopover(null);
    setTagReplacement("");
  }

  function exportIcs() {
    const ws = parseLocalDate(weekStart) || nextMonday();
    const tz = timezone || profileTimezone || browserTimezone();
    downloadIcs({ calendarTitle: title, weekStart: ws, postTimes, platform, timezone: tz }, posts);
  }

  async function handleExport(format: "md" | "pdf" | "ics") {
    if (exportingFormat) return;
    setExportingFormat(format);
    try {
      if (format === "md") {
        const { downloadMd } = await import("@/lib/exportCalendar");
        downloadMd({ title, industryLabel, platform, coreIdea: formPayload.coreIdea }, posts);
      } else if (format === "pdf") {
        const { downloadPdf } = await import("@/lib/exportCalendar");
        downloadPdf({ title, industryLabel, platform, coreIdea: formPayload.coreIdea }, posts);
      } else {
        const ws = parseLocalDate(weekStart) || nextMonday();
        const tz = timezone || profileTimezone || browserTimezone();
        downloadIcs(
          { calendarTitle: title, weekStart: ws, postTimes, platform, timezone: tz },
          posts
        );
      }
      toast.success(`Downloaded .${format} ✓`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Download .${format} failed`);
    } finally {
      setExportingFormat(null);
    }
  }

  function regenerateAllUnlocked() {
    if (!id || regenerating || bulkRegenerating || editing) return;
    const targets = posts.map((p, i) => ({ p, i })).filter(({ p }) => !lockedDays.has(p.day));
    if (targets.length === 0) {
      toast.error("All posts are pinned. Nothing to regenerate.");
      return;
    }
    setPendingBulkRegenerate({ count: targets.length });
  }

  async function commitRegenerateAllUnlocked() {
    const log = createScopedLogger("CalendarDetail-BulkRegenerate");
    const targets = posts.map((p, i) => ({ p, i })).filter(({ p }) => !lockedDays.has(p.day));
    setBulkRegenerating(true);
    setBulkProgress({ done: 0, total: targets.length });
    try {
      log.info(`Starting bulk regenerate`, { count: targets.length, platform, calendarId: id });
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const next: Post[] = [...posts];
      let done = 0;
      const failures: { day: number; reason: string }[] = [];

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      async function runOne({ p: target, i }: { p: Post; i: number }) {
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const payload = {
              industry: formPayload.industry || "",
              industryLabel,
              platform: platform || formPayload.platform || "LinkedIn",
              coreIdea: formPayload.coreIdea || title,
              audiences: formPayload.audiences || [],
              voice: formPayload.voice || "",
              style: formPayload.style || "",
              goals: formPayload.goals || [],
              format: formPayload.format || "Balanced mix",
              cta: formPayload.cta || "Share & repost bait",
              length: formPayload.length || "medium",
              structure: formPayload.structure || "mixed",
              extra: formPayload.extra || "",
              bannedWords: formPayload.bannedWords || [],
              requiredWords: formPayload.requiredWords || [],
              post: target,
              siblings: next,
            };
            const newPost = unwrapPost(await regenerateMutation.mutateAsync(payload));
            if (!newPost) throw new Error("Regenerate failed: no post returned");
            next[i] = newPost;
            return;
          } catch (e) {
            if (attempt < maxAttempts) {
              await sleep(400 * Math.pow(2, attempt - 1));
              continue;
            }
            failures.push({ day: target.day, reason: e instanceof Error ? e.message : String(e) });
            return;
          }
        }
      }

      // Concurrency = 2 worker pool
      const queue = [...targets];
      async function worker() {
        while (queue.length) {
          const job = queue.shift();
          if (!job) return;
          await runOne(job);
          done += 1;
          setBulkProgress({ done, total: targets.length });
          setPosts([...next]);
        }
      }
      await Promise.all([worker(), worker()]);

      try {
        await updateCalendarMutation.mutateAsync({ posts: next as unknown as never });
      } catch (updErr) {
        toast.error(updErr instanceof Error ? updErr.message : "Failed to save reordered posts");
        return;
      }

      const okCount = targets.length - failures.length;
      if (failures.length === 0) {
        log.info(`Bulk regenerate completed successfully`, { count: okCount, calendarId: id });
        toast.success(`Regenerated ${okCount} post${okCount === 1 ? "" : "s"} ✓`);
      } else if (okCount === 0) {
        log.warn(`All bulk regenerations failed`, new Error(failures[0].reason), {
          totalCount: targets.length,
          failureReasons: failures,
        });
        toast.error(`All ${failures.length} regenerations failed. ${failures[0].reason}`);
      } else {
        log.warn(
          `Partial bulk regenerate failure`,
          new Error(`${failures.length} of ${targets.length} failed`),
          { okCount, failureCount: failures.length, failedDays: failures.map((f) => f.day) }
        );
        toast.warning(
          `${okCount} regenerated, ${failures.length} failed (days ${failures.map((f) => f.day).join(", ")})`
        );
      }
    } catch (e) {
      log.error(`Bulk regenerate exception`, e, { calendarId: id });
      toast.error(e instanceof Error ? e.message : "Bulk regenerate failed");
    } finally {
      setBulkRegenerating(false);
      setBulkProgress(null);
    }
  }

  async function scheduleWeek() {
    if (!id || scheduling) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in required");
      return;
    }
    setScheduling(true);
    try {
      const ws = parseLocalDate(weekStart) || nextMonday();
      const tz = timezone || profileTimezone || browserTimezone();
      const rows = posts.map((post) => {
        const d = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + (post.day - 1));
        const dateStr = toDateInputValue(d);
        const time = postTimes[String(post.day)] || suggestedTimeForDay(post.day, platform);
        const f = formatForPlatform(post, platform);
        return {
          user_id: user.id,
          calendar_id: id,
          post_day: post.day,
          platform: platform || null,
          scheduled_at: zonedToUtcIso(dateStr, time, tz),
          status: "scheduled",
          workflow_status: "drafted",
          copy_text: f.text,
          post_snapshot: post as unknown as never,
        };
      });

      // Check for posts already scheduled at the same platform+time from a different
      // calendar — the upsert below is only idempotent on (calendar_id, post_day), so
      // without this check two unrelated posts could silently double-book a slot.
      const scheduledTimes = rows.map((r) => r.scheduled_at);
      const { data: conflicts } = await supabase
        .from("scheduled_posts")
        .select("id")
        .eq("user_id", user.id)
        .eq("platform", platform || "")
        .neq("calendar_id", id)
        .in("scheduled_at", scheduledTimes);
      if (conflicts && conflicts.length > 0) {
        setPendingScheduleConflict({ rows, count: conflicts.length });
        return;
      }

      await commitScheduleWeek(rows, tz);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not schedule");
    } finally {
      setScheduling(false);
    }
  }

  async function commitScheduleWeek(rows: Record<string, unknown>[], tz: string) {
    try {
      // Idempotent upsert keyed on (calendar_id, post_day) — preserves existing rows on partial failure
      const { error } = await supabase
        .from("scheduled_posts")
        .upsert(rows as never, { onConflict: "calendar_id,post_day" });
      if (error) {
        toast.error(error.message);
        return;
      }
      const newStatus: typeof statusByDay = {};
      for (const p of posts) newStatus[p.day] = "drafted";
      setStatusByDay(newStatus);
      toast.success(`Scheduled ${rows.length} posts in ${tz} ✓`);
      setScheduleOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not schedule");
    } finally {
      setScheduling(false);
    }
  }

  const weekStartDate = useMemo(() => parseLocalDate(weekStart) || nextMonday(), [weekStart]);

  const p = posts[active] ?? EMPTY_POST;

  const activeDate = useMemo(() => {
    if (!p) return null;
    return new Date(
      weekStartDate.getFullYear(),
      weekStartDate.getMonth(),
      weekStartDate.getDate() + (p.day - 1)
    );
  }, [weekStartDate, p]);

  const activeDowName = useMemo(() => {
    if (!activeDate) return "—";
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][activeDate.getDay()];
  }, [activeDate]);
  const bodyWords = useMemo(() => wordCount(draft?.body || ""), [draft?.body]);
  const hookWords = useMemo(() => wordCount(draft?.hook || ""), [draft?.hook]);
  const titleChars = (draft?.title || "").length;
  const ctaChars = (draft?.cta || "").length;
  const draftReadability = useMemo(() => readingStats(draft?.body || ""), [draft?.body]);
  const repeatWarning = useMemo(
    () => repeatedPhraseWarning(draft?.body || "", pastPostText),
    [draft?.body, pastPostText]
  );
  const lengthTarget = formPayload.length;
  const targetHint =
    lengthTarget === "short"
      ? "target 80–120"
      : lengthTarget === "long"
        ? "target 280–380"
        : lengthTarget === "mixed"
          ? "varies (80–380)"
          : "target 160–230";

  // K4 — calendar analytics (client-computed, no backend)
  const analytics = useMemo(() => {
    if (!posts.length) return null;
    let totalChars = 0;
    let totalHashtags = 0;
    let withinLimit = 0;
    const formats = new Map<string, number>();
    for (const post of posts) {
      const f = formatForPlatform(post, platform);
      totalChars += f.charCount;
      if (f.charCount <= f.limit) withinLimit += 1;
      const tagCount = String(post.hashtags || "")
        .split(/[\s,]+/)
        .filter((t) => t.trim().length > 1).length;
      totalHashtags += tagCount;
      const fmt = (post.format || "—").trim();
      formats.set(fmt, (formats.get(fmt) || 0) + 1);
    }
    const topFormat = [...formats.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      total: posts.length,
      avgChars: Math.round(totalChars / posts.length),
      totalChars,
      avgHashtags: Math.round((totalHashtags / posts.length) * 10) / 10,
      withinPct: Math.round((withinLimit / posts.length) * 100),
      topFormat: topFormat ? `${topFormat[0]} ×${topFormat[1]}` : "—",
      platformLabel: niceLabelFor(platform),
    };
  }, [posts, platform]);

  const sampleMode = false;

  if (calendarError) {
    return (
      <WorkspacePage size="wide">
        <ErrorState
          title="Couldn't load this calendar"
          description={
            calendarError instanceof Error
              ? calendarError.message
              : "This calendar may have been deleted, or something went wrong while fetching it."
          }
          onRetry={() => refetchCalendar()}
        />
      </WorkspacePage>
    );
  }

  if (loading)
    return (
      <WorkspacePage size="wide">
        <div className="cd-inner">
          <SkeletonList rows={5} />
        </div>
      </WorkspacePage>
    );

  return (
    <>
      <Helmet>
        <title>{title ? `${title} — ContentForge` : "Content Calendar — ContentForge"}</title>
      </Helmet>
      {isE2EModeActive && (
        <div
          style={{
            background: "color-mix(in srgb, var(--color-warning-text) 8%, transparent)",
            borderBottom:
              "1px solid color-mix(in srgb, var(--color-warning-text) 20%, transparent)",
            padding: "10px 16px",
            textAlign: "center",
            fontSize: "12px",
            color: "#92400e",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "8px",
            zIndex: 1000,
            position: "relative",
          }}
        >
          <span>⚠️ Sandbox Mode Active (using mock test data)</span>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.localStorage.removeItem(getE2EAuthFlag());
                window.location.reload();
              }
            }}
            style={{
              background: "color-mix(in srgb, var(--color-warning-text) 14%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-warning-text) 32%, transparent)",
              color: "#92400e",
              padding: "2px 8px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 500,
              transition: "all 0.15s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background =
                "color-mix(in srgb, var(--color-primary-light) 35%, transparent)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background =
                "color-mix(in srgb, var(--color-primary-light) 20%, transparent)";
            }}
          >
            Switch to Live Database & AI
          </button>
        </div>
      )}
      <WorkspacePage size="wide">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link to="/my-calendars" className="cd-back">
            ← Back to my calendars
          </Link>
          <button
            type="button"
            className={`cd-fav-btn ${isFavorite ? "on" : ""}`}
            onClick={toggleFavorite}
            aria-pressed={isFavorite}
            title={isFavorite ? "Unstar" : "Star"}
          >
            {isFavorite ? "★ Starred" : "☆ Star"}
          </button>
        </div>
        <h1 className="cd-title">{title}</h1>
        <div className="cd-meta">{meta}</div>

        <div className="cd-hero">
          <div className="cd-hero-main">
            <div className="cd-hero-kicker">Review workspace</div>
            <div className="cd-hero-title">Polish the week, then ship it.</div>
            <p className="cd-hero-copy">
              Use the active-day card for edits, keep pinned posts protected, and move to schedule
              only when the calendar reads clean. The workflow is set up to help you review at a
              glance, not hunt for controls.
            </p>
            <div className="cd-hero-chiprow">
              {typeof window !== "undefined" &&
                window.localStorage.getItem(getE2EAuthFlag()) === "true" &&
                (() => {
                  const genCount = e2eStore.getLastGeneratedPosts
                    ? e2eStore.getLastGeneratedPosts()
                    : 0;
                  const visibleCount = genCount || posts.length;
                  return (
                    <span className="cd-hero-chip">
                      {visibleCount > 1 ? `${visibleCount}-day calendar` : `1-day calendar`}
                    </span>
                  );
                })()}
              <span className="cd-hero-chip">{posts.length} posts</span>
              <span className="cd-hero-chip">{lockedDays.size} pinned</span>
              <span className="cd-hero-chip">{timezone}</span>
              <span className="cd-hero-chip">{editing ? "Editing mode" : "Review mode"}</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <PostInsights post={p} platform={platform} topic={p.topic} />
            </div>
          </div>
          <div className="cd-hero-side">
            <div className="cd-hero-card">
              <span>Active day</span>
              <strong>
                Day {p?.day ?? 0} · {activeDowName}
              </strong>
              <small>{activeDate ? shortDateLabel(activeDate) : "No active post"}</small>
            </div>
            <div className="cd-hero-card">
              <span>Workflow</span>
              <strong>{sampleMode ? "Sample calendar" : "Live calendar"}</strong>
              <small>
                {posts.length > 1 ? "Use the strip to jump between days" : "Single post review"}
              </small>
            </div>
          </div>
        </div>

        {analytics && (
          <div className="cd-stats" aria-label="Calendar analytics">
            <div className="cd-stat">
              <span className="cd-stat-label">Posts</span>
              <span className="cd-stat-val">{analytics.total}</span>
              <span className="cd-stat-sub">this week</span>
            </div>
            <div className="cd-stat">
              <span className="cd-stat-label">Avg length</span>
              <span className="cd-stat-val">{analytics.avgChars.toLocaleString()}</span>
              <span className="cd-stat-sub">chars / post</span>
            </div>
            <div className="cd-stat">
              <span className="cd-stat-label">Avg hashtags</span>
              <span className="cd-stat-val">{analytics.avgHashtags}</span>
              <span className="cd-stat-sub">per post</span>
            </div>
            <div className="cd-stat">
              <span className="cd-stat-label">Within limit</span>
              <span className="cd-stat-val">
                <em>{analytics.withinPct}%</em>
              </span>
              <span className="cd-stat-sub">on {analytics.platformLabel}</span>
            </div>
            <div className="cd-stat">
              <span className="cd-stat-label">Top format</span>
              <span className="cd-stat-val" style={{ fontSize: 14, lineHeight: 1.4 }}>
                {analytics.topFormat}
              </span>
              <span className="cd-stat-sub">most-used</span>
            </div>
          </div>
        )}

        <div className="cd-toolbar-shell">
          <div className="cd-toolbar-card">
            <h2>Workspace controls</h2>
            <p>
              Lock the week start, timezone, and tracking destination before you export or reformat.
              These settings stay attached to the calendar draft.
            </p>
            <div className="cd-toolbar-row">
              <span className="cd-reformat-label">Week starting</span>
              <input
                type="date"
                aria-label="Week start date"
                value={weekStart}
                onChange={(e) => updateWeekStart(e.target.value)}
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border-strong)",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--color-text)",
                  fontFamily: "var(--font-body)",
                  outline: "none",
                  colorScheme: "light",
                }}
              />
              <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                Day 1 = {shortDateLabel(weekStartDate)}
              </span>
            </div>
            <div className="cd-toolbar-row">
              <span className="cd-reformat-label">Timezone</span>
              <select
                className="cd-tz-sel"
                aria-label="Calendar timezone"
                value={timezone}
                onChange={(e) => updateTimezone(e.target.value)}
                style={{ maxWidth: 240 }}
                title={`Workspace default: ${profileTimezone || browserTimezone()}`}
              >
                {tzList.map((tz) => (
                  <option key={tz} value={tz}>
                    {tzLabel(tz)}
                  </option>
                ))}
              </select>
              <span className="cd-reformat-label" style={{ marginLeft: 4 }}>
                Tracking URL
              </span>
              <input
                className="cd-tz-input"
                type="url"
                placeholder="https://yoursite.com/launch"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                onBlur={(e) => updateTrackingUrl(e.target.value.trim())}
              />
            </div>
            <div className="cd-toolbar-row">
              <span className="cd-reformat-label">Brand</span>
              <select
                className="cd-tz-sel"
                aria-label="Brand voice"
                value={calendarBrandSlotId || ""}
                onChange={(e) => updateBrandSlot(e.target.value)}
                disabled={brandSlotsQuery.isLoading || (brandSlotsQuery.data?.length ?? 0) === 0}
                style={{ maxWidth: 240 }}
                title="Choose which brand voice (forbidden phrases, proof points, CTA style) applies when regenerating or reformatting this calendar"
              >
                <option value="">Account default</option>
                {(brandSlotsQuery.data || []).map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.name}
                    {slot.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
              {brandSlotsQuery.isLoading && (
                <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                  Loading brand slots…
                </span>
              )}
            </div>
          </div>

          <div className="cd-toolbar-card">
            <h2>Reformat and export</h2>
            <p>
              Use the quick actions below to generate alternate platform versions or export the
              calendar into the formats you need for handoff.
            </p>
            <div className="cd-toolbar-row">
              <span className="cd-reformat-label">Reformat for</span>
              <select
                className="cd-reformat-sel"
                aria-label="Reformat platform"
                value={reformatTarget}
                onChange={(e) => setReformatTarget(e.target.value)}
                disabled={reformatting || regenerating}
              >
                <option value="" disabled>
                  Choose platform…
                </option>
                {(["LinkedIn", "Twitter/X", "Instagram", "Facebook", "Newsletter", "Blog"] as const)
                  .filter((p) => p !== platform)
                  .map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="cd-reformat-btn"
                disabled={!reformatTarget || reformatting || regenerating}
                onClick={() => setPendingReformatTarget(reformatTarget)}
                title="Re-runs all 7; saved as a new calendar"
              >
                {reformatting ? "Reformatting all 7…" : "Reformat all 7 →"}
              </button>
              <button
                type="button"
                className="cd-reformat-btn"
                style={{
                  background: "transparent",
                  border: "1px solid var(--color-border-strong)",
                  color: "var(--color-primary)",
                }}
                onClick={() => setPersonaCompareOpen(true)}
                title="Compare this post with another persona side-by-side"
              >
                👥 Compare Personas
              </button>
              <button
                type="button"
                className="cd-reformat-btn"
                style={{
                  background: "transparent",
                  border: "1px solid var(--color-border-strong)",
                  color: "var(--color-primary)",
                }}
                disabled={posts.length === 0}
                onClick={() => setBulkRepurposeModalOpen(true)}
                title="Repurpose all (or selected) days of this week for another platform, reviewed before saving"
              >
                ♻️ Repurpose week to…
              </button>
            </div>
            <div className="cd-toolbar-row">
              <span className="cd-reformat-label">Export</span>
              <button
                type="button"
                className="cd-export-btn"
                disabled={!!exportingFormat}
                onClick={() => handleExport("md")}
              >
                {exportingFormat === "md" ? "↓ .md…" : "↓ .md"}
              </button>
              <button
                type="button"
                className="cd-export-btn"
                disabled={!!exportingFormat}
                onClick={() => handleExport("pdf")}
              >
                {exportingFormat === "pdf" ? "↓ .pdf…" : "↓ .pdf"}
              </button>
              <button
                type="button"
                className="cd-export-btn"
                disabled={!!exportingFormat}
                onClick={() => handleExport("ics")}
                title="Export to Google Calendar / Outlook / Apple Cal"
              >
                {exportingFormat === "ics" ? "📅 .ics…" : "📅 .ics"}
              </button>
            </div>
          </div>
        </div>

        {posts.length > 1 && (
          <>
            <WeekBalanceScore posts={posts} />

            <DraftVersionHistory
              calendarId={id!}
              onRestore={(restoredPosts) => { setPosts(restoredPosts as any); }}
            />

            {isEnabled("topicGapIndicator") && missingTopics.length > 0 && (
              <div
                className="cd-gaps-bar"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 16,
                  padding: 12,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".05em" }}>
                  Topic Coverage Gaps
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {missingTopics.map(({ topic, isTrending }) => (
                    <TopicGapBadge
                      key={topic}
                      topic={topic}
                      isInferred={false}
                      isMissing={true}
                      isTrending={isTrending}
                      generating={generatingTopic === topic}
                      onGenerate={() => handleGenerateForMissingTheme(topic)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text3)",
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  marginBottom: 4,
                }}
              >
                Saved ideas ready to draft
              </div>
              <IdeaBacklogPanel
                items={backlogQuery.data?.filter((i) => !i.used_at) ?? []}
                loading={backlogQuery.isLoading}
                onDraftIdea={handleDraftBacklogIdea}
                onRemoveIdea={handleRemoveBacklogIdea}
                removingId={removingBacklogId}
              />
            </div>

            <div
              className="cd-strip"
              role="tablist"
              aria-label="Days of the week"
              style={{ height: "auto", minHeight: "68px" }}
            >
              {posts.map((post, i) => {
                const st = statusByDay[post.day];
                const dayDate = new Date(
                  weekStartDate.getFullYear(),
                  weekStartDate.getMonth(),
                  weekStartDate.getDate() + i
                );
                const dayOfWeekName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                  dayDate.getDay()
                ];
                return (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === active}
                    disabled={editing}
                    className={`cd-tab ${i === active ? "on" : ""} ${lockedDays.has(post.day) ? "locked" : ""}`}
                    onClick={() => {
                      if (!editing) setActive(i);
                    }}
                    title={st ? `Status: ${st}` : "Not scheduled"}
                    style={{ paddingBottom: 6 }}
                  >
                    {st && (
                      <span
                        className={`cd-tab-status ${st}`}
                        aria-hidden="true"
                        style={{
                          background:
                            st === "published"
                              ? "var(--color-primary)"
                              : st === "approved"
                                ? "var(--color-status-approved)"
                                : st === "failed"
                                  ? "var(--color-error-text)"
                                  : "var(--color-text-disabled)",
                        }}
                      />
                    )}
                    <div className="cd-tab-dow">{dayOfWeekName}</div>
                    <div className="cd-tab-n">{i + 1}</div>
                    <div className="cd-tab-date">{shortDateLabel(dayDate).split(" · ")[1]}</div>
                    {/* Engagement prediction badge */}
                    {(() => {
                      const engagementLevel = getEngagementPrediction(post, platform);
                      const badge = ENGAGEMENT_BADGE[engagementLevel];
                      return (
                        <div
                          title={`Predicted engagement: ${engagementLevel}`}
                          style={{
                            marginTop: 4,
                            fontSize: 9,
                            fontWeight: 600,
                            letterSpacing: ".04em",
                            color: badge.color,
                            background: badge.bg,
                            borderRadius: 99,
                            padding: "1px 4px",
                            lineHeight: 1.4,
                            display: "inline-block",
                            transition: "opacity .2s",
                            opacity: i === active ? 1 : 0.7,
                          }}
                        >
                          {badge.emoji} {engagementLevel}
                        </div>
                      );
                    })()}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="cd-export-row" aria-label="Export options">
          <button
            type="button"
            className="cd-export-btn"
            disabled={!!exportingFormat}
            onClick={() => handleExport("md")}
          >
            {exportingFormat === "md" ? "↓ .md…" : "↓ .md"}
          </button>
          <button
            type="button"
            className="cd-export-btn"
            disabled={!!exportingFormat}
            onClick={() => handleExport("pdf")}
          >
            {exportingFormat === "pdf" ? "↓ .pdf…" : "↓ .pdf"}
          </button>
          <button
            type="button"
            className="cd-export-btn"
            disabled={!!exportingFormat}
            onClick={() => handleExport("ics")}
            title="Export to Google Calendar / Outlook / Apple Cal"
          >
            {exportingFormat === "ics" ? "📅 .ics…" : "📅 .ics"}
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
          <BufferScheduler posts={posts} platform={platform} postTimes={postTimes} />
        </div>

        <div className="cd-bulk-bar">
          {posts.length > 1 ? (
            <>
              <span className="cd-bulk-label">
                Bulk actions · {posts.length - lockedDays.size} unlocked / {lockedDays.size} pinned
              </span>
              <button
                type="button"
                className="cd-bulk-btn"
                onClick={regenerateAllUnlocked}
                disabled={bulkRegenerating || regenerating || reformatting || editing}
                title="Re-rolls every unpinned post with the same constraints"
              >
                {bulkRegenerating
                  ? `↻ Regenerating ${bulkProgress?.done ?? 0}/${bulkProgress?.total ?? 0}…`
                  : `↻ Regenerate all unlocked`}
              </button>
              <button
                type="button"
                className="cd-bulk-btn primary"
                onClick={() => setScheduleOpen(true)}
                disabled={bulkRegenerating || regenerating || editing}
                title="Queue all posts at the times shown"
              >
                📅 Schedule week →
              </button>
            </>
          ) : (
            <>
              <span className="cd-bulk-label">Single-day post</span>
              <button
                type="button"
                className="cd-bulk-btn primary"
                onClick={() => setScheduleOpen(true)}
                disabled={bulkRegenerating || regenerating || editing}
                title="Schedule this post"
              >
                📅 Schedule this post →
              </button>
            </>
          )}
        </div>

        <AnimatePresence mode="wait">
          {p && !editing && (
            <motion.div
              key="view"
              className="cd-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span className="cd-date-pill">
                    {activeDate ? shortDateLabel(activeDate) : ""}
                  </span>
                  <span className="ptag pt-topic" style={{ fontSize: 11 }}>
                    {p.topic}
                  </span>
                  <TopicGapBadge
                    topic={p.topic}
                    rationale={p.rationale}
                    isInferred={
                      isEnabled("topicGapIndicator") &&
                      (!formPayload.topics ||
                        !formPayload.topics.some(
                          (t: string) =>
                            t && t.trim().toLowerCase() === p.topic.trim().toLowerCase()
                        ))
                    }
                  />
                </div>
                <button
                  type="button"
                  className={`cd-pin-btn ${lockedDays.has(p.day) ? "on" : ""}`}
                  onClick={() => toggleLock(p.day)}
                  title={lockedDays.has(p.day) ? "Pinned" : "Pin this post"}
                  aria-pressed={lockedDays.has(p.day)}
                >
                  {lockedDays.has(p.day) ? "📌" : "📍"}
                </button>
              </div>
              <div className="cd-time-row">
                <span className="cd-time-label">Post time</span>
                <input
                  type="time"
                  className="cd-time-input"
                  aria-label={`Post time for day ${p.day}`}
                  value={postTimes[String(p.day)] || suggestedTimeForDay(p.day, platform)}
                  onChange={(e) => updatePostTime(p.day, e.target.value)}
                />
              </div>
              <div className="cd-ptitle" style={{ marginTop: 14 }}>
                {p.title}
              </div>
              <div className="cd-blabel">
                <span>Hook</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div className="cd-hook" style={{ flex: 1 }}>
                  {p.hook}
                </div>
                {p.hook_options && p.hook_options.length > 1 && (
                  <select
                    className="cd-reformat-sel"
                    value={p.hook}
                    onChange={(e) => selectHookVariant(p.day, e.target.value)}
                    aria-label={`Choose hook variant for day ${p.day}`}
                  >
                    {p.hook_options.map((h, i) => (
                      <option key={i} value={h}>
                        {h.length > 60 ? `${h.slice(0, 60)}…` : h}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="cd-blabel">
                <span>Post body</span>
              </div>
              <div className="cd-body">{stripMarkdown(p.body)}</div>
              <div className="cd-blabel">
                <span>CTA</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div className="cd-cta" style={{ flex: 1 }}>
                  {p.cta}
                </div>
                {p.cta_options && p.cta_options.length > 1 && (
                  <select
                    className="cd-reformat-sel"
                    value={p.cta}
                    onChange={(e) => selectCtaVariant(p.day, e.target.value)}
                    aria-label={`Choose CTA variant for day ${p.day}`}
                  >
                    {p.cta_options.map((c, i) => (
                      <option key={i} value={c}>
                        {c.length > 60 ? `${c.slice(0, 60)}…` : c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* ── Tone Slider (Feature 6) ─────────────────────────────────── */}
              <div
                style={{
                  marginTop: 14,
                  padding: "12px 14px",
                  background: "color-mix(in srgb, var(--color-surface) 2%, transparent)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      color: "var(--text2)",
                      fontWeight: 500,
                    }}
                  >
                    Tone
                  </span>
                  <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 500 }}>
                    {(toneLevel[p.day] ?? 3) === 1
                      ? "Very Formal"
                      : (toneLevel[p.day] ?? 3) === 2
                        ? "Formal"
                        : (toneLevel[p.day] ?? 3) === 3
                          ? "Balanced"
                          : (toneLevel[p.day] ?? 3) === 4
                            ? "Casual"
                            : "Very Casual"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--text3)" }}>Formal</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    aria-label="Tone, from formal to casual"
                    disabled={regenerating}
                    value={toneLevel[p.day] ?? 3}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setToneLevel((prev) => ({ ...prev, [p.day]: v }));
                      if (toneDebounce.current) clearTimeout(toneDebounce.current);
                      toneDebounce.current = setTimeout(() => {
                        if (v !== 3) {
                          const toneLabel =
                            v === 1
                              ? "very-formal"
                              : v === 2
                                ? "formal"
                                : v === 4
                                  ? "casual"
                                  : "very-casual";
                          void regenerateDay(`tone-${toneLabel}` as any);
                        }
                      }, 700);
                    }}
                    style={{
                      flex: 1,
                      accentColor: "var(--accent)",
                      cursor: regenerating ? "not-allowed" : "pointer",
                    }}
                  />
                  <span style={{ fontSize: 10, color: "var(--text3)" }}>Casual</span>
                </div>
                <div
                  style={{ fontSize: 10, color: "var(--text3)", marginTop: 5, fontStyle: "italic" }}
                >
                  Adjusts register only — content and structure stay the same
                </div>
              </div>

              <div className="cd-blabel">
                <span>Hashtags</span>
                <span className="cd-blabel-count">click a tag to lock, ban, or replace</span>
              </div>
              <div className="cd-tags-row">
                {(() => {
                  const tags = parseHashtagsString(p.hashtags);
                  const locks = lockedHashtags[String(p.day)] || [];
                  if (tags.length === 0)
                    return (
                      <span className="cd-tags" style={{ color: "var(--color-text-secondary)" }}>
                        — none —
                      </span>
                    );
                  return tags.map((t) => {
                    const isLocked = locks.includes(t);
                    const overridesBan = isLocked && profilePolicy.banned.includes(t);
                    const open = tagPopover && tagPopover.day === p.day && tagPopover.tag === t;
                    return (
                      <span key={t} className="cd-tag-wrap">
                        <button
                          type="button"
                          className={`cd-tag-chip ${isLocked ? "locked" : ""}`}
                          onClick={() => {
                            setTagPopover(open ? null : { day: p.day, tag: t });
                            setTagReplacement("");
                          }}
                          title={isLocked ? "Pinned — survives regenerates" : "Click for actions"}
                        >
                          {isLocked ? "📌 " : ""}
                          {displayTag(t)}
                        </button>
                        {overridesBan && (
                          <span
                            className="cd-tag-policy-warn"
                            title="Locked tag overrides the workspace ban list"
                          >
                            overrides ban
                          </span>
                        )}
                        {open && (
                          <div className="cd-tag-pop" style={{ top: "calc(100% + 4px)", left: 0 }}>
                            <div className="cd-tag-pop-h">{displayTag(t)}</div>
                            {isLocked ? (
                              <button
                                className="cd-tag-pop-btn"
                                onClick={() => unlockTagOnPost(p.day, t)}
                              >
                                📍 Unpin
                              </button>
                            ) : (
                              <button
                                className="cd-tag-pop-btn"
                                onClick={() => lockTagOnPost(p.day, t)}
                              >
                                📌 Lock on this post
                              </button>
                            )}
                            <button
                              className="cd-tag-pop-btn danger"
                              onClick={() => banTagWorkspaceWide(p.day, t)}
                            >
                              ✕ Ban workspace-wide
                            </button>
                            <div className="cd-tag-pop-row">
                              <input
                                className="cd-tag-pop-input"
                                placeholder="replace with…"
                                value={tagReplacement}
                                onChange={(e) => setTagReplacement(e.target.value)}
                                onKeyDown={(e) =>
                                  e.key === "Enter" && replaceTagOnPost(p.day, t, tagReplacement)
                                }
                                autoFocus
                              />
                              <button
                                className="cd-tag-pop-btn"
                                style={{ flex: "0 0 auto" }}
                                onClick={() => replaceTagOnPost(p.day, t, tagReplacement)}
                              >
                                ↻
                              </button>
                            </div>
                            <button
                              className="cd-tag-pop-btn"
                              onClick={() => setTagPopover(null)}
                              style={{
                                borderColor: "transparent",
                                color: "var(--color-text-secondary)",
                              }}
                            >
                              Close
                            </button>
                          </div>
                        )}
                      </span>
                    );
                  });
                })()}
              </div>
              <div className="cd-blabel">
                <span>Cinematic image prompt</span>
              </div>
              <div className="cd-body" style={{ whiteSpace: "pre-wrap" }}>
                {p.image_prompt || "No image prompt generated yet."}
              </div>
              {p.image_url && (
                <div
                  className="cd-image-preview"
                  style={{
                    aspectRatio: cssAspectRatioForPlatform(platform),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    backgroundColor: "color-mix(in srgb, var(--color-text) 20%, transparent)",
                  }}
                >
                  <img
                    src={p.image_url}
                    alt={`Generated visual for day ${p.day}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              )}
              <div className="cd-actions" style={{ marginTop: 10 }}>
                <button
                  className="cd-btn"
                  disabled={regenerating || imageGeneratingDay === p.day || !p.image_prompt}
                  onClick={() => generateVisualForPost(p)}
                  title={
                    !p.image_prompt
                      ? "This post needs an image prompt first"
                      : `Generate a ${aspectRatioForPlatform(platform)} visual`
                  }
                >
                  {imageGeneratingDay === p.day
                    ? "Generating visual..."
                    : p.image_url
                      ? "Regenerate visual"
                      : "Generate visual"}
                </button>
                <button
                  type="button"
                  className="cd-btn"
                  onClick={() => {
                    setPasteImageOpenDay(pasteImageOpenDay === p.day ? null : p.day);
                    setPasteImageUrl(p.image_url || "");
                  }}
                  title="Paste your own image URL"
                >
                  🔗 Paste URL
                </button>
                {p.image_url && (
                  <>
                    <button
                      className="cd-btn"
                      onClick={async () => {
                        const ok = await writeToClipboard(p.image_url || "");
                        if (ok) toast.success("Image URL copied");
                      }}
                    >
                      Copy image URL
                    </button>
                    <button
                      className="cd-btn"
                      style={{
                        borderColor: "color-mix(in srgb, var(--color-error-text) 30%, transparent)",
                        color: "var(--color-error-text)",
                      }}
                      onClick={() => setPendingRemoveVisual(p.day)}
                    >
                      Remove visual
                    </button>
                  </>
                )}
              </div>

              {/* ── Collapsible Image URL Paste (Feature 2) ────────────────── */}
              {pasteImageOpenDay === p.day && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "12px 14px",
                    background: "color-mix(in srgb, var(--color-surface) 2%, transparent)",
                    border: "1px dashed var(--border2)",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      color: "var(--text2)",
                      fontWeight: 500,
                      marginBottom: 8,
                    }}
                  >
                    Paste Your Own Image URL
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="url"
                      value={pasteImageUrl}
                      onChange={(e) => setPasteImageUrl(e.target.value)}
                      placeholder="https://your-image-url.com/image.jpg"
                      style={{
                        flex: 1,
                        background: "var(--bg)",
                        border: "1px solid var(--border2)",
                        borderRadius: 6,
                        padding: "7px 10px",
                        fontSize: 12,
                        color: "var(--text)",
                        fontFamily: "var(--font-body)",
                        outline: "none",
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && pasteImageUrl.startsWith("http")) {
                          await applyImageToPost(p.day, pasteImageUrl);
                          setPasteImageOpenDay(null);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="cd-btn cd-btn-p"
                      style={{ padding: "5px 12px", fontSize: 11 }}
                      disabled={!pasteImageUrl.startsWith("http")}
                      onClick={async () => {
                        if (pasteImageUrl.startsWith("http")) {
                          await applyImageToPost(p.day, pasteImageUrl);
                          setPasteImageOpenDay(null);
                        }
                      }}
                    >
                      Apply
                    </button>
                  </div>
                  {pasteImageUrl.startsWith("http") && (
                    <div
                      style={{
                        marginTop: 10,
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid var(--border)",
                        aspectRatio: cssAspectRatioForPlatform(platform),
                        backgroundColor: "color-mix(in srgb, var(--color-text) 20%, transparent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={pasteImageUrl}
                        alt="Preview"
                        style={{
                          display: "block",
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text3)",
                      marginTop: 6,
                      fontStyle: "italic",
                    }}
                  >
                    Paste a direct image URL (JPG, PNG, WebP). Press Enter or click Apply.
                  </div>
                </div>
              )}
              <div className="cd-actions">
                {(() => {
                  const f = formatForPlatform(p, platform);
                  const niceLabel = niceLabelFor(platform);
                  const ratio = f.charCount / f.limit;
                  const budgetCls = f.charCount > f.limit ? "over" : ratio >= 0.9 ? "warn" : "";
                  return (
                    <>
                      <span
                        className={`cd-budget ${budgetCls}`}
                        title={`Post-format length for ${niceLabel}`}
                        aria-label={`${f.charCount} of ${f.limit} characters used for ${niceLabel}`}
                      >
                        <span className="cd-budget-dot" aria-hidden="true" />
                        {f.charCount.toLocaleString()} / {f.limit.toLocaleString()} (
                        {Math.round(ratio * 100)}%)
                      </span>
                      {(() => {
                        const ins = insightFor(p, platform);
                        const tagCls =
                          ins.hashtagState === "sweet"
                            ? "good"
                            : ins.hashtagState === "na"
                              ? ""
                              : ins.hashtagState === "dense"
                                ? "bad"
                                : "warn";
                        const healthCls =
                          ins.health === "good" ? "good" : ins.health === "warn" ? "warn" : "bad";
                        const healthLabel =
                          ins.health === "good"
                            ? "✓ ready"
                            : ins.health === "warn"
                              ? "⚠ review"
                              : "✕ Fix hashtags";
                        const healthTooltip =
                          ins.health === "good"
                            ? "Post length and hashtag density are within recommended ranges."
                            : ins.health === "warn"
                              ? "Warning: Post has suboptimal length or hashtag density."
                              : "Hashtag density exceeds recommended limit or contains banned hashtags. Please edit to fix.";
                        return (
                          <>
                            <span
                              className={`cd-chip ${tagCls}`}
                              title={`Hashtag density for ${niceLabel}`}
                            >
                              # {ins.hashtagLabel}
                            </span>
                            <span className={`cd-chip ${healthCls}`} title={healthTooltip}>
                              {healthLabel}
                            </span>
                            {p.variant_scores &&
                              p.chosen_index !== undefined &&
                              p.variant_scores[p.chosen_index] &&
                              (() => {
                                const s = p.variant_scores[p.chosen_index];
                                const avg = calculateScore(s);
                                const scoreCls = avg >= 4.5 ? "good" : avg >= 3.5 ? "warn" : "bad";
                                const breakdown = Object.entries(s)
                                  .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}/5`)
                                  .join("\n");
                                return (
                                  <span
                                    className={`cd-chip ${scoreCls}`}
                                    title={`AI Quality Score (LLM-as-judge)\n\n${breakdown}\n\nSelected from ${p.variant_scores.length} variants.`}
                                  >
                                    ✨ {avg}/5.0
                                  </span>
                                );
                              })()}
                          </>
                        );
                      })()}
                      <button
                        className="cd-btn cd-btn-p"
                        disabled={regenerating}
                        title={`${f.charCount} / ${f.limit} chars`}
                        onClick={async () => {
                          const ok = await writeToClipboard(f.text);
                          if (!ok) {
                            toast.error("Could not copy to clipboard");
                            return;
                          }
                          if (f.truncated && f.platform === "twitter") {
                            toast.error("Trimmed to fit X's 280-char limit");
                          } else {
                            toast.success(`Copied for ${niceLabel} ✓`);
                          }
                        }}
                      >
                        Copy for {niceLabel}
                      </button>
                    </>
                  );
                })()}
                <button className="cd-btn" onClick={startEdit} disabled={regenerating}>
                  Edit this post
                </button>
                <button
                  className="cd-btn"
                  onClick={() => regenerateDay()}
                  disabled={regenerating}
                  title="Re-roll this day without touching the other six"
                >
                  {regenerating ? "Regenerating…" : "↻ Regenerate"}
                </button>
                <button
                  className="cd-btn"
                  onClick={() => setFeedbackOpen(true)}
                  disabled={regenerating}
                  title="Provide custom formatting notes or adjustment instructions for this day's rewrite"
                >
                  📝 Regenerate with notes
                </button>
                <div className="cd-tweak-wrap" ref={repurposeRef}>
                  <button
                    className="cd-btn"
                    disabled={regenerating || repurposing}
                    onClick={() => setRepurposeOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={repurposeOpen}
                  >
                    {repurposing ? "⏳ Repurposing..." : "♻️ Repurpose ▾"}
                  </button>
                  {repurposeOpen && (
                    <div className="cd-tweak-menu" role="menu">
                      <button className="cd-tweak-opt" onClick={() => repurposeTo("X")}>
                        Repurpose for X (Twitter)
                      </button>
                      <button className="cd-tweak-opt" onClick={() => repurposeTo("Instagram")}>
                        Repurpose for Instagram
                      </button>
                      <button className="cd-tweak-opt" onClick={() => repurposeTo("Facebook")}>
                        Repurpose for Facebook
                      </button>
                      <button className="cd-tweak-opt" onClick={() => repurposeTo("LinkedIn")}>
                        Repurpose for LinkedIn
                      </button>
                      <button className="cd-tweak-opt" onClick={() => repurposeTo("Newsletter")}>
                        Repurpose for Newsletter
                      </button>
                    </div>
                  )}
                </div>

                <div className="cd-tweak-wrap" ref={tweakRef}>
                  <button
                    className="cd-btn"
                    disabled={regenerating}
                    onClick={() => setTweakOpen((o) => !o)}
                    aria-haspopup="menu"
                    aria-expanded={tweakOpen}
                  >
                    ⚡ Tweak ▾
                  </button>
                  {tweakOpen && (
                    <div className="cd-tweak-menu" role="menu">
                      <button className="cd-tweak-opt" onClick={() => regenerateDay("shorter")}>
                        Make shorter
                      </button>
                      <button className="cd-tweak-opt" onClick={() => regenerateDay("punchier")}>
                        Make punchier
                      </button>
                      <button className="cd-tweak-opt" onClick={() => regenerateDay("add-stat")}>
                        Add a stat
                      </button>
                      <button
                        className="cd-tweak-opt"
                        onClick={() => regenerateDay("remove-emoji")}
                      >
                        Remove emoji
                      </button>
                      <button className="cd-tweak-opt" onClick={() => regenerateDay("enhance")}>
                        Enhance for performance
                      </button>
                      {(() => {
                        const t = posts[active];
                        const hasE = t
                          ? hasEmoji(
                              (t.title || "") +
                                " " +
                                (t.hook || "") +
                                " " +
                                (t.body || "") +
                                " " +
                                (t.cta || "")
                            )
                          : false;
                        return (
                          <button
                            className="cd-tweak-opt"
                            onClick={() => regenerateDay("remove-emoji")}
                            disabled={!hasE}
                            title={!hasE ? "No emoji detected" : "Remove emojis from this post"}
                          >
                            Remove emoji
                          </button>
                        );
                      })()}
                      <button
                        className="cd-tweak-opt"
                        onClick={() => regenerateDay("clean-formatting")}
                      >
                        Clean formatting symbols
                      </button>
                      <button
                        className="cd-tweak-opt"
                        onClick={() => regenerateDay("more-personal")}
                      >
                        More personal
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {p && editing && draft && (
            <motion.div
              key="edit"
              className="cd-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            >
              <div className="cd-blabel">
                <span>Day · Day-of-week</span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <input
                  className="cd-edit-input"
                  type="number"
                  min={1}
                  max={7}
                  value={draft.day}
                  onChange={(e) => setDraft({ ...draft, day: Number(e.target.value) || draft.day })}
                  style={{ marginBottom: 0, fontFamily: "var(--font-body)", fontSize: 13 }}
                />
                <select
                  className="cd-edit-input"
                  value={draft.dow}
                  onChange={(e) => setDraft({ ...draft, dow: e.target.value })}
                  style={{
                    marginBottom: 0,
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    appearance: "auto",
                  }}
                >
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cd-blabel">
                <span>Topic</span>
                {fieldHistory[draft.day]?.["topic"]?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => undoField("topic")}
                    style={{
                      marginLeft: 8,
                      fontSize: "11px",
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    ↩ Restore previous
                  </button>
                )}
              </div>
              <input
                className="cd-edit-input"
                style={{ fontFamily: "var(--font-body)", fontSize: 13 }}
                value={draft.topic}
                onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
              />

              <div className="cd-blabel">
                <span>Format</span>
                {fieldHistory[draft.day]?.["format"]?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => undoField("format")}
                    style={{
                      marginLeft: 8,
                      fontSize: "11px",
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    ↩ Restore previous
                  </button>
                )}
              </div>
              <input
                className="cd-edit-input"
                style={{ fontFamily: "var(--font-body)", fontSize: 13 }}
                value={draft.format}
                onChange={(e) => setDraft({ ...draft, format: e.target.value })}
              />

              <div className="cd-blabel">
                <span>Title</span>
                {fieldHistory[draft.day]?.["title"]?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => undoField("title")}
                    style={{
                      marginLeft: 8,
                      fontSize: "11px",
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    ↩ Restore previous
                  </button>
                )}
                <span className="cd-blabel-count">{titleChars} chars</span>
              </div>
              <input
                className="cd-edit-input"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />

              <div className="cd-blabel">
                <span>Hook</span>
                {fieldHistory[draft.day]?.["hook"]?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => undoField("hook")}
                    style={{
                      marginLeft: 8,
                      fontSize: "11px",
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    ↩ Restore previous
                  </button>
                )}
                <span className="cd-blabel-count">{hookWords} words</span>
              </div>
              <textarea
                className="cd-edit-area"
                rows={3}
                value={draft.hook}
                onChange={(e) => setDraft({ ...draft, hook: e.target.value })}
                onSelect={(e) => rememberInlineSelection("hook", e.currentTarget)}
              />

              <div className="cd-blabel">
                <span>Post body</span>
                {fieldHistory[draft.day]?.["body"]?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => undoField("body")}
                    style={{
                      marginLeft: 8,
                      fontSize: "11px",
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    ↩ Restore previous
                  </button>
                )}
                <span className="cd-blabel-count">
                  {bodyWords} words · {targetHint}
                </span>
              </div>
              <textarea
                className="cd-edit-area"
                rows={10}
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                onSelect={(e) => rememberInlineSelection("body", e.currentTarget)}
              />
              <div className="cd-editor-tools">
                <button
                  className="cd-btn"
                  disabled={inlineRewriting}
                  onClick={() => rewriteInlineSelection("punchier")}
                >
                  Punchier
                </button>
                <button
                  className="cd-btn"
                  disabled={inlineRewriting}
                  onClick={() => rewriteInlineSelection("add-stat")}
                >
                  Add stat
                </button>
                <button
                  className="cd-btn"
                  disabled={inlineRewriting}
                  onClick={() => rewriteInlineSelection("question")}
                >
                  Make question
                </button>
                <button
                  className="cd-btn"
                  disabled={inlineRewriting}
                  onClick={() => rewriteInlineSelection("simpler")}
                >
                  Simpler
                </button>
                <span className="cd-editor-note">
                  {inlineSelection
                    ? `${inlineSelection.text.length} selected in ${inlineSelection.field}`
                    : "Select text in hook, body, or CTA"}
                  {inlineRewriting ? " · rewriting..." : ""}
                </span>
              </div>
              <div className="cd-editor-meter">
                <span>
                  <strong>{draftReadability.label}</strong>
                  {draftReadability.score}/100 readability
                </span>
                <span>
                  <strong>{draftReadability.averageSentenceWords}</strong>avg words per sentence
                </span>
                <span>
                  <strong>{draftReadability.longSentences}</strong>long sentence
                  {draftReadability.longSentences === 1 ? "" : "s"}
                </span>
              </div>
              {repeatWarning && (
                <div className="cd-editor-warning">
                  {repeatWarning}. Consider rewriting this passage before saving.
                </div>
              )}

              <div className="cd-blabel">
                <span>CTA</span>
                {fieldHistory[draft.day]?.["cta"]?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => undoField("cta")}
                    style={{
                      marginLeft: 8,
                      fontSize: "11px",
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    ↩ Restore previous
                  </button>
                )}
                <span className="cd-blabel-count">{ctaChars} chars</span>
              </div>
              <textarea
                className="cd-edit-area"
                rows={2}
                value={draft.cta}
                onChange={(e) => setDraft({ ...draft, cta: e.target.value })}
                onSelect={(e) => rememberInlineSelection("cta", e.currentTarget)}
              />

              <div className="cd-blabel">
                <span>Hashtags</span>
                {fieldHistory[draft.day]?.["hashtags"]?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => undoField("hashtags")}
                    style={{
                      marginLeft: 8,
                      fontSize: "11px",
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    ↩ Restore previous
                  </button>
                )}
              </div>
              <HashtagChipEditor
                hashtags={draft.hashtags}
                platform={platform}
                onChange={(newTags) => setDraft({ ...draft, hashtags: newTags })}
              />

              <div className="cd-blabel">
                <span>Why this works (rationale)</span>
                {fieldHistory[draft.day]?.["rationale"]?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => undoField("rationale")}
                    style={{
                      marginLeft: 8,
                      fontSize: "11px",
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    ↩ Restore previous
                  </button>
                )}
              </div>
              <textarea
                className="cd-edit-area"
                rows={3}
                value={draft.rationale}
                onChange={(e) => setDraft({ ...draft, rationale: e.target.value })}
              />

              <div className="cd-blabel">
                <span>Cinematic image prompt</span>
                {fieldHistory[draft.day]?.["image_prompt"]?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => undoField("image_prompt")}
                    style={{
                      marginLeft: 8,
                      fontSize: "11px",
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    ↩ Restore previous
                  </button>
                )}
              </div>
              <textarea
                className="cd-edit-area"
                rows={8}
                value={draft.image_prompt || ""}
                onChange={(e) => setDraft({ ...draft, image_prompt: e.target.value })}
              />

              <div className="cd-actions">
                <button className="cd-btn cd-btn-p" onClick={saveEdit} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button className="cd-btn" onClick={cancelEdit} disabled={saving}>
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </WorkspacePage>
      {scheduleOpen && (
        <div className="cd-modal-bg" onClick={() => !scheduling && setScheduleOpen(false)}>
          <div
            className="cd-modal"
            onClick={(e) => e.stopPropagation()}
            tabIndex={0}
            role="dialog"
            aria-modal="true"
            aria-label="Schedule this week dialog"
          >
            <h3>Schedule this week</h3>
            <p>
              Queues all 7 posts to your schedule using the times below. Existing scheduled entries
              for this calendar will be replaced. Adjust times in the per-day cards if needed.
            </p>
            {posts.map((post, idx) => {
              const d = new Date(
                weekStartDate.getFullYear(),
                weekStartDate.getMonth(),
                weekStartDate.getDate() + idx
              );
              return (
                <div key={post.day} className="cd-modal-row">
                  <span className="cd-modal-day">{shortDateLabel(d)}</span>
                  <input
                    type="time"
                    className="cd-modal-time"
                    aria-label={`Schedule time for day ${post.day}`}
                    value={postTimes[String(post.day)] || suggestedTimeForDay(post.day, platform)}
                    onChange={(e) => updatePostTime(post.day, e.target.value)}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-secondary)",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {post.title}
                  </span>
                </div>
              );
            })}
            <div className="cd-modal-actions">
              <button
                className="cd-bulk-btn"
                onClick={() => setScheduleOpen(false)}
                disabled={scheduling}
              >
                Cancel
              </button>
              <button className="cd-bulk-btn primary" onClick={scheduleWeek} disabled={scheduling}>
                {scheduling ? "Scheduling…" : `Schedule ${posts.length} posts`}
              </button>
            </div>
          </div>
        </div>
      )}
      {feedbackOpen && (
        <Suspense fallback={null}>
          <FeedbackModal
            open={feedbackOpen}
            submitting={feedbackSubmitting || regenerating}
            onClose={() => {
              if (!feedbackSubmitting && !regenerating) setFeedbackOpen(false);
            }}
            onSubmit={async ({ feedback, category, rating }) => {
              try {
                setFeedbackSubmitting(true);
                await regenerateDay(undefined, feedback, category, rating);
                setFeedbackOpen(false);
              } finally {
                setFeedbackSubmitting(false);
              }
            }}
          />
        </Suspense>
      )}

      {repurposedPost && (
        <div className="cd-modal-bg" onClick={() => setRepurposedPost(null)}>
          <div className="cd-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="cd-hero-kicker">✨ Repurposed Variant</div>
            <h3 className="cd-title" style={{ marginTop: 0 }}>
              {repurposedPost.topic}
            </h3>
            <p className="cd-meta" style={{ marginBottom: 15 }}>
              Optimized for {repurposedTarget || repurposedPost.format}
            </p>

            {repurposeStage && (
              <p className="cd-meta" style={{ marginBottom: 12 }}>
                {repurposeStage === "rewriting" && "✍️ Rewriting for the new platform…"}
                {repurposeStage === "scoring" && "📊 Scoring the new variant…"}
                {repurposeStage === "illustrating" && "🎨 Generating a cover image…"}
              </p>
            )}

            <div className="cd-blabel">
              <span>Repurposed Body</span>
            </div>
            <div
              className="cd-card"
              style={{
                background: "var(--color-surface-muted)",
                padding: 15,
                borderRadius: 12,
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--color-text)",
                }}
              >
                {repurposedPost.body}
              </div>
            </div>

            {repurposedPost.image_url && (
              <div
                style={{
                  marginBottom: 20,
                  border: "2px solid var(--color-border)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <img
                  src={repurposedPost.image_url}
                  alt="Generated cover for repurposed post"
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
              </div>
            )}

            <PerformanceScoreCard post={repurposedPost} topic={formPayload.coreIdea} />

            <div className="cd-modal-actions" style={{ marginTop: 16 }}>
              <button
                className="cd-btn"
                onClick={() => {
                  writeToClipboard(repurposedPost.body);
                  toast.success("Repurposed text copied!");
                }}
              >
                📋 Copy Text
              </button>
              <button
                className="cd-btn"
                style={{ background: "var(--color-primary)", color: "var(--color-surface)" }}
                onClick={saveRepurposedPost}
              >
                📥 Save this version
              </button>
              <button
                className="cd-fav-btn"
                onClick={() => {
                  setRepurposedPost(null);
                  setRepurposedTarget("");
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkRepurposeModal
        open={bulkRepurposeModalOpen}
        posts={posts}
        currentPlatform={platform}
        onClose={() => setBulkRepurposeModalOpen(false)}
        onStart={startBulkRepurpose}
      />

      {bulkRepurpose.items.length > 0 && (
        <BulkRepurposePanel
          items={bulkRepurpose.items}
          targetPlatform={bulkRepurpose.targetPlatform}
          running={bulkRepurpose.running}
          settled={bulkRepurpose.settled}
          counts={bulkRepurpose.counts}
          topic={formPayload.coreIdea}
          saving={bulkRepurposeSaving}
          onToggleIncluded={bulkRepurpose.toggleIncluded}
          onRetryFailed={bulkRepurpose.retryFailed}
          onSave={saveBulkRepurposeResults}
          onClose={closeBulkRepurposePanel}
        />
      )}

      {pendingReformatTarget && (
        <ConfirmDialog
          title="Reformat all 7 posts?"
          message={`This will create a new calendar reformatted for ${niceLabelFor(pendingReformatTarget)} and leave the current one untouched.`}
          onCancel={() => setPendingReformatTarget(null)}
          onConfirm={async () => {
            setPendingReformatTarget(null);
            await reformatAllForPlatform(pendingReformatTarget);
          }}
        />
      )}
      {pendingScheduleConflict && (
        <ConfirmDialog
          title="Time slot already taken"
          message={`${pendingScheduleConflict.count} post${pendingScheduleConflict.count === 1 ? " is" : "s are"} already scheduled for ${niceLabelFor(platform)} at the same time from another calendar. Schedule anyway?`}
          confirmLabel="Schedule anyway"
          onCancel={() => setPendingScheduleConflict(null)}
          onConfirm={async () => {
            const conflict = pendingScheduleConflict;
            setPendingScheduleConflict(null);
            setScheduling(true);
            const tz = timezone || profileTimezone || browserTimezone();
            await commitScheduleWeek(conflict.rows, tz);
          }}
        />
      )}
      {pendingBanTag && (
        <ConfirmDialog
          title="Ban hashtag workspace-wide?"
          message={`Ban #${pendingBanTag.tag} from EVERY future post across all calendars? You can undo from Profile → Hashtag policy.`}
          confirmLabel="Ban tag"
          onCancel={() => setPendingBanTag(null)}
          onConfirm={async () => {
            const { day, tag } = pendingBanTag;
            setPendingBanTag(null);
            await commitBanTagWorkspaceWide(day, tag);
          }}
        />
      )}
      {pendingBulkRegenerate && (
        <ConfirmDialog
          title="Regenerate unlocked posts?"
          message={`Regenerate ${pendingBulkRegenerate.count} unlocked post${pendingBulkRegenerate.count === 1 ? "" : "s"} for ${niceLabelFor(platform)}? Pinned posts stay untouched.`}
          confirmLabel="Regenerate"
          onCancel={() => setPendingBulkRegenerate(null)}
          onConfirm={async () => {
            setPendingBulkRegenerate(null);
            await commitRegenerateAllUnlocked();
          }}
        />
      )}
      {pendingRemoveVisual !== null && (
        <ConfirmDialog
          title="Remove visual?"
          message="Are you sure you want to remove this visual?"
          confirmLabel="Remove"
          onCancel={() => setPendingRemoveVisual(null)}
          onConfirm={async () => {
            const day = pendingRemoveVisual;
            setPendingRemoveVisual(null);
            applyImageToPost(day, "");
          }}
        />
      )}
      {p && (
        <PersonaCompare
          post={p}
          platform={platform}
          isOpen={personaCompareOpen}
          onClose={() => setPersonaCompareOpen(false)}
          onApplyCompare={handleApplyCompare}
        />
      )}
    </>
  );
}
