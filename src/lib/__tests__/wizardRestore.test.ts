import { describe, it, expect } from "vitest";
import { clampRestoredStep } from "../wizardRestore";

describe("clampRestoredStep", () => {
  it("step 3 without posts becomes 2", () => {
    expect(clampRestoredStep(3, false)).toBe(2);
  });
  it("step 3 with posts becomes 4", () => {
    expect(clampRestoredStep(3, true)).toBe(4);
  });
  it("leaves steps 1, 2 and 4 unchanged", () => {
    expect(clampRestoredStep(1, false)).toBe(1);
    expect(clampRestoredStep(2, true)).toBe(2);
    expect(clampRestoredStep(4, true)).toBe(4);
  });
});
