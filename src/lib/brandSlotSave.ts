import { supabase } from "@/integrations/supabase/client";
import type { BrandSlotPatch } from "@/lib/brandCache";

/**
 * Saves brand fields straight onto a profile brand slot (the source of truth).
 * Used by places that have no mutation hook, such as the wizard's
 * "Save brand memory" button. Callers should invalidate ["brand-slots", userId].
 */
export async function saveBrandFieldsToSlot(
  userId: string,
  slotId: string,
  patch: BrandSlotPatch
): Promise<void> {
  const { error } = await (supabase.from("brand_slots" as never) as any)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", slotId)
    .eq("user_id", userId);
  if (error) throw error;
}
