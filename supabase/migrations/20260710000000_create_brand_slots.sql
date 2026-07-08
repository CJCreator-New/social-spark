-- Migration: Brand slots (multiple named brand profiles per account)
-- Description: Brand identity (forbidden_phrases, proof_points, cta_preferences,
-- preferred_structures, brand_examples, default_framework) previously lived only
-- as single columns on public.profiles — one brand voice per account. This adds
-- a brand_slots table so an account can define multiple named brand profiles.
-- Column types are copied verbatim from the existing profiles brand columns
-- (see 20260604103000_add_brand_memory.sql and
-- 20260610072906_3350cbe2-0edf-4a43-acb5-d8fe94bffd3c.sql).
-- Follows this repo's established RLS pattern (idempotent policy creation via
-- DO $$ ... EXCEPTION WHEN duplicate_object) and applies WITH CHECK on the
-- UPDATE policy from day one (see
-- 20260707000000_add_with_check_to_update_policies.sql for the historical gap
-- this avoids repeating).

CREATE TABLE IF NOT EXISTS public.brand_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  is_default BOOLEAN NOT NULL DEFAULT false,
  forbidden_phrases TEXT[] DEFAULT '{}'::text[],
  proof_points TEXT[] DEFAULT '{}'::text[],
  cta_preferences TEXT[] DEFAULT '{}'::text[],
  preferred_structures TEXT[] DEFAULT '{}'::text[],
  brand_examples TEXT[],
  default_framework TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_slots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own brand slots" ON public.brand_slots
    FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users insert own brand slots" ON public.brand_slots
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own brand slots" ON public.brand_slots
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users delete own brand slots" ON public.brand_slots
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enforce at most one is_default = true row per user.
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_slots_one_default_per_user
  ON public.brand_slots (user_id) WHERE is_default;

-- General per-user recency index for listing a user's brand slots.
CREATE INDEX IF NOT EXISTS idx_brand_slots_user_created
  ON public.brand_slots (user_id, created_at DESC);

CREATE TRIGGER trg_brand_slots_updated BEFORE UPDATE ON public.brand_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
