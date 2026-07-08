import type { BrandSlotRow } from "@/hooks/queries/shared";

/**
 * Resolves the brand slot that should be "active" for a given context.
 *
 * Precedence:
 * 1. The slot explicitly attached to the calendar (`calendarBrandSlotId`), if
 *    it still exists in `slots` (it may have been deleted since the calendar
 *    was saved — in which case we fall through to the default).
 * 2. The user's `is_default` slot.
 * 3. The first slot in the array, as a last-resort fallback (covers the brief
 *    window where `useSetDefaultBrandSlotMutation`'s non-atomic two-step
 *    update leaves zero rows marked `is_default` if the second call fails).
 *
 * Returns `null` only when there are no slots at all.
 */
export function resolveActiveBrandSlot(
  slots: BrandSlotRow[] | undefined,
  calendarBrandSlotId?: string | null
): BrandSlotRow | null {
  if (!slots || slots.length === 0) return null;

  if (calendarBrandSlotId) {
    const match = slots.find((s) => s.id === calendarBrandSlotId);
    if (match) return match;
  }

  return slots.find((s) => s.is_default) ?? slots[0] ?? null;
}
