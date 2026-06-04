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
  lockedDays: Set<number>;
  sampleMode: boolean;
  savedId: string | null;
  autosaveStatus: "idle" | "saving" | "saved" | "error";

  setStep: (step: number | ((prev: number) => number)) => void;
  setForm: (form: Partial<WizardForm> | ((prev: WizardForm) => WizardForm)) => void;
  setCustomTopic: (topic: string) => void;
  setExtraTopics: (topics: string[] | ((prev: string[]) => string[])) => void;
  setPosts: (posts: Post[] | ((prev: Post[]) => Post[])) => void;
  setPostTimes: (times: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setActiveDay: (day: number | ((prev: number) => number)) => void;
  toggleLockedDay: (day: number) => void;
  setLockedDays: (days: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
  setSampleMode: (mode: boolean) => void;
  setSavedId: (id: string | null) => void;
  setAutosaveStatus: (status: "idle" | "saving" | "saved" | "error") => void;
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
  lockedDays: new Set<number>(),
  sampleMode: false,
  savedId: null,
  autosaveStatus: "idle",

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
      const next = new Set(state.lockedDays);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return { lockedDays: next };
    }),
  setLockedDays: (lockedDays) =>
    set((state) => ({
      lockedDays: typeof lockedDays === "function" ? lockedDays(state.lockedDays) : lockedDays,
    })),
  setSampleMode: (sampleMode) => set({ sampleMode }),
  setSavedId: (savedId) => set({ savedId }),
  setAutosaveStatus: (autosaveStatus) => set({ autosaveStatus }),
  loadSnapshot: (snapshot) =>
    set({
      form: { ...snapshot.form },
      step: snapshot.step,
      extraTopics: snapshot.extraTopics || [],
      posts: snapshot.posts || [],
      activeDay: snapshot.activeDay || 0,
      postTimes: snapshot.postTimes || {},
      lockedDays: new Set<number>(),
      sampleMode: false,
      savedId: null,
    }),
  reset: () =>
    set({
      step: 1,
      form: { ...INITIAL_FORM, weekStart: toDateInputValue(nextMonday()), targetDate: toDateInputValue(nextMonday()) },
      customTopic: "",
      extraTopics: [],
      posts: [],
      postTimes: {},
      activeDay: 0,
      lockedDays: new Set<number>(),
      sampleMode: false,
      savedId: null,
      autosaveStatus: "idle",
    }),
}));
