import { describe, it, expect, beforeEach } from "vitest";
import { act } from "react";
import { useWizardStore } from "../useWizardStore";

// The store is a singleton — reset between tests via the store's own reset()
beforeEach(() => {
  act(() => {
    useWizardStore.getState().reset();
  });
});

describe("useWizardStore — keySource", () => {
  it("defaults to null", () => {
    expect(useWizardStore.getState().keySource).toBeNull();
  });

  it("setKeySource('platform') sets keySource to 'platform'", () => {
    act(() => {
      useWizardStore.getState().setKeySource("platform");
    });
    expect(useWizardStore.getState().keySource).toBe("platform");
  });

  it("setKeySource('user') sets keySource to 'user'", () => {
    act(() => {
      useWizardStore.getState().setKeySource("user");
    });
    expect(useWizardStore.getState().keySource).toBe("user");
  });

  it("setKeySource(null) clears keySource back to null", () => {
    act(() => {
      useWizardStore.getState().setKeySource("user");
      useWizardStore.getState().setKeySource(null);
    });
    expect(useWizardStore.getState().keySource).toBeNull();
  });

  it("reset() resets keySource to null", () => {
    act(() => {
      useWizardStore.getState().setKeySource("platform");
      useWizardStore.getState().reset();
    });
    expect(useWizardStore.getState().keySource).toBeNull();
  });
});

describe("useWizardStore — loadSnapshot", () => {
  it("loadSnapshot preserves the user's current keySource/keyMode selection", () => {
    act(() => {
      useWizardStore.getState().setKeySource("user");
      useWizardStore.getState().setKeyMode("always");
      useWizardStore.getState().loadSnapshot({
        form: useWizardStore.getState().form,
        step: 1,
        extraTopics: [],
        posts: [],
        activeDay: 0,
        postTimes: {},
        savedAt: Date.now(),
      });
    });
    expect(useWizardStore.getState().keySource).toBe("user");
    expect(useWizardStore.getState().keyMode).toBe("always");
  });
});

describe("useWizardStore — step management", () => {
  it("setStep sets the step to a number", () => {
    act(() => {
      useWizardStore.getState().setStep(3);
    });
    expect(useWizardStore.getState().step).toBe(3);
  });

  it("setStep accepts a function updater", () => {
    act(() => {
      useWizardStore.getState().setStep(2);
      useWizardStore.getState().setStep((prev) => prev + 1);
    });
    expect(useWizardStore.getState().step).toBe(3);
  });

  it("reset() resets step to 1", () => {
    act(() => {
      useWizardStore.getState().setStep(5);
      useWizardStore.getState().reset();
    });
    expect(useWizardStore.getState().step).toBe(1);
  });
});

describe("useWizardStore — autosaveStatus", () => {
  it("defaults to 'idle'", () => {
    expect(useWizardStore.getState().autosaveStatus).toBe("idle");
  });

  it("setAutosaveStatus updates to 'saving'", () => {
    act(() => {
      useWizardStore.getState().setAutosaveStatus("saving");
    });
    expect(useWizardStore.getState().autosaveStatus).toBe("saving");
  });

  it("reset() resets autosaveStatus to 'idle'", () => {
    act(() => {
      useWizardStore.getState().setAutosaveStatus("error");
      useWizardStore.getState().reset();
    });
    expect(useWizardStore.getState().autosaveStatus).toBe("idle");
  });
});

describe("useWizardStore — localStorage persistence (F-010 offline recovery)", () => {
  it("persists recovery-relevant fields to localStorage under the cf:wizard key", () => {
    act(() => {
      useWizardStore.getState().setStep(3);
      useWizardStore.getState().setPosts([{ day: 1 } as never]);
    });

    const raw = window.localStorage.getItem("cf:wizard");
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw!);
    expect(persisted.state.step).toBe(3);
    expect(persisted.state.posts).toEqual([{ day: 1 }]);
  });

  it("does not persist ephemeral fields like autosaveStatus or sampleMode", () => {
    act(() => {
      useWizardStore.getState().setAutosaveStatus("error");
      useWizardStore.getState().setSampleMode(true);
    });

    const raw = window.localStorage.getItem("cf:wizard");
    const persisted = JSON.parse(raw!);
    expect(persisted.state.autosaveStatus).toBeUndefined();
    expect(persisted.state.sampleMode).toBeUndefined();
  });
});

