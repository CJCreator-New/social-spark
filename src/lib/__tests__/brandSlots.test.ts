import { describe, it, expect } from "vitest";
import { resolveActiveBrandSlot } from "../brandSlots";
import type { BrandSlotRow } from "@/hooks/queries/shared";

function makeSlot(overrides: Partial<BrandSlotRow>): BrandSlotRow {
  return {
    id: "slot-1",
    user_id: "user-1",
    name: "Slot",
    is_default: false,
    forbidden_phrases: [],
    proof_points: [],
    cta_preferences: [],
    preferred_structures: [],
    brand_examples: null,
    default_framework: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveActiveBrandSlot", () => {
  it("returns null for an empty or missing array", () => {
    expect(resolveActiveBrandSlot(undefined)).toBeNull();
    expect(resolveActiveBrandSlot([])).toBeNull();
  });

  it("returns the matching calendar slot id when present", () => {
    const slots = [
      makeSlot({ id: "default", is_default: true }),
      makeSlot({ id: "other", is_default: false }),
    ];
    expect(resolveActiveBrandSlot(slots, "other")?.id).toBe("other");
  });

  it("falls back to the default slot when calendarBrandSlotId is null/undefined", () => {
    const slots = [
      makeSlot({ id: "not-default", is_default: false }),
      makeSlot({ id: "default", is_default: true }),
    ];
    expect(resolveActiveBrandSlot(slots, null)?.id).toBe("default");
    expect(resolveActiveBrandSlot(slots, undefined)?.id).toBe("default");
  });

  it("falls back to the default slot when the calendar's slot id no longer exists (deleted)", () => {
    const slots = [
      makeSlot({ id: "default", is_default: true }),
      makeSlot({ id: "other", is_default: false }),
    ];
    expect(resolveActiveBrandSlot(slots, "deleted-slot-id")?.id).toBe("default");
  });

  it("falls back to the first slot when no slot is marked default", () => {
    const slots = [
      makeSlot({ id: "first", is_default: false }),
      makeSlot({ id: "second", is_default: false }),
    ];
    expect(resolveActiveBrandSlot(slots)?.id).toBe("first");
  });
});
