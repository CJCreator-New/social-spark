import { useState, useCallback, useEffect } from "react";
import { DRAFT_CONFIG } from "../lib/config";
import type { Form, Post } from "../lib/validation";

/**
 * Get the next Monday date in YYYY-MM-DD format
 */
function getNextMonday(): string {
  const today = new Date();
  const day = today.getDay();
  const daysUntilMonday = (1 - day + 7) % 7 || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday.toISOString().split("T")[0];
}

/**
 * Convert date to input format
 */
function toDateInputValue(date: Date | string): string {
  if (typeof date === "string") return date;
  return date.toISOString().split("T")[0];
}

/**
 * Default form state
 */
function getDefaultFormState(): Form {
  const nextMonday = getNextMonday();
  return {
    industry: "",
    platform: "LinkedIn",
    coreIdea: "",
    audiences: [],
    voice: "",
    style: "",
    goals: ["Awareness", "Engagement"],
    topics: [],
    topic: "",
    format: "Balanced mix",
    cta: "Share & repost bait",
    length: "medium",
    structure: "mixed",
    extra: "",
    bannedWords: [],
    requiredWords: [],
    bannedHashtags: [],
    requiredHashtags: [],
    mode: "week",
    targetDate: nextMonday,
    weekStart: nextMonday,
    step: 1,
    isGenerating: false,
    posts: [],
    activeDay: 0,
  };
}

/**
 * Custom hook for managing form state
 * Handles form data, validation, persistence, and UI state
 */
export function useFormState() {
  const [form, setForm] = useState<Form>(() => {
    // Try to load from localStorage on mount
    try {
      const saved = localStorage.getItem(DRAFT_CONFIG.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...getDefaultFormState(), ...parsed };
      }
    } catch (e) {
      console.warn("Failed to load draft from localStorage:", e);
    }
    return getDefaultFormState();
  });

  const [error, setError] = useState<string>("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [lockedDays, setLockedDays] = useState<Set<number>>(new Set());
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [tweakOpenIdx, setTweakOpenIdx] = useState<number | null>(null);
  const [copyMenuOpen, setCopyMenuOpen] = useState<number | null>(null);
  const [reformatting, setReformatting] = useState<Set<number>>(new Set());

  // Auto-save form to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_CONFIG.storageKey, JSON.stringify(form));
      } catch (e) {
        console.warn("Failed to save draft to localStorage:", e);
      }
    }, DRAFT_CONFIG.autoSaveIntervalMs);

    return () => clearTimeout(timer);
  }, [form]);

  /**
   * Update a single form field
   */
  const updateFormField = useCallback(<K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  /**
   * Update multiple form fields at once
   */
  const updateFormFields = useCallback((updates: Partial<Form>) => {
    setForm((prev) => ({ ...prev, ...updates }));
  }, []);

  /**
   * Reset form to defaults
   */
  const resetForm = useCallback(() => {
    setForm(getDefaultFormState());
    setError("");
    setCopiedIdx(null);
    setCopiedAll(false);
    setLockedDays(new Set());
    setRegenIdx(null);
    setTweakOpenIdx(null);
    setCopyMenuOpen(null);
    setReformatting(new Set());
  }, []);

  /**
   * Clear draft from localStorage
   */
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_CONFIG.storageKey);
      localStorage.removeItem(DRAFT_CONFIG.postsStorageKey);
    } catch (e) {
      console.warn("Failed to clear draft:", e);
    }
  }, []);

  /**
   * Move to next step
   */
  const nextStep = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      step: Math.min(4, prev.step + 1),
    }));
  }, []);

  /**
   * Move to previous step
   */
  const prevStep = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      step: Math.max(1, prev.step - 1),
    }));
  }, []);

  /**
   * Go to specific step
   */
  const goToStep = useCallback((step: number) => {
    setForm((prev) => ({
      ...prev,
      step: Math.max(1, Math.min(4, step)),
    }));
  }, []);

  /**
   * Set posts and move to step 4
   */
  const setPosts = useCallback((posts: Post[]) => {
    setForm((prev) => ({
      ...prev,
      posts,
      activeDay: 0,
      step: 4,
    }));
  }, []);

  /**
   * Update a specific post
   */
  const updatePost = useCallback((index: number, post: Partial<Post>) => {
    setForm((prev) => ({
      ...prev,
      posts: prev.posts.map((p, i) => (i === index ? { ...p, ...post } : p)),
    }));
  }, []);

  /**
   * Set active day for viewing
   */
  const setActiveDay = useCallback((day: number) => {
    setForm((prev) => ({
      ...prev,
      activeDay: Math.max(0, Math.min(prev.posts.length - 1, day)),
    }));
  }, []);

  /**
   * Toggle day locked state
   */
  const toggleLockedDay = useCallback((day: number) => {
    setLockedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  }, []);

  /**
   * Set which post is being regenerated
   */
  const setRegeneratingIdx = useCallback((idx: number | null) => {
    setRegenIdx(idx);
  }, []);

  /**
   * Toggle post copy menu
   */
  const toggleCopyMenu = useCallback((idx: number | null) => {
    setCopyMenuOpen((prev) => (prev === idx ? null : idx));
  }, []);

  /**
   * Mark post as copied
   */
  const markCopied = useCallback((idx: number) => {
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }, []);

  /**
   * Mark all copied
   */
  const markAllCopied = useCallback(() => {
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, []);

  /**
   * Toggle reformatting state for post
   */
  const toggleReformatting = useCallback((idx: number) => {
    setReformatting((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }, []);

  /**
   * Toggle tweak editor open state
   */
  const toggleTweakEditor = useCallback((idx: number | null) => {
    setTweakOpenIdx((prev) => (prev === idx ? null : idx));
  }, []);

  /**
   * Set error message
   */
  const setErrorMessage = useCallback((msg: string) => {
    setError(msg);
  }, []);

  /**
   * Clear error message
   */
  const clearErrorMessage = useCallback(() => {
    setError("");
  }, []);

  /**
   * Set generation state
   */
  const setGenerating = useCallback((isGenerating: boolean, statusMessage?: string) => {
    setForm((prev) => ({
      ...prev,
      isGenerating,
    }));
  }, []);

  return {
    // Main form state
    form,
    setForm,
    updateFormField,
    updateFormFields,
    resetForm,
    clearDraft,

    // Step navigation
    nextStep,
    prevStep,
    goToStep,

    // Posts management
    posts: form.posts,
    setPosts,
    updatePost,
    activeDay: form.activeDay,
    setActiveDay,

    // UI state
    error,
    setErrorMessage,
    clearErrorMessage,
    isGenerating: form.isGenerating,
    setGenerating,

    // Post-level UI state
    copiedIdx,
    copiedAll,
    markCopied,
    markAllCopied,
    lockedDays,
    toggleLockedDay,
    regenIdx,
    setRegeneratingIdx,
    tweakOpenIdx,
    toggleTweakEditor,
    copyMenuOpen,
    toggleCopyMenu,
    reformatting,
    toggleReformatting,
  };
}

export type UseFormStateReturn = ReturnType<typeof useFormState>;

/**
 * Convenience exports for use in components
 */
export default useFormState;
