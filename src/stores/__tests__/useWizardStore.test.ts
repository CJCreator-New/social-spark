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
