-- Migration: Pin a brand slot to a saved calendar
-- Description: Adds a nullable brand_slot_id FK on public.saved_calendars so
-- each calendar can pin which brand_slots row it uses. NULL preserves today's
-- behavior (falls back to the account's default brand slot / profile brand
-- columns) for every existing calendar until a user opts in. ON DELETE SET
-- NULL is deliberate: deleting a brand slot must never break a calendar row —
-- it just falls back to the account's default slot.

ALTER TABLE IF EXISTS public.saved_calendars
  ADD COLUMN IF NOT EXISTS brand_slot_id UUID REFERENCES public.brand_slots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_saved_calendars_brand_slot
  ON public.saved_calendars (brand_slot_id) WHERE brand_slot_id IS NOT NULL;