describe("useWizardStore — persist migration/merge (CF-19)", () => {
  it("declares a persist version so future schema changes can migrate", () => {
    const raw = window.localStorage.getItem("cf:wizard");
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw!);
    expect(persisted.version).toBe(1);
  });

  it("falls back to INITIAL_FORM defaults for form fields missing/undefined in persisted state", () => {
    // Simulate an old persisted draft that predates a newly-added form field
    // (represented here as `undefined`, which is how a missing key round-trips
    // once JSON.parse'd back out of a hand-crafted envelope).
    window.localStorage.setItem(
      "cf:wizard",
      JSON.stringify({
        state: {
          form: { industry: "tech", coreIdea: undefined },
          posts: [],
          postTimes: {},
          lockedDays: [],
          activeDay: 0,
          step: 1,
        },
        version: 1,
      })
    );

    act(() => {
      useWizardStore.persist.rehydrate();
    });

    const form = useWizardStore.getState().form;
    expect(form.industry).toBe("tech");
    // coreIdea was undefined in the persisted blob — must fall back to default
    // rather than surfacing as undefined (which would crash `.trim()` callers).
    expect(typeof form.coreIdea).toBe("string");
  });
});

describe("useWizardStore — lockedDays", () => {
  it("toggleLockedDay adds a day to the locked set", () => {
    act(() => {
      useWizardStore.getState().toggleLockedDay(3);
    });
    expect(useWizardStore.getState().lockedDays.includes(3)).toBe(true);
  });

  it("toggleLockedDay removes a day if already locked", () => {
    act(() => {
      useWizardStore.getState().toggleLockedDay(3);
      useWizardStore.getState().toggleLockedDay(3);
    });
    expect(useWizardStore.getState().lockedDays.includes(3)).toBe(false);
  });

  it("reset() clears all locked days", () => {
    act(() => {
      useWizardStore.getState().toggleLockedDay(1);
      useWizardStore.getState().toggleLockedDay(4);
      useWizardStore.getState().reset();
    });
    expect(useWizardStore.getState().lockedDays.length).toBe(0);
  });
});

describe("useWizardStore — trending topics", () => {
  it("selectedTrendingTopics defaults to []", () => {
    expect(useWizardStore.getState().selectedTrendingTopics).toEqual([]);
  });

  it("toggleTrendingTopic adds a keyword when not present", () => {
    act(() => {
      useWizardStore.getState().toggleTrendingTopic("AI Tools");
    });
    expect(useWizardStore.getState().selectedTrendingTopics).toContain("AI Tools");
    expect(useWizardStore.getState().selectedTrendingTopics.length).toBe(1);
  });

  it("toggleTrendingTopic removes a keyword when already present", () => {
    act(() => {
      useWizardStore.getState().toggleTrendingTopic("AI Tools");
      useWizardStore.getState().toggleTrendingTopic("AI Tools");
    });
    expect(useWizardStore.getState().selectedTrendingTopics).not.toContain("AI Tools");
    expect(useWizardStore.getState().selectedTrendingTopics.length).toBe(0);
  });

  it("toggleTrendingTopic handles multiple toggles correctly", () => {
    act(() => {
      useWizardStore.getState().toggleTrendingTopic("AI Tools");
      useWizardStore.getState().toggleTrendingTopic("Remote Work");
      useWizardStore.getState().toggleTrendingTopic("AI Tools"); // remove first
    });
    const selected = useWizardStore.getState().selectedTrendingTopics;
    expect(selected).not.toContain("AI Tools");
    expect(selected).toContain("Remote Work");
    expect(selected.length).toBe(1);
  });

  it("clearTrendingTopics resets to []", () => {
    act(() => {
      useWizardStore.getState().toggleTrendingTopic("AI Tools");
      useWizardStore.getState().toggleTrendingTopic("Remote Work");
      useWizardStore.getState().clearTrendingTopics();
    });
    expect(useWizardStore.getState().selectedTrendingTopics).toEqual([]);
  });

  it("reset() clears selectedTrendingTopics", () => {
    act(() => {
      useWizardStore.getState().toggleTrendingTopic("AI Tools");
      useWizardStore.getState().reset();
    });
    expect(useWizardStore.getState().selectedTrendingTopics).toEqual([]);
  });
});
