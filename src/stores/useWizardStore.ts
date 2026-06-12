import { create } from "zustand";
import { WizardForm, Post, INITIAL_FORM, WizardDraftSnapshot } from "@/components/wizard/constants";
import { toDateInputValue, nextMonday } from "@/lib/calendarSchedule";

interface WizardState {
  step: number;
  form: WizardForm;
  customTopic: string;
  extraTopics: string[];
  posts: Post[];
  postTimes: Record<string, string>;
  activeDay: number;
  lockedDays: number[];
  sampleMode: boolean;
  savedId: string | null;
  autosaveStatus: "idle" | "saving" | "saved" | "error";
  keySource: "platform" | "user" | null;
  keyMode: "always" | "fallback" | null;

  setStep: (step: number | ((prev: number) => number)) => void;
  setForm: (form: Partial<WizardForm> | ((prev: WizardForm) => WizardForm)) => void;
  setCustomTopic: (topic: string) => void;
  setExtraTopics: (topics: string[] | ((prev: string[]) => string[])) => void;
  setPosts: (posts: Post[] | ((prev: Post[]) => Post[])) => void;
  setPostTimes: (times: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setActiveDay: (day: number | ((prev: number) => number)) => void;
  toggleLockedDay: (day: number) => void;
  setLockedDays: (days: number[] | ((prev: number[]) => number[])) => void;
  setSampleMode: (mode: boolean) => void;
  setSavedId: (id: string | null) => void;
  setAutosaveStatus: (status: "idle" | "saving" | "saved" | "error") => void;
  setKeySource: (source: "platform" | "user" | null) => void;
  setKeyMode: (mode: "always" | "fallback" | null) => void;
  loadSnapshot: (snapshot: WizardDraftSnapshot) => void;
  reset: () => void;
}

export const useWizardStore = create<WizardState>((set) => ({
  step: 1,
  form: { ...INITIAL_FORM },
  customTopic: "",
  extraTopics: [],
  posts: [],
  postTimes: {},
  activeDay: 0,
  lockedDays: [],
  sampleMode: false,
  savedId: null,
  autosaveStatus: "idle",
  keySource: null,
  keyMode: null,

  setStep: (step) =>
    set((state) => ({
      step: typeof step === "function" ? step(state.step) : step,
    })),
  setForm: (form) =>
    set((state) => ({
      form: typeof form === "function" ? form(state.form) : { ...state.form, ...form },
    })),
  setCustomTopic: (customTopic) => set({ customTopic }),
  setExtraTopics: (extraTopics) =>
    set((state) => ({
      extraTopics: typeof extraTopics === "function" ? extraTopics(state.extraTopics) : extraTopics,
    })),
  setPosts: (posts) =>
    set((state) => ({
      posts: typeof posts === "function" ? posts(state.posts) : posts,
    })),
  setPostTimes: (postTimes) =>
    set((state) => ({
      postTimes: typeof postTimes === "function" ? postTimes(state.postTimes) : postTimes,
    })),
  setActiveDay: (activeDay) =>
    set((state) => ({
      activeDay: typeof activeDay === "function" ? activeDay(state.activeDay) : activeDay,
    })),
  toggleLockedDay: (day) =>
    set((state) => {
      const has = state.lockedDays.includes(day);
      const next = has ? state.lockedDays.filter((d) => d !== day) : [...state.lockedDays, day];
      return { lockedDays: next };
    }),
  setLockedDays: (lockedDays) =>
    set((state) => ({
      lockedDays: typeof lockedDays === "function" ? lockedDays(state.lockedDays) : lockedDays,
    })),
  setSampleMode: (sampleMode) => set({ sampleMode }),
  setSavedId: (savedId) => set({ savedId }),
  setAutosaveStatus: (autosaveStatus) => set({ autosaveStatus }),
  setKeySource: (keySource) => set({ keySource }),
  setKeyMode: (keyMode) => set({ keyMode }),
  loadSnapshot: (snapshot) =>
    set((state) => ({
      form: { ...snapshot.form },
      step: snapshot.step,
      extraTopics: snapshot.extraTopics || [],
      posts: snapshot.posts || [],
      activeDay: snapshot.activeDay || 0,
      postTimes: snapshot.postTimes || {},
      lockedDays: [],
      sampleMode: false,
      savedId: null,
      keySource: state.keySource,
      keyMode: state.keyMode,
    })),
  reset: () =>
    set({
      step: 1,
      form: { ...INITIAL_FORM, weekStart: toDateInputValue(nextMonday()), targetDate: toDateInputValue(nextMonday()) },
      customTopic: "",
      extraTopics: [],
      posts: [],
      postTimes: {},
      activeDay: 0,
      lockedDays: [],
      sampleMode: false,
      savedId: null,
      autosaveStatus: "idle",
      keySource: null,
      keyMode: null,
    }),
}));

/** Convenience selector returning lockedDays as a Set for `.has()` checks. */
export const selectLockedDaysSet = (state: WizardState): Set<number> => new Set(state.lockedDays);
